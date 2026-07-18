import { afterAll, expect, test } from "bun:test";

import {
  closeConnection,
  createConnection,
  getConnection,
} from "@/core/server/connectionManager";
import { runQuery } from "@/core/server/introspection";

/**
 * Integration test for read-only connections in core. Needs a real Postgres,
 * so it is gated on TEST_DATABASE_URL and skips (loudly) when it is absent, so
 * a skipped run is never mistaken for coverage.
 */

const databaseUrl = process.env.TEST_DATABASE_URL;

if (!databaseUrl) {
  console.warn(
    "read-only integration tests skipped: TEST_DATABASE_URL not set",
  );
}

let sessionId: string | null = null;

afterAll(async () => {
  if (sessionId) {
    await closeConnection(sessionId);
  }
});

test.skipIf(!databaseUrl)(
  "read-only connection rejects writes with a clean message",
  async () => {
    if (!databaseUrl) return;

    const { sessionId: id } = await createConnection(databaseUrl, {
      readOnly: true,
    });
    sessionId = id;

    const sql = getConnection(id);
    if (!sql) throw new Error("connection not found after createConnection");

    // Reads still work on a read-only connection
    const read = await runQuery(sql, "SELECT 1 as one");
    expect(read.rows[0]?.one).toBe(1);

    // Writes are rejected at the Postgres level and surface the clean message
    await expect(
      runQuery(sql, "CREATE TEMP TABLE nectar_readonly_probe (id integer)"),
    ).rejects.toThrow("This connection is read-only");
  },
);
