/**
 * app.module.ts NestJS 模块装配。
 * 集中声明该业务域 provider/controller 依赖，避免跨模块直接耦合实现细节。
 * 依赖：NestJS DI；被用于：应用根模块。
 */
import { Module } from "@nestjs/common";

import { HealthController } from "./health/health.controller.js";
import { CoreModule } from "./modules/core/core.module.js";
import { AuthModule } from "./modules/iam/auth/auth.module.js";
import { TenantModule } from "./modules/iam/tenant/tenant.module.js";

@Module({
  imports: [AuthModule, TenantModule, CoreModule],
  controllers: [HealthController]
})
export class AppModule {}
