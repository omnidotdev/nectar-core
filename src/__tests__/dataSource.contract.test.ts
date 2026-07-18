import { beforeEach, expect, test } from "bun:test";

import type { NectarDataSource, PrimaryKeyRef } from "../core/data/DataSource";

// Stateful in-memory fake proving the interface is complete enough to browse + mutate
const makeFake = (): NectarDataSource => {
  const store: Record<string, unknown>[] = [];

  const findIndex = (primaryKey: PrimaryKeyRef) =>
    store.findIndex((row) => row[primaryKey.column] === primaryKey.value);

  return {
    capabilities: { writable: true },
    getConnectionStatus: async () => ({
      connected: true,
      database: "d",
      host: "h",
    }),
    getTables: async () => [
      { schema: "public", name: "t", rowCount: store.length },
    ],
    getTableSchema: async (schema, table) => ({
      schema,
      tableName: table,
      columns: [],
    }),
    getTableData: async ({ page = 0, pageSize = 50 }) => ({
      rows: store.slice(page * pageSize, page * pageSize + pageSize),
      totalCount: store.length,
      page,
      pageSize,
      totalPages: Math.ceil(store.length / pageSize),
    }),
    getSchemaForAutocompletion: async () => ({ tables: [], schemaMap: {} }),
    executeQuery: async () => ({
      columns: [],
      rows: [],
      rowCount: 0,
      executionTime: 0,
    }),
    insertRow: async (_schema, _table, data) => {
      const row = { ...data };
      store.push(row);
      return { row };
    },
    updateRow: async (_schema, _table, primaryKey, data) => {
      const index = findIndex(primaryKey);
      const row = { ...store[index], ...data };
      store[index] = row;
      return { row };
    },
    deleteRow: async (_schema, _table, primaryKey) => {
      const index = findIndex(primaryKey);
      store.splice(index, 1);
    },
  };
};

let fake: NectarDataSource;

beforeEach(() => {
  fake = makeFake();
});

test("data source satisfies the browse contract", async () => {
  expect((await fake.getTables())[0]?.name).toBe("t");
  const data = await fake.getTableData({ schema: "public", table: "t" });
  expect(data.page).toBe(0);
});

test("insert then read reflects the new row", async () => {
  await fake.insertRow("public", "t", { id: 1, name: "alice" });

  const data = await fake.getTableData({ schema: "public", table: "t" });
  expect(data.totalCount).toBe(1);
  expect(data.rows[0]?.name).toBe("alice");
  expect((await fake.getTables())[0]?.rowCount).toBe(1);
});

test("delete then read reflects the removal", async () => {
  await fake.insertRow("public", "t", { id: 1, name: "alice" });
  await fake.deleteRow("public", "t", { column: "id", value: 1 });

  const data = await fake.getTableData({ schema: "public", table: "t" });
  expect(data.totalCount).toBe(0);
  expect(data.rows).toHaveLength(0);
});
