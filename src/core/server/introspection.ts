import type postgres from "postgres";
import type {
  AutocompleteSchema,
  PrimaryKeyRef,
  TableDataParams,
  TableDataResult,
} from "@/core/data/DataSource";
import type {
  ColumnInfo,
  QueryResult,
  TableInfo,
  TableSchema,
} from "@/types/database";

/**
 * Framework-neutral database introspection and data operations.
 * Each function takes a `postgres.Sql` connection plus params and returns the
 * typed shapes shared by every backend. These are lifted verbatim out of the
 * TanStack server functions so the standalone app and the Fractal embed can
 * share them.
 */

/** The serializable row shape TanStack's createServerFn wire requires; the single place the honest-but-wide core row type is narrowed. */
export type SerializableRow = Record<string, string | number | boolean | null>;
export const asSerializableRows = (rows: Record<string, unknown>[]) =>
  rows as SerializableRow[];
export const asSerializableRow = (row: unknown) => row as SerializableRow;

/**
 * List all tables from public and user schemas (excluding system schemas)
 * with per-table row counts.
 */
export async function listTables(sql: postgres.Sql): Promise<TableInfo[]> {
  // Get all tables from public and user schemas (excluding system schemas)
  const tables = await sql`
    SELECT
      schemaname as schema,
      tablename as name
    FROM pg_tables
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
    ORDER BY schemaname, tablename
  `;

  // Get row counts for each table
  const tablesWithCounts: TableInfo[] = await Promise.all(
    tables.map(async (table) => {
      const countResult = await sql`
        SELECT COUNT(*)::int as count
        FROM ${sql(table.schema)}.${sql(table.name)}
      `;
      return {
        schema: table.schema as string,
        name: table.name as string,
        rowCount: countResult[0]?.count ?? 0,
      };
    }),
  );

  return tablesWithCounts;
}

/**
 * Describe a single table: columns with primary key, unique, and foreign key
 * metadata assembled.
 */
export async function describeTable(
  sql: postgres.Sql,
  schema: string,
  table: string,
): Promise<TableSchema> {
  // Get column information
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

  // Get primary key columns
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

  // Get unique constraints
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

  // Get foreign keys
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
        table: fk.foreign_table as string,
        column: fk.foreign_column as string,
      },
    ]),
  );

  // Build column info
  const columnInfos: ColumnInfo[] = columns.map((col) => {
    // Format data type with length if applicable
    let dataType = col.udt_name as string;
    if (col.character_maximum_length) {
      dataType = `${dataType}(${col.character_maximum_length})`;
    }

    return {
      name: col.column_name as string,
      type: dataType,
      nullable: col.is_nullable === "YES",
      default: col.column_default as string | null,
      isPrimaryKey: pkColumns.has(col.column_name),
      isUnique: uniqueColumns.has(col.column_name),
      foreignKey: fkMap.get(col.column_name),
    };
  });

  return {
    schema,
    tableName: table,
    columns: columnInfos,
  };
}

/**
 * Read paginated table data with optional filters and sorting.
 */
export async function readTableData(
  sql: postgres.Sql,
  params: TableDataParams,
): Promise<TableDataResult> {
  const {
    schema,
    table,
    page = 0,
    pageSize = 50,
    sortColumn,
    sortDirection,
    filters,
  } = params;
  const offset = page * pageSize;

  // Build WHERE clause from filters
  let whereClause = "";
  const filterValues: (string | number | boolean | null)[] = [];

  if (filters && filters.length > 0) {
    const conditions: string[] = [];
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
      if (filter.value === undefined) continue;
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

  // Build ORDER BY clause
  let orderClause = "";
  if (sortColumn) {
    const safeColumn = `"${sortColumn.replace(/"/g, '""')}"`;
    const direction = sortDirection === "desc" ? "DESC" : "ASC";
    orderClause = `ORDER BY ${safeColumn} ${direction} NULLS LAST`;
  }

  // Get total count with filters
  const countQuery = `SELECT COUNT(*)::int as count FROM "${schema}"."${table}" ${whereClause}`;
  const countResult = await sql.unsafe(countQuery, filterValues);
  const totalCount = countResult[0]?.count ?? 0;

  // Get paginated data with sorting and filtering
  const dataQuery = `SELECT * FROM "${schema}"."${table}" ${whereClause} ${orderClause} LIMIT ${pageSize} OFFSET ${offset}`;
  const rows = await sql.unsafe(dataQuery, filterValues);

  return {
    rows: rows as Record<string, unknown>[],
    totalCount,
    page,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize),
  };
}

