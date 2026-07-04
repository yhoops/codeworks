import {
  ForbiddenException,
  Injectable,
  SetMetadata
} from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

export type FixedRole = "ADMIN" | "PM" | "MEMBER" | "FINANCE";

export type PermissionAction =
  | "tenant.member.manage"
  | "project.read"
  | "project.write"
  | "financial.read";

export type DataScope = "ALL" | "PROJECT" | "SELF";

export interface AuthzContext {
  tenantId: string;
  userId: string;
  roles: FixedRole[];
}

export interface ScopedRecord {
  tenantId: string;
  ownerUserId?: string | null;
  projectManagerId?: string | null;
  memberUserIds?: string[];
}

export const REQUIRED_PERMISSION_METADATA = "requiredPermission";

const ROLE_PERMISSIONS: Record<FixedRole, PermissionAction[]> = {
  ADMIN: ["tenant.member.manage", "project.read", "project.write", "financial.read"],
  PM: ["project.read", "project.write"],
  MEMBER: ["project.read"],
  FINANCE: ["project.read", "financial.read"]
};

const SENSITIVE_FINANCIAL_FIELDS = new Set([
  "plannedCost",
  "actualCost",
  "cost",
  "grossProfit",
  "profit",
  "margin"
]);

export function RequirePermission(action: PermissionAction) {
  return SetMetadata(REQUIRED_PERMISSION_METADATA, action);
}

export function canPerform(
  context: AuthzContext | undefined,
  action: PermissionAction | undefined
): boolean {
  if (!context || !action) {
    return false;
  }

  return context.roles.some((role) => ROLE_PERMISSIONS[role]?.includes(action));
}

export function assertPermission(
  context: AuthzContext | undefined,
  action: PermissionAction | undefined
): void {
  if (!canPerform(context, action)) {
    throw new ForbiddenException("Permission denied");
  }
}

export function getDataScope(context: AuthzContext): DataScope {
  if (context.roles.includes("ADMIN") || context.roles.includes("FINANCE")) {
    return "ALL";
  }

  if (context.roles.includes("PM")) {
    return "PROJECT";
  }

  return "SELF";
}

export function filterByDataScope<TRecord extends ScopedRecord>(
  context: AuthzContext,
  records: TRecord[]
): TRecord[] {
  const tenantRecords = records.filter((record) => record.tenantId === context.tenantId);
  const scope = getDataScope(context);

  if (scope === "ALL") {
    return tenantRecords;
  }

  if (scope === "PROJECT") {
    return tenantRecords.filter(
      (record) =>
        record.projectManagerId === context.userId ||
        (record.memberUserIds ?? []).includes(context.userId)
    );
  }

  return tenantRecords.filter(
    (record) =>
      record.ownerUserId === context.userId ||
      (record.memberUserIds ?? []).includes(context.userId)
  );
}

export function maskFinancialFields<TRecord extends Record<string, unknown>>(
  context: AuthzContext,
  record: TRecord
): TRecord {
  if (canPerform(context, "financial.read")) {
    return record;
  }

  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      SENSITIVE_FINANCIAL_FIELDS.has(key) ? null : value
    ])
  ) as TRecord;
}

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector = new Reflector()) {}

  canActivate(context: ExecutionContext): boolean {
    const action = this.reflector.get<PermissionAction>(
      REQUIRED_PERMISSION_METADATA,
      context.getHandler()
    );
    const request = context.switchToHttp().getRequest<{
      user?: AuthzContext;
    }>();

    assertPermission(request.user, action);
    return true;
  }
}
