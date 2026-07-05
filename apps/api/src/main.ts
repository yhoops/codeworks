/**
 * main.ts API 应用模块。
 * 作为 NestJS 应用入口或装配层，保持启动、健康检查与业务模块边界清晰。
 * 依赖：NestJS 应用基础设施；被用于：API 运行时与测试。
 */
import "reflect-metadata";

import { createApp } from "./app.js";

async function bootstrap() {
  const app = await createApp();
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;

  await app.listen(port);
}

void bootstrap();
