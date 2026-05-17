import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// During `next build`, Next 16 imports each route module to collect metadata.
// At that point env vars are intentionally not set. postgres-js is lazy (no
// connection until the first query), so a placeholder URL keeps module-load
// side-effect-free. At runtime, docker-compose enforces DATABASE_URL via
// `${POSTGRES_PASSWORD:?...}`, so the placeholder is never actually used.
const url =
  process.env.DATABASE_URL ??
  "postgres://placeholder:placeholder@placeholder:5432/placeholder";

// Cache du pool postgres-js sur globalThis pour survivre au HMR Next : sans
// ça, chaque hot-reload ré-instancie un pool (max=10) sans fermer le
// précédent, et Postgres finit par renvoyer "too many clients already".
// Pareil pour BullMQ dans worker/queue.ts.
const globalForDb = globalThis as unknown as {
  __pgQueryClient?: ReturnType<typeof postgres>;
};

const queryClient =
  globalForDb.__pgQueryClient ?? postgres(url, { max: 10 });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__pgQueryClient = queryClient;
}

export const db = drizzle(queryClient, { schema, casing: "snake_case" });
export type DB = typeof db;
