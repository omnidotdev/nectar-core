// src/core/server/connectionManager.ts
import { nanoid } from "nanoid";
import postgres from "postgres";
var connections = /* @__PURE__ */ new Map();
var CONNECTION_TIMEOUT_MS = 30 * 60 * 1e3;
async function createConnection(connectionString, opts) {
  const readOnly = opts?.readOnly ?? false;
  const sql = postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    // When read-only, set the GUC as a startup option so it applies pool-wide
    // A SET after connect would only affect one pooled connection, so use the
    // connection startup parameter instead
    ...readOnly ? { connection: { options: "-c default_transaction_read_only=on" } } : {}
  });
  try {
    const result = await sql`SELECT current_database() as database, current_user as user`;
    const database = result[0]?.database;
    const hostMatch = connectionString.match(/@([^:/]+)/);
    const host = hostMatch?.[1] || "localhost";
    const sessionId = nanoid(32);
    connections.set(sessionId, {
      sql,
      connectionString,
      readOnly,
      createdAt: /* @__PURE__ */ new Date(),
      lastUsedAt: /* @__PURE__ */ new Date()
    });
    return { sessionId, database, host };
  } catch (error) {
    await sql.end();
    throw error;
  }
}
function getConnection(sessionId) {
  const entry = connections.get(sessionId);
  if (!entry) return null;
  entry.lastUsedAt = /* @__PURE__ */ new Date();
  return entry.sql;
}
function hasConnection(sessionId) {
  return connections.has(sessionId);
}
function getConnectionInfo(sessionId) {
  const entry = connections.get(sessionId);
  if (!entry) return null;
  const hostMatch = entry.connectionString.match(/@([^:/]+)/);
  const dbMatch = entry.connectionString.match(/\/([^?]+)/);
  return {
    host: hostMatch?.[1] || "localhost",
    database: dbMatch?.[1] || "unknown"
  };
}
async function closeConnection(sessionId) {
  const entry = connections.get(sessionId);
  if (entry) {
    await entry.sql.end();
    connections.delete(sessionId);
  }
}
async function cleanupIdleConnections() {
  const now = Date.now();
  for (const [sessionId, entry] of connections.entries()) {
    if (now - entry.lastUsedAt.getTime() > CONNECTION_TIMEOUT_MS) {
      await entry.sql.end();
      connections.delete(sessionId);
    }
  }
}
var cleanupTimer = setInterval(
  () => {
    cleanupIdleConnections().catch(console.error);
  },
  5 * 60 * 1e3
);
cleanupTimer.unref?.();

