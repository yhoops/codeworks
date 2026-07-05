/**
 * auth.module.ts NestJS 模块装配。
 * 集中声明该业务域 provider/controller 依赖，避免跨模块直接耦合实现细节。
 * 依赖：NestJS DI；被用于：应用根模块。
 */
import { Module } from "@nestjs/common";

import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService]
})
export class AuthModule {}
