/**
 * 核心工作流 DTO 与响应序列化工具。
 * 集中定义核心路由请求体类型和对外响应 shape，
 * 让 CoreWorkflowController 只保留路由、认证和服务委派。
 * 依赖：项目看板列类型；被用于核心工作流控制器和 DTO 单测。
 */
import type { BoardColumn } from "../projects/sprint.service.js";

export interface MoveTaskBody {
  boardColumn: BoardColumn;
}

export interface CorrectTimeEntryBody {
  taskId: string;
  employeeId: string;
  hours: number;
  note?: string;
}

export interface ScheduleAllocationBody {
  employeeId: string;
  projectId: string;
  taskId?: string;
  weekStart: string;
  plannedHours: number;
  availableHoursOverride?: number;
}

interface SerializableDecimal {
  toNumber(): number;
}

export interface SerializableTask {
  id: string;
  projectId: string;
  sprintId: string | null;
  title: string;
  status: string;
  boardColumn: string;
  estimateHours: SerializableDecimal;
  assigneeUserId: string | null;
}

export interface SerializableTimeEntry {
  id: string;
  taskId: string;
  employeeId: string;
  hours: SerializableDecimal;
  source: string;
  note: string | null;
}

export interface SerializableAllocation {
  id: string;
  employeeId: string;
  projectId: string;
  taskId: string | null;
  weekStart: Date;
  plannedHours: SerializableDecimal;
  availableHoursOverride: SerializableDecimal | null;
  isOverloaded: boolean;
}

export function serializeTask(task: SerializableTask) {
  return {
    id: task.id,
    projectId: task.projectId,
    sprintId: task.sprintId,
    title: task.title,
    status: task.status,
    boardColumn: task.boardColumn,
    estimateHours: task.estimateHours.toNumber(),
    assigneeUserId: task.assigneeUserId
  };
}

export function serializeTimeEntry(entry: SerializableTimeEntry) {
  return {
    id: entry.id,
    taskId: entry.taskId,
    employeeId: entry.employeeId,
    hours: entry.hours.toNumber(),
    source: entry.source,
    note: entry.note
  };
}

export function serializeAllocation(allocation: SerializableAllocation) {
  return {
    id: allocation.id,
    employeeId: allocation.employeeId,
    projectId: allocation.projectId,
    taskId: allocation.taskId,
    weekStart: allocation.weekStart.toISOString(),
    plannedHours: allocation.plannedHours.toNumber(),
    availableHoursOverride: allocation.availableHoursOverride?.toNumber() ?? null,
    isOverloaded: allocation.isOverloaded
  };
}
