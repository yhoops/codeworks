import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import type { OnModuleDestroy } from "@nestjs/common";
import { PrismaClient, type User } from "@prisma/client";
import { SignJWT, jwtVerify } from "jose";
import { createHash, randomBytes, randomUUID } from "node:crypto";

import { createSystemPrismaClient } from "../../../platform/database/prisma.client.js";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

interface TokenPayload {
  sub: string;
  email: string;
  typ: "access" | "refresh";
  ver?: number;
  jti?: string;
}

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

@Injectable()
export class AuthService implements OnModuleDestroy {
  private readonly prisma = createSystemPrismaClient() as PrismaClient;
  private readonly jwtSecret: Uint8Array;

  constructor() {
    this.jwtSecret = new TextEncoder().encode(
      process.env.JWT_SECRET ?? "dev-only-change-me-in-production"
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }

  async register(input: {
    email: string;
    password: string;
    name: string;
  }): Promise<AuthTokens> {
    const email = this.normalizeEmail(input.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });

    if (existing) {
      throw new ConflictException("Email already registered");
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        name: input.name,
        passwordHash: await this.hashPassword(input.password)
      }
    });

    return this.issueTokens(user);
  }

  async login(input: { email: string; password: string }): Promise<AuthTokens> {
    const email = this.normalizeEmail(input.email);
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !(await this.verifyPassword(user.passwordHash, input.password))) {
      throw new UnauthorizedException("Invalid credentials");
    }

    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const payload = await this.verifyToken(refreshToken, "refresh");
    const tokenId = this.requireTokenId(payload);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { id: tokenId },
      include: { user: true }
    });

    if (
      !storedToken ||
      storedToken.revokedAt ||
      storedToken.expiresAt <= new Date() ||
      storedToken.tokenHash !== this.hashToken(refreshToken)
    ) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() }
    });

    return this.issueTokens(storedToken.user);
  }

  async logout(refreshToken: string): Promise<void> {
    const payload = await this.verifyToken(refreshToken, "refresh");
    const tokenId = this.requireTokenId(payload);

    await this.prisma.refreshToken.updateMany({
      where: {
        id: tokenId,
        tokenHash: this.hashToken(refreshToken),
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
    const payload = await this.verifyToken(accessToken, "access");
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user || payload.ver !== user.accessTokenVersion) {
      throw new UnauthorizedException("Invalid access token");
    }

    return this.toAuthUser(user);
  }

  private async issueTokens(user: User): Promise<AuthTokens> {
    const refreshTokenId = randomUUID();
    const refreshExpiresAt = new Date(
      Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000
    );
    const accessToken = await this.signToken({
      sub: user.id,
      email: user.email,
      typ: "access",
      ver: user.accessTokenVersion
    }, ACCESS_TOKEN_TTL_SECONDS);
    const refreshToken = await this.signToken({
      sub: user.id,
      email: user.email,
      typ: "refresh",
      jti: refreshTokenId
    }, REFRESH_TOKEN_TTL_SECONDS);

    await this.prisma.refreshToken.create({
      data: {
        id: refreshTokenId,
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: refreshExpiresAt
      }
    });

    return {
      accessToken,
      refreshToken,
      user: this.toAuthUser(user)
    };
  }

  private async signToken(
    payload: TokenPayload,
    ttlSeconds: number
  ): Promise<string> {
    return new SignJWT({
      email: payload.email,
      typ: payload.typ,
      ver: payload.ver
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(payload.sub)
      .setJti(payload.jti ?? randomUUID())
      .setIssuedAt()
      .setExpirationTime(`${ttlSeconds}s`)
      .sign(this.jwtSecret);
  }

  private async verifyToken(
    token: string,
    expectedType: "access" | "refresh"
  ): Promise<TokenPayload> {
    try {
      const { payload } = await jwtVerify(token, this.jwtSecret);

      if (payload.typ !== expectedType || typeof payload.sub !== "string") {
        throw new UnauthorizedException("Invalid token");
      }

      return {
        sub: payload.sub,
        email: String(payload.email ?? ""),
        typ: expectedType,
        ver: typeof payload.ver === "number" ? payload.ver : undefined,
        jti: typeof payload.jti === "string" ? payload.jti : undefined
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException("Invalid token");
    }
  }

  private requireTokenId(payload: TokenPayload): string {
    if (!payload.jti) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    return payload.jti;
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private async hashPassword(password: string): Promise<string> {
    const { argon2id } = await import("hash-wasm");

    return argon2id({
      password,
      salt: randomBytes(16),
      iterations: 3,
      parallelism: 1,
      memorySize: 19_456,
      hashLength: 32,
      outputType: "encoded"
    });
  }

  private async verifyPassword(hash: string, password: string): Promise<boolean> {
    const { argon2Verify } = await import("hash-wasm");

    return argon2Verify({
      hash,
      password
    });
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name
    };
  }
}
