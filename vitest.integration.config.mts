import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30_000,
    // Carga .env, .env.local y .env.test.local (sin exigir prefijo VITE_).
    env: { ...loadEnv(mode, process.cwd(), ""), ...loadEnv("test", process.cwd(), "") },
  },
}));
