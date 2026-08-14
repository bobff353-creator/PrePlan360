import nextEnv from "@next/env";
import { Pool } from "@neondatabase/serverless";

nextEnv.loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('department_integrations','department_export_deliveries') ORDER BY table_name");
  const expected = ["department_export_deliveries", "department_integrations"];
  const actual = tables.rows.map((row) => row.table_name);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Integration schema incomplete: ${actual.join(", ") || "no tables"}`);
  const migration = await pool.query("SELECT applied_at FROM preplan_schema_migrations WHERE name='0016_department_integrations.sql'");
  if (migration.rowCount !== 1) throw new Error("Integration migration is not recorded.");
  console.log(`Integration schema verified: ${actual.join(", ")} · migration 0016 recorded.`);
} finally {
  await pool.end();
}
