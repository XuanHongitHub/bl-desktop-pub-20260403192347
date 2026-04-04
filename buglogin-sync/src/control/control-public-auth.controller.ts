import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { ControlService } from "./control.service.js";
import { GoogleIdTokenService } from "./google-id-token.service.js";

@Controller("v1/control/public/auth")
export class ControlPublicAuthController {
  private readonly authRateWindowMs = 60_000;
  private readonly authRateMaxAttempts = 20;
  private readonly authAttempts = new Map<string, number[]>();

  constructor(
    private readonly controlService: ControlService,
    private readonly googleIdTokenService: GoogleIdTokenService,
  ) {}

  private resolveActorKey(request: Request): string {
    const forwardedFor = request.headers["x-forwarded-for"];
    if (typeof forwardedFor === "string" && forwardedFor.trim()) {
      const first = forwardedFor.split(",")[0]?.trim();
      if (first) {
        return first;
      }
    }
    if (request.ip?.trim()) {
      return request.ip.trim();
    }
    return "unknown";
  }

  private assertAuthRateLimit(request: Request, action: string) {
    const now = Date.now();
    const key = `${action}:${this.resolveActorKey(request)}`;
    const recent = (this.authAttempts.get(key) ?? []).filter(
      (timestamp) => now - timestamp <= this.authRateWindowMs,
    );
    if (recent.length >= this.authRateMaxAttempts) {
      this.authAttempts.set(key, recent);
      throw new HttpException(
        "auth_rate_limited",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.authAttempts.set(key, recent);
  }

  @Post("register")
  register(
    @Req() request: Request,
    @Body() body: { email?: string; password?: string },
  ) {
    this.assertAuthRateLimit(request, "register");
    return this.controlService.registerAuthUser(
      body.email ?? "",
      body.password ?? "",
    );
  }

  @Post("login")
  login(
    @Req() request: Request,
    @Body() body: { email?: string; password?: string },
  ) {
    this.assertAuthRateLimit(request, "login");
    return this.controlService.loginAuthUser(body.email ?? "", body.password ?? "");
  }

  @Post("google")
  async loginWithGoogle(
    @Req() request: Request,
    @Body() body: { idToken?: string },
  ) {
    this.assertAuthRateLimit(request, "google");
    const identity = await this.googleIdTokenService.verifyIdToken(body.idToken ?? "");
    return this.controlService.loginOrRegisterGoogleAuthUser(
      identity.email,
      identity.sub,
    );
  }

  @Post("google/unlink")
  unlinkGoogleProvider(
    @Req() request: Request,
    @Body() body: { email?: string; password?: string },
  ) {
    this.assertAuthRateLimit(request, "google_unlink");
    return this.controlService.unlinkGoogleAuthProvider(
      body.email ?? "",
      body.password ?? "",
    );
  }
}
