import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __docsAppPool: Pool | undefined;
}

// QUAN TRỌNG: KHÔNG kiểm tra/tạo Pool ngay khi import module (như bản cũ) - nếu làm vậy, lệnh
// `next build` sẽ CRASH TOÀN BỘ BUILD bất cứ khi nào DATABASE_URL không có mặt ở đúng thời điểm build
// (một số nền tảng như Netlify chỉ cấp biến môi trường cho phạm vi "Runtime", không có ở phạm vi
// "Build" trừ khi cấu hình đủ cả 2). Khi build lỗi, Netlify tự giữ nguyên bản deploy CŨ và im lặng -
// trông giống như "deploy xong nhưng chẳng có gì thay đổi". Sửa: chỉ tạo Pool (và chỉ báo lỗi thiếu
// biến môi trường) vào đúng lúc có truy vấn DB đầu tiên thực sự chạy (lúc runtime, không phải build).
function getPool(): Pool {
  if (globalThis.__docsAppPool) return globalThis.__docsAppPool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Thiếu biến môi trường DATABASE_URL (connection string PostgreSQL/Supabase)");
  }

  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
    max: 3, // giảm từ 10 -> 3: môi trường serverless (Netlify) có thể chạy nhiều container cùng lúc,
            // mỗi container 1 pool riêng - để 10 dễ vượt giới hạn kết nối đồng thời DB cho phép
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 8000, // timeout kết nối rõ ràng thay vì treo vô thời hạn
  });
  globalThis.__docsAppPool = pool;
  return pool;
}

// Giữ export `pool` để tương thích các chỗ import cũ (vd scripts/check-overdue.ts) - nhưng dùng
// Proxy để việc truy cập `pool.<gì đó>` vẫn chỉ khởi tạo kết nối thật vào đúng lúc dùng, không phải
// lúc import file.
export const pool: Pool = new Proxy({} as Pool, {
  get(_target, prop) {
    const real = getPool();
    const value = (real as any)[prop];
    return typeof value === "function" ? value.bind(real) : value;
  },
});

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
