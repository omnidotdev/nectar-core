/**
 * Database type definitions for Nectar.
 */
/**
 * Information about a database table.
 */
interface TableInfo {
    schema: string;
    name: string;
    rowCount: number;
}
/**
 * Foreign key reference information.
 */
interface ForeignKeyInfo {
    table: string;
    column: string;
}
/**
 * Information about a table column.
 */
interface ColumnInfo {
    name: string;
    type: string;
    nullable: boolean;
    default: string | null;
    isPrimaryKey: boolean;
    isUnique: boolean;
    foreignKey?: ForeignKeyInfo;
}
/**
 * Complete schema information for a table.
 */
interface TableSchema {
    schema: string;
    tableName: string;
    columns: ColumnInfo[];
}
/**
 * Result from executing an arbitrary SQL query.
 */
interface QueryResult {
    columns: string[];
    rows: Record<string, unknown>[];
    rowCount: number;
    executionTime: number;
}
/**
 * Connection status response.
 */
interface ConnectionStatus {
    connected: boolean;
    database?: string;
    host?: string;
}

interface TableFilter {
    column: string;
    operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike" | "is_null" | "is_not_null";
    value?: string;
}
interface TableDataParams {
    schema: string;
    table: string;
    page?: number;
    pageSize?: number;
    sortColumn?: string;
    sortDirection?: "asc" | "desc";
    filters?: TableFilter[];
}
interface TableDataResult {
    rows: Record<string, unknown>[];
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
}
interface PrimaryKeyRef {
    column: string;
    value: unknown;
}
interface AutocompleteSchema {
    tables: {
        schema: string;
        name: string;
    }[];
    schemaMap: Record<string, string[]>;
}
/** Capabilities the mounting host advertises to the UI (e.g. hide write UI when read-only). */
interface NectarCapabilities {
    /** When false, the UI hides Add/Edit/Delete and the SQL editor runs read-only. */
    writable: boolean;
}
/**
 * The single seam between Nectar's UI and any backend. The standalone app and the
 * Fractal embed each provide a concrete implementation; components never import
 * server functions directly.
 */
interface NectarDataSource {
    readonly capabilities: NectarCapabilities;
    getConnectionStatus(): Promise<ConnectionStatus>;
    getTables(): Promise<TableInfo[]>;
    getTableSchema(schema: string, table: string): Promise<TableSchema>;
    getTableData(params: TableDataParams): Promise<TableDataResult>;
    /** `schemaMap` is keyed by the `"schema.table"` convention. */
    getSchemaForAutocompletion(): Promise<AutocompleteSchema>;
    /** Runs arbitrary SQL; a `writable: false` backend is expected to reject writes. */
    executeQuery(query: string): Promise<QueryResult>;
    /** Returns only `{ row }` by contract; the backing `{ success, row }` drops `success`. */
    insertRow(schema: string, table: string, data: Record<string, unknown>): Promise<{
        row: unknown;
    }>;
    /** Returns only `{ row }` by contract; the backing `{ success, row }` drops `success`. */
    updateRow(schema: string, table: string, primaryKey: PrimaryKeyRef, data: Record<string, unknown>): Promise<{
        row: unknown;
    }>;
    deleteRow(schema: string, table: string, primaryKey: PrimaryKeyRef): Promise<void>;
}

export type { AutocompleteSchema as A, ColumnInfo as C, ForeignKeyInfo as F, NectarDataSource as N, PrimaryKeyRef as P, QueryResult as Q, TableDataParams as T, TableDataResult as a, TableFilter as b, TableSchema as c, TableInfo as d, ConnectionStatus as e, NectarCapabilities as f };
