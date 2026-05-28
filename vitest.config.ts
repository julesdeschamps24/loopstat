import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "worker/**/*.test.ts"],
    // Many test files implicitly open a Postgres connection on module import
    // (via `@/db/client`). Running them in parallel exhausts the dev pool
    // (5s timeouts on ~28 parallel files). Serial = slower but reliable.
    // pool: "forks" isolates each file in its own subprocess so the DB
    // connection is fully released between files.
    // Future improvement : mock `@/db/client` in smoke tests + re-enable.
    fileParallelism: false,
    // Some smoke tests hit the dev Postgres (via `@/db/client` import).
    // When the worker is busy enriching catalog rows in parallel, simple
    // SELECTs can briefly stall past the 5s default. 15s is large enough
    // to ride out worker load without hiding real bugs.
    testTimeout: 15000,
    env: {
      // Provide a harmless default so module-level env checks (DATABASE_URL)
      // don't throw at import time. Individual tests override via vi.stubEnv.
      DATABASE_URL: "postgres://loopstat:loopstat@127.0.0.1:5432/loopstat",
    },
  },
});
