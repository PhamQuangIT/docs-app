import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __docsAppPool: Pool | undefined;
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Thiếu biến môi trường DATABASE_URL (connection string PostgreSQL/Supabase)");
}

export const pool: Pool =
  globalThis.__docsAppPool ??
  new Pool({
    connectionString,
    ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__docsAppPool = pool;
}

// ---- Chuyển named params kiểu ":name" (SQLite-style) sang "$1, $2..." (Postgres-style) ----
// Giữ nguyên cách gọi all(sql, {key: value}) ở toàn bộ API routes để không phải viết lại query.
function toPositional(sql: string, params: Record<string, any>): { text: string; values: any[] } {
  const values: any[] = [];
  const text = sql.replace(/(?<!:):([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, name) => {
    if (!(name in params)) {
      throw new Error(`Thiếu tham số :${name} cho câu query`);
    }
    values.push(params[name]);
    return `$${values.length}`;
  });
  return { text, values };
}

export async function all<T = any>(sql: string, params: Record<string, any> = {}): Promise<T[]> {
  const { text, values } = toPositional(sql, params);
  const res = await pool.query(text, values);
  return res.rows as T[];
}

export async function get<T = any>(sql: string, params: Record<string, any> = {}): Promise<T | undefined> {
  const rows = await all<T>(sql, params);
  return rows[0];
}

export async function run(sql: string, params: Record<string, any> = {}) {
  const { text, values } = toPositional(sql, params);
  const res = await pool.query(text, values);
  return { changes: res.rowCount, rows: res.rows };
}

export function nowIso(): string {
  return new Date().toISOString();
}