/**
 * Execute an arbitrary SQL query and return its columns, rows, and timing.
 */
export async function runQuery(
  sql: postgres.Sql,
  query: string,
): Promise<QueryResult> {
  const startTime = performance.now();

  // Execute the raw query
  // Note: This allows arbitrary SQL - use with caution
  let result: Awaited<ReturnType<typeof sql.unsafe>>;
  try {
    result = await sql.unsafe(query);
  } catch (error) {
    // SQLSTATE 25006 (read_only_sql_transaction) is thrown when a write is
    // attempted on a read-only connection. postgres.js sets .code to the
    // SQLSTATE. Map it to a clean, non-leaky message so the SQL editor does
    // not surface raw Postgres internals or table names
    if (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "25006"
    ) {
      throw new Error("This connection is read-only");
    }
    throw error;
  }
  const executionTime = performance.now() - startTime;

  // Extract column names from result
  const columns =
    result.length > 0 ? Object.keys(result[0] as Record<string, unknown>) : [];

  return {
    columns,
    rows: result as Record<string, unknown>[],
    rowCount: result.length,
    executionTime,
  };
}

/**
 * Build the autocompletion schema: table list plus a `"schema.table" -> columns`
 * map.
 */
export async function autocompleteSchema(
  sql: postgres.Sql,
): Promise<AutocompleteSchema> {
  // Get all tables
  const tables = await sql`
    SELECT
      schemaname as schema,
      tablename as name
    FROM pg_tables
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
    ORDER BY schemaname, tablename
  `;

  // Get all columns for those tables
  const columns = await sql`
    SELECT
      c.table_schema as schema,
      c.table_name as table,
      c.column_name as column
    FROM information_schema.columns c
    WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY c.table_schema, c.table_name, c.ordinal_position
  `;

  // Build schema map: { "schema.table": ["col1", "col2", ...] }
  const schemaMap: Record<string, string[]> = {};

  for (const col of columns) {
    const key = `${col.schema}.${col.table}`;
    if (!schemaMap[key]) {
      schemaMap[key] = [];
    }
    schemaMap[key].push(col.column as string);
  }

  return {
    tables: tables.map((t) => ({
      schema: t.schema as string,
      name: t.name as string,
    })),
    schemaMap,
  };
}

/**
 * Insert a row into a table and return the inserted row.
 */
export async function insertRow(
  sql: postgres.Sql,
  schema: string,
  table: string,
  data: Record<string, unknown>,
): Promise<{ row: unknown }> {
  const columns = Object.keys(data);

  if (columns.length === 0) {
    throw new Error("No data provided for insert");
  }

  // Build and execute insert query
  const result = await sql`
    INSERT INTO ${sql(schema)}.${sql(table)}
    ${sql(data)}
    RETURNING *
  `;

  return { row: result[0] };
}

/**
 * Update a row identified by its primary key and return the updated row.
 */
export async function updateRow(
  sql: postgres.Sql,
  schema: string,
  table: string,
  primaryKey: PrimaryKeyRef,
  data: Record<string, unknown>,
): Promise<{ row: unknown }> {
  if (Object.keys(data).length === 0) {
    throw new Error("No data provided for update");
  }

  // Build SET clause dynamically
  const pkValue = primaryKey.value as string | number;
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

/**
 * Delete a row identified by its primary key.
 */
export async function deleteRow(
  sql: postgres.Sql,
  schema: string,
  table: string,
  primaryKey: PrimaryKeyRef,
): Promise<void> {
  const pkValue = primaryKey.value as string | number;
  const result = await sql`
    DELETE FROM ${sql(schema)}.${sql(table)}
    WHERE ${sql(primaryKey.column)} = ${pkValue}
    RETURNING *
  `;

  if (result.length === 0) {
    throw new Error("Row not found");
  }
}
