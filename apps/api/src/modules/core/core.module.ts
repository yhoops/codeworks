/**
 * core.module.ts NestJS 模块装配。
 * 集中声明该业务域 provider/controller 依赖，避免跨模块直接耦合实现细节。
 * 依赖：NestJS DI；被用于：应用根模块。
 */
import { Module } from "@nestjs/common";

import { CostEntryService } from "../costing/cost-entry.service.js";
import { PnlService } from "../costing/pnl.service.js";
import { AuthModule } from "../iam/auth/auth.module.js";
import { SprintService } from "../projects/sprint.service.js";
import { AllocationService } from "../resourcing/allocation.service.js";
import { TimeEntryService } from "../timesheets/time-entry.service.js";
import { createDomainEventBus } from "../../platform/events/domain-event-bus.js";
import { CoreWorkflowController } from "./core-workflow.controller.js";

const coreEventBus = createDomainEventBus();

@Module({
  imports: [AuthModule],
  controllers: [CoreWorkflowController],
  providers: [
    { provide: SprintService, useFactory: () => new SprintService() },
    { provide: TimeEntryService, useFactory: () => new TimeEntryService(coreEventBus) },
    { provide: CostEntryService, useFactory: () => new CostEntryService(coreEventBus) },
    { provide: PnlService, useFactory: () => new PnlService() },
    AllocationService
  ]
})
export class CoreModule {}
