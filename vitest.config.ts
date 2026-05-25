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
    env: {
      // Provide harmless defaults so module-level env checks (DATABASE_URL,
      // TOKEN_ENC_KEY) don't throw at import time. Individual tests override
      // these via vi.stubEnv when needed.
      DATABASE_URL: "postgres://loopstat:loopstat@127.0.0.1:5432/loopstat",
      TOKEN_ENC_KEY:
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    },
  },
});
