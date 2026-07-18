import postgres from 'postgres';
import { A as AutocompleteSchema, P as PrimaryKeyRef, c as TableSchema, d as TableInfo, T as TableDataParams, a as TableDataResult, Q as QueryResult } from './DataSource-DN5ZduHE.js';

/**
 * Creates a new database connection and returns a session ID.
 *
 * When `opts.readOnly` is set, the pool is opened with
 * `default_transaction_read_only` as a pool-wide startup GUC. This prevents
 * ACCIDENTAL writes, but it is NOT a hard security boundary: the GUC is a soft
 * (USERSET) setting, and `runQuery` uses the simple (multi-statement) query
 * protocol, so a caller who controls the SQL can bypass it (e.g.
 * `SET default_transaction_read_only = off; ...`). For a HARD read-only
 * guarantee, connect to a physically read-only endpoint (e.g. a read replica)
 * or use a `GRANT SELECT`-only role. Note also that the `options=` startup
 * parameter may be rejected by pgbouncer in transaction/statement pooling mode.
 */
declare function createConnection(connectionString: string, opts?: {
    readOnly?: boolean;
}): Promise<{
    sessionId: string;
    database: string;
    host: string;
}>;
/**
 * Gets an existing connection by session ID.
 * Updates the last used timestamp.
 */
declare function getConnection(sessionId: string): postgres.Sql | null;
/**
 * Checks if a session has an active connection.
 */
declare function hasConnection(sessionId: string): boolean;
/**
 * Gets connection info for a session.
 */
declare function getConnectionInfo(sessionId: string): {
    database: string;
    host: string;
} | null;
/**
 * Closes and removes a connection by session ID.
 */
declare function closeConnection(sessionId: string): Promise<void>;
/**
 * Cleans up idle connections that have exceeded the timeout.
 */
declare function cleanupIdleConnections(): Promise<void>;

/**
 * Framework-neutral database introspection and data operations.
 * Each function takes a `postgres.Sql` connection plus params and returns the
 * typed shapes shared by every backend. These are lifted verbatim out of the
 * TanStack server functions so the standalone app and the Fractal embed can
 * share them.
 */
/** The serializable row shape TanStack's createServerFn wire requires; the single place the honest-but-wide core row type is narrowed. */
type SerializableRow = Record<string, string | number | boolean | null>;
declare const asSerializableRows: (rows: Record<string, unknown>[]) => SerializableRow[];
declare const asSerializableRow: (row: unknown) => SerializableRow;
/**
 * List all tables from public and user schemas (excluding system schemas)
 * with per-table row counts.
 */
declare function listTables(sql: postgres.Sql): Promise<TableInfo[]>;
/**
 * Describe a single table: columns with primary key, unique, and foreign key
 * metadata assembled.
 */
declare function describeTable(sql: postgres.Sql, schema: string, table: string): Promise<TableSchema>;
/**
 * Read paginated table data with optional filters and sorting.
 */
declare function readTableData(sql: postgres.Sql, params: TableDataParams): Promise<TableDataResult>;
/**
 * Execute an arbitrary SQL query and return its columns, rows, and timing.
 */
declare function runQuery(sql: postgres.Sql, query: string): Promise<QueryResult>;
/**
 * Build the autocompletion schema: table list plus a `"schema.table" -> columns`
 * map.
 */
declare function autocompleteSchema(sql: postgres.Sql): Promise<AutocompleteSchema>;
/**
 * Insert a row into a table and return the inserted row.
 */
declare function insertRow(sql: postgres.Sql, schema: string, table: string, data: Record<string, unknown>): Promise<{
    row: unknown;
}>;
/**
 * Update a row identified by its primary key and return the updated row.
 */
declare function updateRow(sql: postgres.Sql, schema: string, table: string, primaryKey: PrimaryKeyRef, data: Record<string, unknown>): Promise<{
    row: unknown;
}>;
/**
 * Delete a row identified by its primary key.
 */
declare function deleteRow(sql: postgres.Sql, schema: string, table: string, primaryKey: PrimaryKeyRef): Promise<void>;

export { type SerializableRow, asSerializableRow, asSerializableRows, autocompleteSchema, cleanupIdleConnections, closeConnection, createConnection, deleteRow, describeTable, getConnection, getConnectionInfo, hasConnection, insertRow, listTables, readTableData, runQuery, updateRow };
