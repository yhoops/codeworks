import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import {
  createJwtSecret,
  hashToken,
  requireTokenId,
  signToken,
  verifyToken
} from "../src/modules/iam/auth/token.util.js";
import {
  hashPassword,
  normalizeEmail,
  verifyPassword
} from "../src/modules/iam/auth/password.util.js";
import { isFixedRole, toAuthUser } from "../src/modules/iam/auth/session.util.js";

describe("auth utility modules", () => {
  it("hashes passwords and normalizes email input", async () => {
    const password = "correct horse battery staple";
    const hash = await hashPassword(password);

    expect(normalizeEmail("  USER@Codeworks.Test ")).toBe("user@codeworks.test");
    expect(hash).toMatch(/^\$argon2/);
    await expect(verifyPassword(hash, password)).resolves.toBe(true);
    await expect(verifyPassword(hash, "wrong password")).resolves.toBe(false);
  });

  it("signs, verifies and hashes typed JWT refresh tokens", async () => {
    const secret = createJwtSecret("unit-test-secret");
    const refreshToken = await signToken(
      secret,
      {
        email: "user@codeworks.test",
        jti: "refresh-token-id",
        sub: "user-id",
        tenantId: "tenant-id",
        typ: "refresh"
      },
      60
    );

    const payload = await verifyToken(secret, refreshToken, "refresh");

    expect(payload).toMatchObject({
      email: "user@codeworks.test",
      jti: "refresh-token-id",
      sub: "user-id",
      tenantId: "tenant-id",
      typ: "refresh"
    });
    expect(requireTokenId(payload)).toBe("refresh-token-id");
    expect(hashToken(refreshToken)).toMatch(/^[a-f0-9]{64}$/);
    await expect(verifyToken(secret, refreshToken, "access")).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it("builds public auth users and validates fixed roles", () => {
    expect(
      toAuthUser({
        email: "pm@codeworks.test",
        id: "user-id",
        name: "Project Manager"
      })
    ).toEqual({
      email: "pm@codeworks.test",
      id: "user-id",
      name: "Project Manager"
    });
    expect(isFixedRole("PM")).toBe(true);
    expect(isFixedRole("OWNER")).toBe(false);
  });
});
