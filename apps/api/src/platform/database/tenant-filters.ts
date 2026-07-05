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
