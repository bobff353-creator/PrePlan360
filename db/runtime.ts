import { Pool, type PoolClient } from "@neondatabase/serverless";

type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

export type RunResult = { meta: { changes: number } };
export type AllResult<T> = { results: T[] };

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("PrePlan 360 database is not connected.");
    pool = new Pool({ connectionString });
  }
  return pool;
}

function postgresSql(sql: string): string {
  let parameter = 0;
  const ignoreConflict = /INSERT\s+OR\s+IGNORE\s+INTO/i.test(sql);
  const converted = sql
    .replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, "INSERT INTO")
    .replace(/\?/g, () => `$${++parameter}`);
  return ignoreConflict
    ? converted.replace(/(VALUES\s*\([^;]+\))(\s*)$/i, "$1 ON CONFLICT DO NOTHING$2")
    : converted;
}

export class PreparedStatement {
  private values: unknown[] = [];

  constructor(readonly sql: string) {}

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async first<T>(): Promise<T | null> {
    const result = await this.execute(getPool());
    return (result.rows[0] as T | undefined) ?? null;
  }

  async all<T>(): Promise<AllResult<T>> {
    const result = await this.execute(getPool());
    return { results: result.rows as T[] };
  }

  async run(): Promise<RunResult> {
    const result = await this.execute(getPool());
    return { meta: { changes: result.rowCount ?? 0 } };
  }

  execute(client: Queryable) {
    return client.query(postgresSql(this.sql), this.values);
  }
}

export function database() {
  return {
    prepare(sql: string) {
      return new PreparedStatement(sql);
    },
    async batch(statements: PreparedStatement[]): Promise<RunResult[]> {
      const client = await getPool().connect();
      try {
        await client.query("BEGIN");
        const results: RunResult[] = [];
        for (const statement of statements) {
          const result = await statement.execute(client);
          results.push({ meta: { changes: result.rowCount ?? 0 } });
        }
        await client.query("COMMIT");
        return results;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
