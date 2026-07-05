/**
 * auth.controller.ts HTTP 控制器。
 * 只承载路由、鉴权上下文与 DTO 边界，把业务规则留在 service 以便测试复用。
 * 依赖：NestJS 与领域 service；被用于：API 路由。
 */
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Post,
  UnauthorizedException
} from "@nestjs/common";

import { AuthService } from "./auth.service.js";

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post("register")
  async register(
    @Body() body: { email: string; password: string; name: string }
  ) {
    return this.authService.register(body);
  }

  @Post("login")
  @HttpCode(200)
  async login(@Body() body: { email: string; password: string; tenantSlug?: string }) {
    return this.authService.login(body);
  }

  @Post("refresh")
  @HttpCode(200)
  async refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refresh(body.refreshToken);
  }

  @Post("logout")
  @HttpCode(204)
  async logout(@Body() body: { refreshToken: string }) {
    await this.authService.logout(body.refreshToken);
  }

  @Get("me")
  async me(@Headers("authorization") authorization?: string) {
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : undefined;

    if (!token) {
      throw new UnauthorizedException("Missing access token");
    }

    return this.authService.authenticateAccessToken(token);
  }
}
