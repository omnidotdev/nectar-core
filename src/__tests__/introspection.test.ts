import { afterAll, expect, test } from "bun:test";

import postgres from "postgres";

import {
  deleteRow,
  describeTable,
  insertRow,
  listTables,
  readTableData,
  runQuery,
  updateRow,
} from "../core/server/introspection";

/**
 * Integration contract test for the framework-neutral introspection core.
 * These need a real Postgres, so they are gated on TEST_DATABASE_URL and skip
 * (loudly) when it is absent, so a skipped run is never mistaken for coverage.
 */

const databaseUrl = process.env.TEST_DATABASE_URL;

if (!databaseUrl) {
  console.warn(
    "introspection integration tests skipped: TEST_DATABASE_URL not set",
  );
}

const sql = databaseUrl ? postgres(databaseUrl) : null;

// Uniquely named table so parallel runs never collide
const schema = "public";
const table = `nectar_introspection_test_${Date.now()}`;

afterAll(async () => {
  if (sql) {
    try {
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.${sql(table)}`;
    } finally {
      await sql.end();
    }
  }
});

test.skipIf(!sql)("introspection round trip", async () => {
  if (!sql) return;

  await sql`
    CREATE TABLE ${sql(schema)}.${sql(table)} (
      id integer PRIMARY KEY,
      name text NOT NULL
    )
  `;

  // listTables includes the new table
  const tables = await listTables(sql);
  expect(tables.some((t) => t.schema === schema && t.name === table)).toBe(
    true,
  );

  // describeTable returns its columns and primary key
  const described = await describeTable(sql, schema, table);
  expect(described.tableName).toBe(table);
  const idColumn = described.columns.find((c) => c.name === "id");
  expect(idColumn?.isPrimaryKey).toBe(true);
  expect(described.columns.map((c) => c.name)).toEqual(["id", "name"]);

  // insertRow then readTableData reflects the row
  const inserted = await insertRow(sql, schema, table, {
    id: 1,
    name: "alice",
  });
  expect((inserted.row as { name: string }).name).toBe("alice");

  const afterInsert = await readTableData(sql, { schema, table });
  expect(afterInsert.totalCount).toBe(1);
  expect(afterInsert.rows[0]?.name).toBe("alice");

  // updateRow changes the row and readTableData reflects it
  const updated = await updateRow(
    sql,
    schema,
    table,
    { column: "id", value: 1 },
    { name: "bob" },
  );
  expect((updated.row as { name: string }).name).toBe("bob");

  const afterUpdate = await readTableData(sql, { schema, table });
  expect(afterUpdate.rows[0]?.name).toBe("bob");

  // runQuery executes arbitrary SQL and returns rows
  const queried = await runQuery(sql, "SELECT 1 as one");
  expect(queried.rowCount).toBe(1);
  expect(queried.rows[0]?.one).toBe(1);

  // deleteRow removes it
  await deleteRow(sql, schema, table, { column: "id", value: 1 });
  const afterDelete = await readTableData(sql, { schema, table });
  expect(afterDelete.totalCount).toBe(0);
});
