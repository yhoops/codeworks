/**
 * 认证密码纯工具。
 * 集中处理邮箱规范化与 argon2 密码哈希/校验，避免 AuthService 直接承载密码细节。
 * 依赖：hash-wasm 与 node:crypto；被用于：AuthService 与密码单测。
 */
import { randomBytes } from "node:crypto";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function hashPassword(password: string): Promise<string> {
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

export async function verifyPassword(
  hash: string,
  password: string
): Promise<boolean> {
  const { argon2Verify } = await import("hash-wasm");

  return argon2Verify({
    hash,
    password
  });
}
