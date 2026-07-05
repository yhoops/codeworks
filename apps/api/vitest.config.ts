/**
 * vitest 测试或构建配置。
 * 将 runner/build 入口约束在应用目录内，保证 workspace 脚本按包边界执行。
 * 依赖：Vite/Vitest；被用于：包级 test 与 build 命令。
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.spec.ts"]
  }
});
