/**
 * Playwright 端到端测试配置。
 * 统一 Web/API 本地服务与测试数据库地址，让浏览器验证走真实主线而非单测替身。
 * 依赖：Playwright test runner；被用于：pnpm test:e2e。
 */
import { defineConfig } from "@playwright/test";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://codeworks@127.0.0.1:55432/codeworks?schema=public";

export default defineConfig({
  testDir: "./apps/web/e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5173"
  },
  webServer: [
    {
      command: "pnpm --filter @codeworks/api dev",
      env: {
        DATABASE_URL: databaseUrl,
        PORT: "3100"
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      url: "http://127.0.0.1:3100/health"
    },
    {
      command: "pnpm --filter @codeworks/web dev --host 127.0.0.1 --port 5173",
      env: {
        CODEWORKS_API_ORIGIN: "http://127.0.0.1:3100"
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      url: "http://127.0.0.1:5173/login"
    }
  ]
});
