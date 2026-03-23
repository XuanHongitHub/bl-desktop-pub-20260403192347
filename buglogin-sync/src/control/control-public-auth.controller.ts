import { Body, Controller, Post } from "@nestjs/common";
import { ControlService } from "./control.service.js";

@Controller("v1/control/public/auth")
export class ControlPublicAuthController {
  constructor(private readonly controlService: ControlService) {}

  @Post("register")
  register(@Body() body: { email?: string; password?: string }) {
    return this.controlService.registerAuthUser(
      body.email ?? "",
      body.password ?? "",
    );
  }

  @Post("login")
  login(@Body() body: { email?: string; password?: string }) {
    return this.controlService.loginAuthUser(body.email ?? "", body.password ?? "");
  }
}
