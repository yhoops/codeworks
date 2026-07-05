/**
 * health.controller.ts HTTP 控制器。
 * 只承载路由、鉴权上下文与 DTO 边界，把业务规则留在 service 以便测试复用。
 * 依赖：NestJS 与领域 service；被用于：API 路由。
 */
import { Controller, Get } from "@nestjs/common";
import type { HealthStatus } from "@codeworks/shared";

@Controller("health")
export class HealthController {
  @Get()
  getHealth(): HealthStatus {
    return {
      service: "api",
      status: "ok",
      timestamp: new Date().toISOString()
    };
  }
}
