/**
 * Server-only barrel for @omnidotdev/nectar-core.
 *
 * This is the ONLY module reachable path that imports `postgres`. Import it
 * from server contexts only (TanStack server functions, Fractal embed backend),
 * never from client bundles.
 */

export {
  cleanupIdleConnections,
  closeConnection,
  createConnection,
  getConnection,
  getConnectionInfo,
  hasConnection,
} from "@/core/server/connectionManager";
export {
  asSerializableRow,
  asSerializableRows,
  autocompleteSchema,
  deleteRow,
  describeTable,
  insertRow,
  listTables,
  readTableData,
  runQuery,
  updateRow,
} from "@/core/server/introspection";

export type { SerializableRow } from "@/core/server/introspection";
