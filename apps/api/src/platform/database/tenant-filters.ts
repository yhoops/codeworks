/**
 * tenant-filters.ts 数据库平台模块。
 * 承载 Prisma 客户端、租户过滤或 guard 的基础能力，集中保护跨租户边界。
 * 依赖：Prisma 与租户上下文；被用于：API 服务与测试。
 */
// Applies tenant and soft-delete filters to Prisma query arguments.
export function applyNotDeleted<TArgs extends { where?: object }>(args: TArgs): TArgs {
  return {
    ...args,
    where: {
      ...(args.where ?? {}),
      deletedAt: null
    }
  };
}

export function applyTenantOnlyFilter<TArgs extends { where?: object }>(
  args: TArgs,
  tenantId: string
): TArgs {
  return {
    ...args,
    where: {
      ...(args.where ?? {}),
      tenantId
    }
  };
}

export function applyTenantSoftDeleteFilter<TArgs extends { where?: object }>(
  args: TArgs,
  tenantId: string
): TArgs {
  return {
    ...args,
    where: {
      ...(args.where ?? {}),
      tenantId,
      deletedAt: null
    }
  };
}
