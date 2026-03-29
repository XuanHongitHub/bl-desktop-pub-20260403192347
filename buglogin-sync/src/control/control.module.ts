import { Module } from "@nestjs/common";
import { ControlAuthGuard } from "./control-auth.guard.js";
import { ControlController } from "./control.controller.js";
import { ControlPublicAuthController } from "./control-public-auth.controller.js";
import { ControlService } from "./control.service.js";
import { TiktokCookiesController } from "./tiktok-cookies.controller.js";
import { SyncModule } from "../sync/sync.module.js";

@Module({
  imports: [SyncModule],
  controllers: [
    ControlController,
    ControlPublicAuthController,
    TiktokCookiesController,
  ],
  providers: [ControlService, ControlAuthGuard],
})
export class ControlModule {}