// src/core/server/introspection.ts
var asSerializableRows = (rows) => rows;
var asSerializableRow = (row) => row;
async function listTables(sql) {
  const tables = await sql`
    SELECT
      schemaname as schema,
      tablename as name
    FROM pg_tables
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
    ORDER BY schemaname, tablename
  `;
  const tablesWithCounts = await Promise.all(
    tables.map(async (table) => {
      const countResult = await sql`
        SELECT COUNT(*)::int as count
        FROM ${sql(table.schema)}.${sql(table.name)}
      `;
      return {
        schema: table.schema,
        name: table.name,
        rowCount: countResult[0]?.count ?? 0
      };
    })
  );
  return tablesWithCounts;
}
async function describeTable(sql, schema, table) {
  const columns = await sql`
    SELECT
      c.column_name,
      c.data_type,
      c.udt_name,
      c.is_nullable,
      c.column_default,
      c.character_maximum_length
    FROM information_schema.columns c
    WHERE c.table_schema = ${schema}
      AND c.table_name = ${table}
    ORDER BY c.ordinal_position
  `;
  const primaryKeys = await sql`
    SELECT kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_schema = ${schema}
      AND tc.table_name = ${table}
  `;
  const pkColumns = new Set(primaryKeys.map((pk) => pk.column_name));
  const uniqueConstraints = await sql`
    SELECT kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'UNIQUE'
      AND tc.table_schema = ${schema}
      AND tc.table_name = ${table}
  `;
  const uniqueColumns = new Set(uniqueConstraints.map((uc) => uc.column_name));
  const foreignKeys = await sql`
    SELECT
      kcu.column_name,
      ccu.table_name AS foreign_table,
      ccu.column_name AS foreign_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = ${schema}
      AND tc.table_name = ${table}
  `;
  const fkMap = new Map(
    foreignKeys.map((fk) => [
      fk.column_name,
      {
        table: fk.foreign_table,
        column: fk.foreign_column
      }
    ])
  );
  const columnInfos = columns.map((col) => {
    let dataType = col.udt_name;
    if (col.character_maximum_length) {
      dataType = `${dataType}(${col.character_maximum_length})`;
    }
    return {
      name: col.column_name,
      type: dataType,
      nullable: col.is_nullable === "YES",
      default: col.column_default,
      isPrimaryKey: pkColumns.has(col.column_name),
      isUnique: uniqueColumns.has(col.column_name),
      foreignKey: fkMap.get(col.column_name)
    };
  });
  return {
    schema,
    tableName: table,
    columns: columnInfos
  };
}
async function readTableData(sql, params) {
  const {
    schema,
    table,
    page = 0,
    pageSize = 50,
    sortColumn,
    sortDirection,
    filters
  } = params;
  const offset = page * pageSize;
  let whereClause = "";
  const filterValues = [];
  if (filters && filters.length > 0) {
    const conditions = [];
    for (const filter of filters) {
      const col = `"${filter.column.replace(/"/g, '""')}"`;
      if (filter.operator === "is_null") {
        conditions.push(`${col} IS NULL`);
        continue;
      }
      if (filter.operator === "is_not_null") {
        conditions.push(`${col} IS NOT NULL`);
        continue;
      }
      if (filter.value === void 0) continue;
      switch (filter.operator) {
        case "eq":
          conditions.push(`${col} = $${filterValues.length + 1}`);
          filterValues.push(filter.value);
          break;
        case "neq":
          conditions.push(`${col} != $${filterValues.length + 1}`);
          filterValues.push(filter.value);
          break;
        case "gt":
          conditions.push(`${col} > $${filterValues.length + 1}`);
          filterValues.push(filter.value);
          break;
        case "gte":
          conditions.push(`${col} >= $${filterValues.length + 1}`);
          filterValues.push(filter.value);
          break;
        case "lt":
          conditions.push(`${col} < $${filterValues.length + 1}`);
          filterValues.push(filter.value);
          break;
        case "lte":
          conditions.push(`${col} <= $${filterValues.length + 1}`);
          filterValues.push(filter.value);
          break;
        case "like":
          conditions.push(`${col}::text LIKE $${filterValues.length + 1}`);
          filterValues.push(`%${filter.value}%`);
          break;
        case "ilike":
          conditions.push(`${col}::text ILIKE $${filterValues.length + 1}`);
          filterValues.push(`%${filter.value}%`);
          break;
      }
    }
    if (conditions.length > 0) {
      whereClause = `WHERE ${conditions.join(" AND ")}`;
    }
  }
  let orderClause = "";
  if (sortColumn) {
    const safeColumn = `"${sortColumn.replace(/"/g, '""')}"`;
    const direction = sortDirection === "desc" ? "DESC" : "ASC";
    orderClause = `ORDER BY ${safeColumn} ${direction} NULLS LAST`;
  }
  const countQuery = `SELECT COUNT(*)::int as count FROM "${schema}"."${table}" ${whereClause}`;
  const countResult = await sql.unsafe(countQuery, filterValues);
  const totalCount = countResult[0]?.count ?? 0;
  const dataQuery = `SELECT * FROM "${schema}"."${table}" ${whereClause} ${orderClause} LIMIT ${pageSize} OFFSET ${offset}`;
  const rows = await sql.unsafe(dataQuery, filterValues);
  return {
    rows,
    totalCount,
    page,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize)
  };
}
async function runQuery(sql, query) {
  const startTime = performance.now();
  let result;
  try {
    result = await sql.unsafe(query);
  } catch (error) {
    if (error !== null && typeof error === "object" && "code" in error && error.code === "25006") {
      throw new Error("This connection is read-only");
    }
    throw error;
  }
  const executionTime = performance.now() - startTime;
  const columns = result.length > 0 ? Object.keys(result[0]) : [];
  return {
    columns,
    rows: result,
    rowCount: result.length,
    executionTime
  };
}
async function autocompleteSchema(sql) {
  const tables = await sql`
    SELECT
      schemaname as schema,
      tablename as name
    FROM pg_tables
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
    ORDER BY schemaname, tablename
  `;
  const columns = await sql`
    SELECT
      c.table_schema as schema,
      c.table_name as table,
      c.column_name as column
    FROM information_schema.columns c
    WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY c.table_schema, c.table_name, c.ordinal_position
  `;
  const schemaMap = {};
  for (const col of columns) {
    const key = `${col.schema}.${col.table}`;
    if (!schemaMap[key]) {
      schemaMap[key] = [];
    }
    schemaMap[key].push(col.column);
  }
  return {
    tables: tables.map((t) => ({
      schema: t.schema,
      name: t.name
    })),
    schemaMap
  };
}
async function insertRow(sql, schema, table, data) {
  const columns = Object.keys(data);
  if (columns.length === 0) {
    throw new Error("No data provided for insert");
  }
  const result = await sql`
    INSERT INTO ${sql(schema)}.${sql(table)}
    ${sql(data)}
    RETURNING *
  `;
  return { row: result[0] };
}
async function updateRow(sql, schema, table, primaryKey, data) {
  if (Object.keys(data).length === 0) {
    throw new Error("No data provided for update");
  }
  const pkValue = primaryKey.value;
  const result = await sql`
    UPDATE ${sql(schema)}.${sql(table)}
    SET ${sql(data)}
    WHERE ${sql(primaryKey.column)} = ${pkValue}
    RETURNING *
  `;
  if (result.length === 0) {
    throw new Error("Row not found");
  }
  return { row: result[0] };
}
async function deleteRow(sql, schema, table, primaryKey) {
  const pkValue = primaryKey.value;
  const result = await sql`
    DELETE FROM ${sql(schema)}.${sql(table)}
    WHERE ${sql(primaryKey.column)} = ${pkValue}
    RETURNING *
  `;
  if (result.length === 0) {
    throw new Error("Row not found");
  }
}
export {
  asSerializableRow,
  asSerializableRows,
  autocompleteSchema,
  cleanupIdleConnections,
  closeConnection,
  createConnection,
  deleteRow,
  describeTable,
  getConnection,
  getConnectionInfo,
  hasConnection,
  insertRow,
  listTables,
  readTableData,
  runQuery,
  updateRow
};
