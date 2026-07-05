/**
 * 前端 API 契约类型。
 * 这些类型描述 Web 与 NestJS Core/Auth 接口之间的 JSON 边界，保持为纯类型模块，
 * 便于页面、hooks 与客户端运行时代码共享而不形成副作用依赖。
 * 依赖：后端 REST 响应结构；被用于：api/client 与 React 页面。
 */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  tenant?: {
    id: string;
    slug: string;
    role: string;
  };
}

export type BoardColumn = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";

export interface CoreTask {
  id: string;
  projectId: string;
  sprintId: string | null;
  title: string;
  status: string;
  boardColumn: BoardColumn;
  estimateHours: number;
  assigneeUserId: string | null;
}

export interface CoreTimeEntry {
  id: string;
  taskId: string;
  employeeId: string;
  hours: number;
  source: "AUTO" | "MANUAL";
  note: string | null;
}

export interface CoreAllocation {
  id: string;
  employeeId: string;
  projectId: string;
  taskId: string | null;
  weekStart: string;
  plannedHours: number;
  availableHoursOverride: number | null;
  isOverloaded: boolean;
}

export interface CoreWorkspace {
  projects: Array<{ id: string; name: string; status: string }>;
  tasks: CoreTask[];
  employees: Array<{ id: string; name: string; email: string | null }>;
  timeEntries: CoreTimeEntry[];
  allocations: CoreAllocation[];
}

export interface DashboardProject {
  id: string;
  name: string;
  revenue: number;
  totalCost: number;
  grossProfit: number;
  grossMargin: number;
  overBudget: boolean;
  utilization: {
    plannedHours: number;
    availableHours: number;
    utilizationRatio: number;
    isOverloaded: boolean;
  };
}

export interface DashboardData {
  projects: DashboardProject[];
}
