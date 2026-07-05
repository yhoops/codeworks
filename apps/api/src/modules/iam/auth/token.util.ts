/**
 * 认证 token 纯工具。
 * 集中处理 JWT 签发、校验、refresh token id 提取和 token 哈希，
 * 让 AuthService 只负责数据库编排与业务状态转换。
 * 依赖：jose 与 node:crypto；被用于：AuthService 与 token 单测。
 */
import { UnauthorizedException } from "@nestjs/common";
import { SignJWT, jwtVerify } from "jose";
import { createHash, randomUUID } from "node:crypto";

export type TokenType = "access" | "refresh";

export interface TokenPayload {
  sub: string;
  email: string;
  typ: TokenType;
  tenantId?: string;
  role?: string;
  ver?: number;
  jti?: string;
}

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

export function createJwtSecret(
  secret = process.env.JWT_SECRET ?? "dev-only-change-me-in-production"
): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signToken(
  jwtSecret: Uint8Array,
  payload: TokenPayload,
  ttlSeconds: number
): Promise<string> {
  return new SignJWT({
    email: payload.email,
    typ: payload.typ,
    tenantId: payload.tenantId,
    role: payload.role,
    ver: payload.ver
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setJti(payload.jti ?? randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(jwtSecret);
}

export async function verifyToken(
  jwtSecret: Uint8Array,
  token: string,
  expectedType: TokenType
): Promise<TokenPayload> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret);

    if (payload.typ !== expectedType || typeof payload.sub !== "string") {
      throw new UnauthorizedException("Invalid token");
    }

    return {
      sub: payload.sub,
      email: String(payload.email ?? ""),
      typ: expectedType,
      tenantId: typeof payload.tenantId === "string" ? payload.tenantId : undefined,
      role: typeof payload.role === "string" ? payload.role : undefined,
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

export function requireTokenId(payload: TokenPayload): string {
  if (!payload.jti) {
    throw new UnauthorizedException("Invalid refresh token");
  }

  return payload.jti;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
