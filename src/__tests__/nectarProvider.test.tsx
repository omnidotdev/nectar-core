import { expect, test } from "bun:test";

import { renderToStaticMarkup } from "react-dom/server";

import {
  NectarProvider,
  useNectarDataSource,
} from "@/core/data/NectarProvider";

import type { NectarDataSource } from "@/core/data/DataSource";

const makeFake = (): NectarDataSource => ({
  capabilities: { writable: true },
  getConnectionStatus: async () => ({
    connected: true,
    database: "d",
    host: "h",
  }),
  getTables: async () => [],
  getTableSchema: async (schema, table) => ({
    schema,
    tableName: table,
    columns: [],
  }),
  getTableData: async ({ page = 0, pageSize = 50 }) => ({
    rows: [],
    totalCount: 0,
    page,
    pageSize,
    totalPages: 0,
  }),
  getSchemaForAutocompletion: async () => ({ tables: [], schemaMap: {} }),
  executeQuery: async () => ({
    columns: [],
    rows: [],
    rowCount: 0,
    executionTime: 0,
  }),
  insertRow: async (_schema, _table, data) => ({ row: { ...data } }),
  updateRow: async (_schema, _table, _primaryKey, data) => ({
    row: { ...data },
  }),
  deleteRow: async () => {},
});

test("useNectarDataSource throws when used outside a NectarProvider", () => {
  const Consumer = () => {
    useNectarDataSource();
    return null;
  };

  expect(() => renderToStaticMarkup(<Consumer />)).toThrow(/NectarProvider/);
});

test("useNectarDataSource returns the provided data source", () => {
  const fake = makeFake();
  const holder: { value: NectarDataSource | null } = { value: null };

  const Consumer = () => {
    holder.value = useNectarDataSource();
    return null;
  };

  renderToStaticMarkup(
    <NectarProvider dataSource={fake}>
      <Consumer />
    </NectarProvider>,
  );

  expect(holder.value).toBe(fake);
});
