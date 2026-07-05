/**
 * 项目工作台数据 hook。
 * 这里集中处理 workspace 加载、看板流转、工时校正和资源排期，
 * 让页面组件只绑定视图事件，不直接编排 Core API 副作用。
 * 依赖：认证后的 API client；被用于：App 的项目页。
 */
import { useEffect, useState } from "react";

import type { createApiClient } from "../api/client.js";
import type {
  AuthSession,
  BoardColumn,
  CoreTimeEntry,
  CoreWorkspace
} from "../api/types.js";

type ApiClient = ReturnType<typeof createApiClient>;

interface UseWorkspaceOptions {
  api: ApiClient;
  route: string;
  session: AuthSession | null;
  setStatus: (status: string) => void;
}

export function useWorkspace({ api, route, session, setStatus }: UseWorkspaceOptions) {
  const [workspace, setWorkspace] = useState<CoreWorkspace | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [actualHours, setActualHours] = useState("8");
  const [plannedHours, setPlannedHours] = useState("40");
  const [utilization, setUtilization] = useState<{
    plannedHours: number;
    availableHours: number;
    isOverloaded: boolean;
  } | null>(null);

  useEffect(() => {
    if (!session || route !== "/projects") {
      return;
    }

    let ignore = false;
    setStatus("正在加载核心页面");
    api
      .workspace()
      .then((result) => {
        if (!ignore) {
          setWorkspace(result.data);
          setStatus("核心页面已加载");
        }
      })
      .catch(() => {
        if (!ignore) {
          setStatus("核心页面加载失败");
        }
      });

    return () => {
      ignore = true;
    };
  }, [route, session]);

  const taskWithTimeEntry = workspace?.tasks.find((task) =>
    workspace.timeEntries.some((entry) => entry.taskId === task.id)
  );
  const primaryTask = taskWithTimeEntry ?? workspace?.tasks[0];
  const primaryEmployee =
    workspace?.employees.find((employee) => employee.id === primaryTask?.assigneeUserId) ??
    workspace?.employees[0];
  const primaryProject = primaryTask
    ? workspace?.projects.find((project) => project.id === primaryTask.projectId)
    : workspace?.projects[0];
  const latestTimeEntry = primaryTask
    ? workspace?.timeEntries.find((entry) => entry.taskId === primaryTask.id)
    : undefined;

  const mergeTimeEntry = (entry: CoreTimeEntry) => {
    setWorkspace((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        timeEntries: [
          entry,
          ...current.timeEntries.filter((candidate) => candidate.id !== entry.id)
        ]
      };
    });
  };

  const moveTask = async (taskId: string, boardColumn: BoardColumn) => {
    setStatus("同步中");
    setWorkspace((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        tasks: current.tasks.map((task) =>
          task.id === taskId
            ? { ...task, boardColumn, status: boardColumn }
            : task
        )
      };
    });

    try {
      const result = await api.moveTask(taskId, boardColumn);
      setWorkspace((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          tasks: current.tasks.map((task) =>
            task.id === taskId ? result.data.task : task
          ),
          timeEntries: result.data.timeEntry
            ? [
                result.data.timeEntry,
                ...current.timeEntries.filter(
                  (entry) => entry.id !== result.data.timeEntry?.id
                )
              ]
            : current.timeEntries
        };
      });
      setStatus("已同步");
    } catch {
      setStatus("同步失败，请刷新后重试");
    }
  };

  const correctTime = async () => {
    if (!primaryTask || !primaryEmployee) {
      setStatus("当前任务缺少负责人，无法校正工时");
      return;
    }

    const hours = Number(actualHours);
    setStatus("正在校正工时");

    try {
      const result = await api.correctTimeEntry({
        employeeId: primaryEmployee.id,
        hours,
        note: "前端校正",
        taskId: primaryTask.id
      });
      mergeTimeEntry(result.data.timeEntry);
      setStatus("成本信号已更新");
    } catch {
      setStatus("工时校正失败");
    }
  };

  const scheduleAllocation = async () => {
    if (!primaryTask || !primaryEmployee || !primaryProject) {
      setStatus("缺少任务或项目，无法保存排期");
      return;
    }

    setStatus("正在保存排期");

    try {
      const result = await api.scheduleAllocation({
        employeeId: primaryEmployee.id,
        plannedHours: Number(plannedHours),
        projectId: primaryProject.id,
        taskId: primaryTask.id,
        weekStart: "2026-07-06T00:00:00.000Z"
      });
      setUtilization(result.data.utilization);
      setWorkspace((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          allocations: [
            result.data.allocation,
            ...current.allocations.filter(
              (allocation) => allocation.id !== result.data.allocation.id
            )
          ]
        };
      });
      setStatus(result.data.utilization.isOverloaded ? "产能过载" : "排期已保存");
    } catch {
      setStatus("排期保存失败");
    }
  };

  return {
    actualHours,
    correctTime,
    draggingTaskId,
    latestTimeEntry,
    moveTask,
    plannedHours,
    primaryEmployee,
    primaryProject,
    primaryTask,
    scheduleAllocation,
    setActualHours,
    setDraggingTaskId,
    setPlannedHours,
    utilization,
    workspace
  };
}
