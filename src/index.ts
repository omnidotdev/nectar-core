/**
 * Client-safe barrel for @omnidotdev/nectar-core.
 *
 * Exposes the presentational components, the DataSource contract, and the
 * TanStack Query option factories. This module never imports the server-only
 * connection manager or `postgres`; those live behind
 * `@omnidotdev/nectar-core/server`.
 */

export { DataGrid } from "@/components/db/DataGrid";
export { QueryInterface } from "@/components/db/QueryInterface";
export { SchemaViewer } from "@/components/db/SchemaViewer";
export { SchemaProvider, useSchema } from "@/contexts/SchemaContext";
export {
  NectarProvider,
  useNectarDataSource,
} from "@/core/data/NectarProvider";
export {
  tableDataOptions,
  tableSchemaOptions,
  tablesOptions,
} from "@/options/db.options";

export type {
  AutocompleteSchema,
  NectarCapabilities,
  NectarDataSource,
  PrimaryKeyRef,
  TableDataParams,
  TableDataResult,
  TableFilter,
} from "@/core/data/DataSource";
export type {
  ColumnInfo,
  ConnectionStatus,
  ForeignKeyInfo,
  QueryResult,
  TableInfo,
  TableSchema,
} from "@/types/database";
