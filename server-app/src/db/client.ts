import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
}

// Supabase transaction pooler (port 6543):
// - no prepared statements (prepare: false)
// - no query pipelining: with max_pipeline > 1, concurrent queries on one connection hang (max_pipeline: 1)
// Keep one client per server instance (also across hot reloads in dev).
const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres> };
const client = globalForDb.pgClient ?? postgres(url, { prepare: false, max: 3, max_pipeline: 1 });
if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, { schema });
