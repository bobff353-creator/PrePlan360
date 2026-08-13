import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";
import { Pool } from "@neondatabase/serverless";

nextEnv.loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to deploy the PrePlan 360 schema.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const migrationsDirectory = path.join(process.cwd(), "drizzle");

function postgresStatement(statement) {
  const trimmed = statement.trim();
  if (!trimmed || /^PRAGMA\s+/i.test(trimmed)) return "";
  let sql = trimmed.replaceAll("`", '"');
  sql = sql.replace(/^CREATE TABLE\s+/i, "CREATE TABLE IF NOT EXISTS ");
  sql = sql.replace(/^CREATE UNIQUE INDEX\s+/i, "CREATE UNIQUE INDEX IF NOT EXISTS ");
  sql = sql.replace(/^CREATE INDEX\s+/i, "CREATE INDEX IF NOT EXISTS ");
  sql = sql.replace(/^(ALTER TABLE\s+"[^"]+"\s+ADD)\s+/i, "$1 COLUMN IF NOT EXISTS ");
  sql = sql.replace(/;\s*$/, "");
  if (/^INSERT INTO\s+"asset_events"/i.test(sql)) sql += " ON CONFLICT DO NOTHING";
  return sql;
}

const client = await pool.connect();
try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS preplan_schema_migrations (
      name text PRIMARY KEY,
      applied_at text NOT NULL
    )
  `);

  const applied = new Set(
    (await client.query("SELECT name FROM preplan_schema_migrations")).rows.map((row) => row.name),
  );
  const files = (await readdir(migrationsDirectory))
    .filter((file) => /^\d{4}_.+\.sql$/.test(file))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const source = await readFile(path.join(migrationsDirectory, file), "utf8");
    const statements = source.split("--> statement-breakpoint").map(postgresStatement).filter(Boolean);
    await client.query("BEGIN");
    try {
      for (const statement of statements) await client.query(statement);
      await client.query(
        "INSERT INTO preplan_schema_migrations (name,applied_at) VALUES ($1,$2)",
        [file, new Date().toISOString()],
      );
      await client.query("COMMIT");
      console.log(`Applied ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  client.release();
  await pool.end();
}
