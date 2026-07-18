import { nanoid } from "nanoid";
import postgres from "postgres";

/**
 * Connection entry stored in memory.
 */
interface ConnectionEntry {
  sql: postgres.Sql;
  connectionString: string;
  readOnly: boolean;
  createdAt: Date;
  lastUsedAt: Date;
}

/**
 * In-memory connection storage.
 * Maps session IDs to PostgreSQL connections.
 */
const connections = new Map<string, ConnectionEntry>();

/**
 * Connection timeout in milliseconds (30 minutes).
 */
const CONNECTION_TIMEOUT_MS = 30 * 60 * 1000;

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
export async function createConnection(
  connectionString: string,
  opts?: { readOnly?: boolean },
): Promise<{ sessionId: string; database: string; host: string }> {
  const readOnly = opts?.readOnly ?? false;

  // Validate connection by attempting to connect
  const sql = postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    // When read-only, set the GUC as a startup option so it applies pool-wide
    // A SET after connect would only affect one pooled connection, so use the
    // connection startup parameter instead
    ...(readOnly
      ? { connection: { options: "-c default_transaction_read_only=on" } }
      : {}),
  });

  // Test the connection
  try {
    const result =
      await sql`SELECT current_database() as database, current_user as user`;
    const database = result[0]?.database as string;

    // Parse host from connection string
    const hostMatch = connectionString.match(/@([^:/]+)/);
    const host = hostMatch?.[1] || "localhost";

    // Generate session ID and store connection
    const sessionId = nanoid(32);
    connections.set(sessionId, {
      sql,
      connectionString,
      readOnly,
      createdAt: new Date(),
      lastUsedAt: new Date(),
    });

    return { sessionId, database, host };
  } catch (error) {
    // Close the connection on failure
    await sql.end();
    throw error;
  }
}

/**
 * Gets an existing connection by session ID.
 * Updates the last used timestamp.
 */
export function getConnection(sessionId: string): postgres.Sql | null {
  const entry = connections.get(sessionId);
  if (!entry) return null;

  // Update last used timestamp
  entry.lastUsedAt = new Date();
  return entry.sql;
}

/**
 * Checks if a session has an active connection.
 */
export function hasConnection(sessionId: string): boolean {
  return connections.has(sessionId);
}

/**
 * Gets connection info for a session.
 */
export function getConnectionInfo(
  sessionId: string,
): { database: string; host: string } | null {
  const entry = connections.get(sessionId);
  if (!entry) return null;

  // Parse database and host from connection string
  const hostMatch = entry.connectionString.match(/@([^:/]+)/);
  const dbMatch = entry.connectionString.match(/\/([^?]+)/);

  return {
    host: hostMatch?.[1] || "localhost",
    database: dbMatch?.[1] || "unknown",
  };
}

/**
 * Closes and removes a connection by session ID.
 */
export async function closeConnection(sessionId: string): Promise<void> {
  const entry = connections.get(sessionId);
  if (entry) {
    await entry.sql.end();
    connections.delete(sessionId);
  }
}

/**
 * Cleans up idle connections that have exceeded the timeout.
 */
export async function cleanupIdleConnections(): Promise<void> {
  const now = Date.now();

  for (const [sessionId, entry] of connections.entries()) {
    if (now - entry.lastUsedAt.getTime() > CONNECTION_TIMEOUT_MS) {
      await entry.sql.end();
      connections.delete(sessionId);
    }
  }
}

// Run cleanup every 5 minutes. unref() so this reaper never keeps the host
// process alive on its own, since this module will later be shared with the
// Fractal embed as well as the standalone app
const cleanupTimer = setInterval(
  () => {
    cleanupIdleConnections().catch(console.error);
  },
  5 * 60 * 1000,
);
cleanupTimer.unref?.();
