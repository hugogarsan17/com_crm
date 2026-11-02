import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const root = path.resolve(__dirname, "../..");
const migrationsDir = path.join(root, "supabase/migrations");

// pg_net y pg_cron no existen en PGlite; el stub emula cron/vault y estas sentencias se omiten.
const PLATFORM_EXTENSION_RE = /^\s*(?:create|drop)\s+extension\b[^;]*\b(?:pg_net|pg_cron)\b[^;]*;/gim;

function readMigration(file: string) {
  return readFileSync(path.join(migrationsDir, file), "utf8").replace(PLATFORM_EXTENSION_RE, "-- (omitido en PGlite)");
}

function migrationFiles() {
  return readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
}

/**
 * Crea una base de datos en memoria con el stub de Supabase y las migraciones.
 * Con `before`, solo aplica las migraciones anteriores a ese prefijo (para probar
 * la transformación de datos existentes con applyMigrationsFrom).
 */
export async function createTestDatabase(options: { before?: string } = {}) {
  const db = new PGlite();
  await db.exec(readFileSync(path.join(__dirname, "supabase-stub.sql"), "utf8"));
  for (const file of migrationFiles()) {
    if (options.before && file >= options.before) break;
    await db.exec(readMigration(file));
  }
  return db;
}

/** Aplica las migraciones a partir del prefijo indicado (incluido). */
export async function applyMigrationsFrom(db: PGlite, from: string) {
  for (const file of migrationFiles()) {
    if (file >= from) await db.exec(readMigration(file));
  }
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
