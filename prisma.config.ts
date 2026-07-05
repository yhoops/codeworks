/**
 * Prisma CLI 配置入口。
 * 把 schema 与迁移命令的加载点固定在仓库根，避免各脚本重复拼接数据库配置。
 * 依赖：Prisma CLI；被用于：db:generate、db:migrate 与 db:seed。
 */
import "dotenv/config";

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts"
  }
});
