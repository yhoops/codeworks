import { Module } from "@nestjs/common";

import { HealthController } from "./health/health.controller.js";
import { AuthModule } from "./modules/iam/auth/auth.module.js";
import { TenantModule } from "./modules/iam/tenant/tenant.module.js";

@Module({
  imports: [AuthModule, TenantModule],
  controllers: [HealthController]
})
export class AppModule {}
