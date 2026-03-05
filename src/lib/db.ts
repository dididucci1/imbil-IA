import { Pool, type QueryResult, type QueryResultRow } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("DATABASE_URL não definida. Configure o .env.local para uso do Neon.");
}

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

const pool =
  global.__pgPool ??
  new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

if (process.env.NODE_ENV !== "production") {
  global.__pgPool = pool;
}

export async function dbQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export { pool };
