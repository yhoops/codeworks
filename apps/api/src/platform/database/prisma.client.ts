import { PrismaClient } from "@prisma/client";

function applyNotDeleted<TArgs extends { where?: object }>(args: TArgs): TArgs {
  return {
    ...args,
    where: {
      ...(args.where ?? {}),
      deletedAt: null
    }
  };
}

export function createPrismaClient() {
  return new PrismaClient().$extends({
    name: "soft-delete-defaults",
    query: {
      budget: {
        async findMany({ args, query }) {
          return query(applyNotDeleted(args));
        },
        async findFirst({ args, query }) {
          return query(applyNotDeleted(args));
        },
        async count({ args, query }) {
          return query(applyNotDeleted(args));
        }
      }
    }
  });
}

export type CodeworksPrismaClient = ReturnType<typeof createPrismaClient>;
