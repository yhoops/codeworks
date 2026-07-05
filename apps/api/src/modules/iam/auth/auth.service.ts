/**
 * 认证编排服务。
 * 保留注册、登录、刷新、登出与访问令牌认证的数据流编排，
 * token、密码和 session DTO 细节分别委派给同目录 util 模块。
 * 依赖：系统 Prisma 客户端与 auth util；被用于：AuthController 和需要 actor 的业务控制器。
 */
import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import type { OnModuleDestroy } from "@nestjs/common";
import { PrismaClient, type User } from "@prisma/client";
import { randomUUID } from "node:crypto";

import type { AuthzContext } from "../../../platform/authz/rbac.guard.js";
import { createSystemPrismaClient } from "../../../platform/database/prisma.client.js";
import {
  hashPassword,
  normalizeEmail,
  verifyPassword
} from "./password.util.js";
import {
  type AuthUser,
  type MembershipSessionSource,
  type TenantSession,
  isFixedRole,
  toAuthUser,
  toAuthzContext,
  toTenantSession
} from "./session.util.js";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  createJwtSecret,
  hashToken,
  requireTokenId,
  signToken,
  verifyToken
} from "./token.util.js";

export type { AuthUser } from "./session.util.js";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  tenant?: TenantSession;
}

@Injectable()
export class AuthService implements OnModuleDestroy {
  private readonly prisma = createSystemPrismaClient() as PrismaClient;
  private readonly jwtSecret: Uint8Array;

  constructor() {
    this.jwtSecret = createJwtSecret();
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }

  async register(input: {
    email: string;
    password: string;
    name: string;
  }): Promise<AuthTokens> {
    const email = normalizeEmail(input.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });

    if (existing) {
      throw new ConflictException("Email already registered");
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        name: input.name,
        passwordHash: await hashPassword(input.password)
      }
    });

    return this.issueTokens(user);
  }

  async login(input: {
    email: string;
    password: string;
    tenantSlug?: string;
  }): Promise<AuthTokens> {
    const email = normalizeEmail(input.email);
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !(await verifyPassword(user.passwordHash, input.password))) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const membership = input.tenantSlug
      ? await this.requireActiveMembership(user.id, input.tenantSlug)
      : undefined;

    return this.issueTokens(user, membership);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const payload = await verifyToken(this.jwtSecret, refreshToken, "refresh");
    const tokenId = requireTokenId(payload);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { id: tokenId },
      include: { user: true }
    });

    if (
      !storedToken ||
      storedToken.revokedAt ||
      storedToken.expiresAt <= new Date() ||
      storedToken.tokenHash !== hashToken(refreshToken)
    ) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() }
    });

    const membership = payload.tenantId
      ? await this.requireActiveMembershipByTenant(storedToken.user.id, payload.tenantId)
      : undefined;

    return this.issueTokens(storedToken.user, membership);
  }

  async logout(refreshToken: string): Promise<void> {
    const payload = await verifyToken(this.jwtSecret, refreshToken, "refresh");
    const tokenId = requireTokenId(payload);

    await this.prisma.refreshToken.updateMany({
      where: {
        id: tokenId,
        tokenHash: hashToken(refreshToken),
        revokedAt: null
      },
      data: { revokedAt: new Date() }
    });
    await this.prisma.user.updateMany({
      where: { id: payload.sub },
      data: { accessTokenVersion: { increment: 1 } }
    });
  }

  async authenticateAccessToken(accessToken: string): Promise<AuthUser> {
    const payload = await verifyToken(this.jwtSecret, accessToken, "access");
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user || payload.ver !== user.accessTokenVersion) {
      throw new UnauthorizedException("Invalid access token");
    }

    return toAuthUser(user);
  }

  async authenticateActor(accessToken: string): Promise<AuthzContext> {
    const payload = await verifyToken(this.jwtSecret, accessToken, "access");
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user || payload.ver !== user.accessTokenVersion) {
      throw new UnauthorizedException("Invalid access token");
    }

    if (!payload.tenantId || !isFixedRole(payload.role)) {
      throw new UnauthorizedException("Tenant-scoped access token is required");
    }

    return toAuthzContext(user, {
      ...payload,
      role: payload.role,
      tenantId: payload.tenantId
    });
  }

  private async issueTokens(
    user: User,
    membership?: MembershipSessionSource
  ): Promise<AuthTokens> {
    const refreshTokenId = randomUUID();
    const refreshExpiresAt = new Date(
      Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000
    );
    const accessToken = await signToken(this.jwtSecret, {
      sub: user.id,
      email: user.email,
      typ: "access",
      tenantId: membership?.tenantId,
      role: membership?.role,
      ver: user.accessTokenVersion
    }, ACCESS_TOKEN_TTL_SECONDS);
    const refreshToken = await signToken(this.jwtSecret, {
      sub: user.id,
      email: user.email,
      typ: "refresh",
      tenantId: membership?.tenantId,
      role: membership?.role,
      jti: refreshTokenId
    }, REFRESH_TOKEN_TTL_SECONDS);

    await this.prisma.refreshToken.create({
      data: {
        id: refreshTokenId,
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: refreshExpiresAt
      }
    });

    return {
      accessToken,
      refreshToken,
      user: toAuthUser(user),
      tenant: membership ? toTenantSession(membership) : undefined
    };
  }

  private async requireActiveMembership(userId: string, tenantSlug: string) {
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId,
        status: "ACTIVE",
        tenant: { slug: tenantSlug }
      },
      include: {
        tenant: {
          select: { id: true, slug: true }
        }
      }
    });

    if (!membership) {
      throw new UnauthorizedException("Tenant membership is inactive or missing");
    }

    return membership;
  }

  private async requireActiveMembershipByTenant(userId: string, tenantId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId,
        tenantId,
        status: "ACTIVE"
      },
      include: {
        tenant: {
          select: { id: true, slug: true }
        }
      }
    });

    if (!membership) {
      throw new UnauthorizedException("Tenant membership is inactive or missing");
    }

    return membership;
  }

}
