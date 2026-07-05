import { describe, expect, it } from "vitest";

import {
  serializeAllocation,
  serializeTask,
  serializeTimeEntry
} from "../src/modules/core/core-workflow.dto.js";

describe("core workflow DTO helpers", () => {
  it("serializes task, time entry and allocation response shapes", () => {
    expect(
      serializeTask({
        assigneeUserId: "user-1",
        boardColumn: "DONE",
        estimateHours: { toNumber: () => 8 },
        id: "task-1",
        projectId: "project-1",
        sprintId: "sprint-1",
        status: "DONE",
        title: "Ship workflow"
      })
    ).toEqual({
      assigneeUserId: "user-1",
      boardColumn: "DONE",
      estimateHours: 8,
      id: "task-1",
      projectId: "project-1",
      sprintId: "sprint-1",
      status: "DONE",
      title: "Ship workflow"
    });

    expect(
      serializeTimeEntry({
        employeeId: "employee-1",
        hours: { toNumber: () => 6 },
        id: "entry-1",
        note: "adjusted",
        source: "MANUAL",
        taskId: "task-1"
      })
    ).toEqual({
      employeeId: "employee-1",
      hours: 6,
      id: "entry-1",
      note: "adjusted",
      source: "MANUAL",
      taskId: "task-1"
    });

    expect(
      serializeAllocation({
        availableHoursOverride: { toNumber: () => 32 },
        employeeId: "employee-1",
        id: "allocation-1",
        isOverloaded: true,
        plannedHours: { toNumber: () => 45 },
        projectId: "project-1",
        taskId: null,
        weekStart: new Date("2026-07-06T00:00:00.000Z")
      })
    ).toEqual({
      availableHoursOverride: 32,
      employeeId: "employee-1",
      id: "allocation-1",
      isOverloaded: true,
      plannedHours: 45,
      projectId: "project-1",
      taskId: null,
      weekStart: "2026-07-06T00:00:00.000Z"
    });
  });
});
