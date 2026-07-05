/**
 * 认证 session 纯工具。
 * 集中处理对外用户 DTO、租户 session DTO、固定角色判定和 actor 组装，
 * 让 AuthService 不再混入展示层对象拼装。
 * 依赖：RBAC 类型与 Prisma User 类型；被用于：AuthService 与 session 单测。
 */
import type { User } from "@prisma/client";

import type { AuthzContext, FixedRole } from "../../../platform/authz/rbac.guard.js";
import type { TokenPayload } from "./token.util.js";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface TenantSession {
  id: string;
  slug: string;
  role: string;
}

export interface MembershipSessionSource {
  tenantId: string;
  role: string;
  tenant: { id: string; slug: string };
}

export function toAuthUser(user: Pick<User, "id" | "email" | "name">): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name
  };
}

export function toTenantSession(
  membership: MembershipSessionSource
): TenantSession {
  return {
    id: membership.tenant.id,
    slug: membership.tenant.slug,
    role: membership.role
  };
}

export function isFixedRole(role: string | undefined): role is FixedRole {
  return role === "ADMIN" || role === "PM" || role === "MEMBER" || role === "FINANCE";
}

export function toAuthzContext(
  user: Pick<User, "id">,
  payload: TokenPayload & { role: FixedRole; tenantId: string }
): AuthzContext {
  return {
    tenantId: payload.tenantId,
    userId: user.id,
    roles: [payload.role]
  };
}
