/**
 * app.ts API 应用模块。
 * 作为 NestJS 应用入口或装配层，保持启动、健康检查与业务模块边界清晰。
 * 依赖：NestJS 应用基础设施；被用于：API 运行时与测试。
 */
import { NestFactory } from "@nestjs/core";
import type { INestApplication } from "@nestjs/common";

import { AppModule } from "./app.module.js";

export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, {
    abortOnError: false,
    logger: false
  });

  await app.init();

  return app;
}
