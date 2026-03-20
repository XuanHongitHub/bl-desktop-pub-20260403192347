import { Module } from "@nestjs/common";
import { ControlController } from "./control.controller.js";
import { ControlService } from "./control.service.js";

@Module({
  controllers: [ControlController],
  providers: [ControlService],
})
export class ControlModule {}
