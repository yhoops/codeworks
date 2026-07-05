import { Module } from "@nestjs/common";

import { AuthModule } from "../iam/auth/auth.module.js";
import { SprintService } from "../projects/sprint.service.js";
import { AllocationService } from "../resourcing/allocation.service.js";
import { TimeEntryService } from "../timesheets/time-entry.service.js";
import { CoreWorkflowController } from "./core-workflow.controller.js";

@Module({
  imports: [AuthModule],
  controllers: [CoreWorkflowController],
  providers: [
    { provide: SprintService, useFactory: () => new SprintService() },
    { provide: TimeEntryService, useFactory: () => new TimeEntryService() },
    AllocationService
  ]
})
export class CoreModule {}
