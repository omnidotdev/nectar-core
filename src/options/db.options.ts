import { queryOptions } from "@tanstack/react-query";

import type {
  NectarDataSource,
  TableDataParams,
  TableFilter,
} from "@/core/data/DataSource";

// Re-exported so existing importers (e.g. DataGrid) keep a single source of truth
export type { TableDataParams, TableFilter };

/**
 * Query options for fetching the list of tables.
 */
export const tablesOptions = (ds: NectarDataSource) =>
  queryOptions({
    queryKey: ["db", "tables"],
    queryFn: () => ds.getTables(),
  });

/**
 * Query options for fetching a table's schema.
 */
export const tableSchemaOptions = (
  ds: NectarDataSource,
  schema: string,
  table: string,
) =>
  queryOptions({
    queryKey: ["db", "schema", schema, table],
    queryFn: () => ds.getTableSchema(schema, table),
    enabled: !!schema && !!table,
  });

/**
 * Query options for fetching paginated table data with sorting and filtering.
 */
export const tableDataOptions = (
  ds: NectarDataSource,
  {
    schema,
    table,
    page = 0,
    pageSize = 50,
    sortColumn,
    sortDirection,
    filters,
  }: TableDataParams,
) =>
  queryOptions({
    queryKey: [
      "db",
      "data",
      schema,
      table,
      page,
      pageSize,
      sortColumn,
      sortDirection,
      filters,
    ],
    queryFn: () =>
      ds.getTableData({
        schema,
        table,
        page,
        pageSize,
        sortColumn,
        sortDirection,
        filters,
      }),
    enabled: !!schema && !!table,
  });
