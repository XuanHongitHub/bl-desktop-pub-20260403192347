import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
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
    private readonly configService: ConfigService,
  ) {}

  private resolveControlToken(): string {
    const controlToken = this.configService
      .get<string>("CONTROL_API_TOKEN")
      ?.trim();
    const syncToken = this.configService.get<string>("SYNC_TOKEN")?.trim();
    const resolved = controlToken || syncToken;
    if (!resolved) {
      throw new UnauthorizedException("control_token_not_configured");
    }
    return resolved;
  }

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
    const result = this.controlService.registerAuthUser(
      body.email ?? "",
      body.password ?? "",
    );
    return {
      ...result,
      controlToken: this.resolveControlToken(),
    };
  }

  @Post("login")
  login(
    @Req() request: Request,
    @Body() body: { email?: string; password?: string },
  ) {
    this.assertAuthRateLimit(request, "login");
    const result = this.controlService.loginAuthUser(
      body.email ?? "",
      body.password ?? "",
    );
    return {
      ...result,
      controlToken: this.resolveControlToken(),
    };
  }

  @Post("google")
  async loginWithGoogle(
    @Req() request: Request,
    @Body() body: { idToken?: string },
  ) {
    this.assertAuthRateLimit(request, "google");
    const identity = await this.googleIdTokenService.verifyIdToken(
      body.idToken ?? "",
    );
    const result = this.controlService.loginOrRegisterGoogleAuthUser(
      identity.email,
      identity.sub,
    );
    return {
      ...result,
      controlToken: this.resolveControlToken(),
    };
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
