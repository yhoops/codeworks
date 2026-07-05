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
