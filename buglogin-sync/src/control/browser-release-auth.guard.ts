import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";

@Injectable()
export class BrowserReleaseAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const configuredToken = this.configService
      .get<string>("BUGLOGIN_RELEASE_API_TOKEN")
      ?.trim();
    const controlToken = this.configService.get<string>("CONTROL_API_TOKEN")?.trim();
    const syncToken = this.configService.get<string>("SYNC_TOKEN")?.trim();

    const acceptedTokens = new Set<string>();
    if (configuredToken) {
      acceptedTokens.add(configuredToken);
    }
    if (controlToken) {
      acceptedTokens.add(controlToken);
    }
    if (syncToken) {
      acceptedTokens.add(syncToken);
    }

    if (acceptedTokens.size === 0) {
      throw new UnauthorizedException("release_token_not_configured");
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authorizationHeader = request.headers.authorization;
    if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
      throw new UnauthorizedException("missing_release_token");
    }

    const providedToken = authorizationHeader.slice(7).trim();
    if (!providedToken || !acceptedTokens.has(providedToken)) {
      throw new UnauthorizedException("invalid_release_token");
    }

    return true;
  }
}

