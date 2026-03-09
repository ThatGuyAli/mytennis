import { Pool, type QueryResultRow } from "pg";

declare global {
  var __dbPool: Pool | undefined;
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set.");
}

export const db =
  global.__dbPool ??
  new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });

if (process.env.NODE_ENV !== "production") {
  global.__dbPool = db;
}

export async function query<T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
) {
  return db.query<T>(text, params);
}
