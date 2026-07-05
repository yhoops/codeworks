/**
 * 共享类型与工具出口。
 * 把跨 API/Web 的轻量契约放在 workspace 包内，避免前后端复制业务类型。
 * 依赖：TypeScript workspace；被用于：API 与 Web 包。
 */
export const APP_NAME = "码程 / Codeworks";

export interface HealthStatus {
  service: "api";
  status: "ok";
  timestamp: string;
}
