/**
 * vite 测试或构建配置。
 * 将 runner/build 入口约束在应用目录内，保证 workspace 脚本按包边界执行。
 * 依赖：Vite/Vitest；被用于：包级 test 与 build 命令。
 */
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
        target: process.env.CODEWORKS_API_ORIGIN ?? "http://127.0.0.1:3000"
      }
    }
  },
  test: {
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        url: "http://localhost/"
      }
    },
    include: ["src/**/*.{test,spec}.{ts,tsx}"]
  }
});
