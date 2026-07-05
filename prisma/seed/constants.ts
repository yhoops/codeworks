/**
 * 演示种子常量。
 * 集中定义 demo 登录凭据、命名约定和固定周起始日期，
 * 让各领域 seed 模块共享同一组稳定输入。
 * 依赖：无；被用于：prisma/seed 下的各领域模块。
 */
export const DEMO_LOGIN = {
  email: "demo.pm@codeworks.test",
  password: "CodeworksDemo2026!",
  tenantSlug: "demo"
} as const;

export const DEMO_TENANT_NAME = "Codeworks Demo Tenant";
export const DEMO_CUSTOMER_NAME = "Acme Digital Transformation";
export const DEMO_PROJECT_NAME = "Acme ERP Launch";
export const DEMO_SPRINT_NAME = "Sprint 1 - Quote to Delivery";
export const DEMO_EMPLOYEE_EMAIL = "lin.demo@codeworks.test";
export const DEMO_WEEK_START = new Date("2026-07-06T00:00:00.000Z");

export interface DemoSeedResult {
  tenantId: string;
  userId: string;
  projectId: string;
}
