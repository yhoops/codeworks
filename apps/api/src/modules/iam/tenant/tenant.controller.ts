/**
 * tenant.controller.ts HTTP 控制器。
 * 只承载路由、鉴权上下文与 DTO 边界，把业务规则留在 service 以便测试复用。
 * 依赖：NestJS 与领域 service；被用于：API 路由。
 */
import {
  Body,
  Controller,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  UnauthorizedException
} from "@nestjs/common";

import { AuthService } from "../auth/auth.service.js";
import { TenantService } from "./tenant.service.js";

@Controller("tenants")
export class TenantController {
  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService,
    @Inject(TenantService)
    private readonly tenantService: TenantService
  ) {}

  @Post("open")
  async openTenant(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: { name: string; slug: string; seatLimit: number }
  ) {
    const actor = await this.requireActor(authorization);
    return this.tenantService.openTenant(actor, body);
  }

  @Post(":slug/members")
  async addMember(
    @Headers("authorization") authorization: string | undefined,
    @Param("slug") slug: string,
    @Body() body: { userId: string; role: string }
  ) {
    const actor = await this.requireActor(authorization);
    return this.tenantService.addMember(actor, slug, body);
  }

  @Patch(":slug/members/:userId")
  async updateMemberStatus(
    @Headers("authorization") authorization: string | undefined,
    @Param("slug") slug: string,
    @Param("userId") userId: string,
    @Body() body: { status: string }
  ) {
    const actor = await this.requireActor(authorization);
    return this.tenantService.updateMemberStatus(actor, slug, userId, body.status);
  }

  private async requireActor(authorization?: string) {
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : undefined;

    if (!token) {
      throw new UnauthorizedException("Missing access token");
    }

    return this.authService.authenticateAccessToken(token);
  }
}
