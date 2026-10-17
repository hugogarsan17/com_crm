import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const root = path.resolve(__dirname, "../..");
const migrationsDir = path.join(root, "supabase/migrations");

/** Crea una base de datos en memoria con el stub de Supabase y todas las migraciones. */
export async function createTestDatabase() {
  const db = new PGlite();
  await db.exec(readFileSync(path.join(__dirname, "supabase-stub.sql"), "utf8"));
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    await db.exec(readFileSync(path.join(migrationsDir, file), "utf8"));
  }
  return db;
}

export type TestDb = Awaited<ReturnType<typeof createTestDatabase>>;

/** Crea un usuario en auth.users (dispara la creación del perfil). */
export async function createUser(db: TestDb, email: string, fullName?: string) {
  const res = await db.query<{ id: string }>(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
    [email, JSON.stringify(fullName ? { full_name: fullName } : {})],
  );
  return res.rows[0].id;
}

/** Ejecuta fn como el rol `authenticated` con el JWT del usuario indicado (RLS activa). */
export async function asUser<T>(db: TestDb, userId: string | null, fn: () => Promise<T>): Promise<T> {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
  await db.exec(userId ? "set role authenticated" : "set role anon");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}
