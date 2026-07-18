/**
 * Database type definitions for Nectar.
 */

/**
 * Information about a database table.
 */
export interface TableInfo {
  schema: string;
  name: string;
  rowCount: number;
}

/**
 * Foreign key reference information.
 */
export interface ForeignKeyInfo {
  table: string;
  column: string;
}

/**
 * Information about a table column.
 */
export interface ColumnInfo {
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
export interface TableSchema {
  schema: string;
  tableName: string;
  columns: ColumnInfo[];
}

/**
 * Result from executing an arbitrary SQL query.
 */
export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTime: number;
}

/**
 * Connection status response.
 */
export interface ConnectionStatus {
  connected: boolean;
  database?: string;
  host?: string;
}
