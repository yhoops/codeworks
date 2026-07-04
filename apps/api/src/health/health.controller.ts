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
