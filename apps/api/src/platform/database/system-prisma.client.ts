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
