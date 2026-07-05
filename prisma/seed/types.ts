/**
 * 演示种子共享类型。
 * 提供系统 Prisma 客户端类型别名，避免各领域模块重复引用客户端工厂。
 * 依赖：系统 Prisma 客户端工厂；被用于：prisma/seed 下的领域模块。
 */
import { createSystemPrismaClient } from "../../apps/api/src/platform/database/prisma.client.js";

export type SystemPrismaClient = ReturnType<typeof createSystemPrismaClient>;
