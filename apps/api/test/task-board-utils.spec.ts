import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  buildTaskChangedEvent,
  optionalText,
  requireEstimate,
  statusForColumn
} from "../src/modules/projects/task-board.util.js";

describe("task board utility module", () => {
  it("maps board columns to task statuses and rejects unsupported columns", () => {
    expect(statusForColumn("TODO")).toBe("TODO");
    expect(statusForColumn("IN_PROGRESS")).toBe("IN_PROGRESS");
    expect(statusForColumn("REVIEW")).toBe("REVIEW");
    expect(statusForColumn("DONE")).toBe("DONE");

    expect(() => statusForColumn("BLOCKED" as never)).toThrow(BadRequestException);
  });

  it("normalizes task estimates to two decimal places", () => {
    expect(requireEstimate(3.456).toString()).toBe("3.46");
    expect(requireEstimate(0).toString()).toBe("0");
    expect(optionalText("  sprint goal ")).toBe("sprint goal");
    expect(optionalText("   ")).toBeNull();

    expect(() => requireEstimate(-1)).toThrow(BadRequestException);
    expect(() => requireEstimate(Number.NaN)).toThrow(BadRequestException);
  });

  it("builds task changed events with numeric remaining estimate hours", () => {
    expect(
      buildTaskChangedEvent({
        fromStatus: "TODO",
        remainingEstimateHours: new Prisma.Decimal("2.50"),
        taskId: "task-1",
        tenantId: "tenant-1",
        toStatus: "DONE"
      })
    ).toEqual({
      aggregateId: "task-1",
      aggregateType: "Task",
      payload: {
        fromStatus: "TODO",
        remainingEstimateHours: 2.5,
        toStatus: "DONE"
      },
      tenantId: "tenant-1",
      type: "task.changed"
    });
  });
});
