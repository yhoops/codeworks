/**
 * system-prisma.client.ts 数据库平台模块。
 * 承载 Prisma 客户端、租户过滤或 guard 的基础能力，集中保护跨租户边界。
 * 依赖：Prisma 与租户上下文；被用于：API 服务与测试。
 */
// Builds the system Prisma client with default soft-delete read filters.
import { Prisma, PrismaClient } from "@prisma/client";

import { applyNotDeleted } from "./tenant-filters.js";

function createBasePrismaClient() {
  return new PrismaClient();
}

export function createSystemPrismaClient() {
  return createBasePrismaClient().$extends(
    Prisma.defineExtension({
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
      },
      customer: {
        async findMany({ args, query }) {
          return query(applyNotDeleted(args));
        },
        async findFirst({ args, query }) {
          return query(applyNotDeleted(args));
        },
        async count({ args, query }) {
          return query(applyNotDeleted(args));
        }
      },
      contact: {
        async findMany({ args, query }) {
          return query(applyNotDeleted(args));
        },
        async findFirst({ args, query }) {
          return query(applyNotDeleted(args));
        },
        async count({ args, query }) {
          return query(applyNotDeleted(args));
        }
      },
      project: {
        async findMany({ args, query }) {
          return query(applyNotDeleted(args));
        },
        async findFirst({ args, query }) {
          return query(applyNotDeleted(args));
        },
        async count({ args, query }) {
          return query(applyNotDeleted(args));
        }
      },
      milestone: {
        async findMany({ args, query }) {
          return query(applyNotDeleted(args));
        },
        async findFirst({ args, query }) {
          return query(applyNotDeleted(args));
        },
        async count({ args, query }) {
          return query(applyNotDeleted(args));
        }
      },
      sprint: {
        async findMany({ args, query }) {
          return query(applyNotDeleted(args));
        },
        async findFirst({ args, query }) {
          return query(applyNotDeleted(args));
        },
        async count({ args, query }) {
          return query(applyNotDeleted(args));
        }
      },
      backlogTask: {
        async findMany({ args, query }) {
          return query(applyNotDeleted(args));
        },
        async findFirst({ args, query }) {
          return query(applyNotDeleted(args));
        },
        async count({ args, query }) {
          return query(applyNotDeleted(args));
        }
      },
      employee: {
        async findMany({ args, query }) {
          return query(applyNotDeleted(args));
        },
        async findFirst({ args, query }) {
          return query(applyNotDeleted(args));
        },
        async count({ args, query }) {
          return query(applyNotDeleted(args));
        }
      },
      skill: {
        async findMany({ args, query }) {
          return query(applyNotDeleted(args));
        },
        async findFirst({ args, query }) {
          return query(applyNotDeleted(args));
        },
        async count({ args, query }) {
          return query(applyNotDeleted(args));
        }
      },
      capacity: {
        async findMany({ args, query }) {
          return query(applyNotDeleted(args));
        },
        async findFirst({ args, query }) {
          return query(applyNotDeleted(args));
        },
        async count({ args, query }) {
          return query(applyNotDeleted(args));
        }
      },
      resourceAllocation: {
        async findMany({ args, query }) {
          return query(applyNotDeleted(args));
        },
        async findFirst({ args, query }) {
          return query(applyNotDeleted(args));
        },
        async count({ args, query }) {
          return query(applyNotDeleted(args));
        }
      },
      timeEntry: {
        async findMany({ args, query }) {
          return query(applyNotDeleted(args));
        },
        async findFirst({ args, query }) {
          return query(applyNotDeleted(args));
        },
        async count({ args, query }) {
          return query(applyNotDeleted(args));
        }
      },
      costEntry: {
        async findMany({ args, query }) {
          return query(applyNotDeleted(args));
        },
        async findFirst({ args, query }) {
          return query(applyNotDeleted(args));
        },
        async count({ args, query }) {
          return query(applyNotDeleted(args));
        }
      },
      attachment: {
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
    })
  );
}
