import "server-only";
import { Pool, type PoolClient } from "pg";

declare global {
  // Stable across hot reloads in development; Vercel instances are independent.
  var osaJeffPool: Pool | undefined;
}
export function pool(): Pool {
  if (!process.env.DATABASE_URL) throw Error("DATABASE_NOT_CONFIGURED");
  if (!globalThis.osaJeffPool) {
    const url = new URL(process.env.DATABASE_URL);
    if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") throw Error("DATABASE_URL_INVALID");
    // Do not allow unencrypted remote connections.
    const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (!local && url.searchParams.get("sslmode") !== "verify-full") {
      throw Error("DATABASE_TLS_REQUIRED");
    }
    globalThis.osaJeffPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 4,
      connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 20000,
      ...(local ? {} : { ssl: { rejectUnauthorized: true } }),
    });
  }
  return globalThis.osaJeffPool;
}
export async function scoped<T>(userId: string, action: (db: PoolClient) => Promise<T>): Promise<T> {
  if (!userId || userId.length > 100) throw Error("INVALID_USER_ID");
  const db = await pool().connect();
  try {
    await db.query("BEGIN");
    await db.query("SELECT set_config('app.user_id', $1, true)", [userId]);
    const result = await action(db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    db.release();
  }
}
