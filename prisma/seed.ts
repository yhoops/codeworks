/**
 * Prisma seed CLI 入口。
 * 具体演示数据写入由 prisma/seed/index.ts 编排，当前文件只保留稳定导出和 CLI 启动行为。
 * 依赖：seedDemoData；被用于：pnpm db:seed 与测试导入。
 */
import { pathToFileURL } from "node:url";
import {
  DEMO_LOGIN,
  type DemoSeedResult,
  seedDemoData
} from "./seed/index.js";

export { DEMO_LOGIN, seedDemoData };
export type { DemoSeedResult };

async function main() {
  await seedDemoData();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
