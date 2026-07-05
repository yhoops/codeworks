/**
 * tenant.module.ts NestJS 模块装配。
 * 集中声明该业务域 provider/controller 依赖，避免跨模块直接耦合实现细节。
 * 依赖：NestJS DI；被用于：应用根模块。
 */
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { TenantController } from "./tenant.controller.js";
import { TenantService } from "./tenant.service.js";

@Module({
  imports: [AuthModule],
  controllers: [TenantController],
  providers: [TenantService]
})
export class TenantModule {}
