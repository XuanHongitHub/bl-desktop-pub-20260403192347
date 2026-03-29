import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";

@Injectable()
export class ControlAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const configuredControlToken = this.configService
      .get<string>("CONTROL_API_TOKEN")
      ?.trim();
    const syncToken = this.configService.get<string>("SYNC_TOKEN")?.trim();
    const acceptedTokens = new Set<string>();
    if (configuredControlToken) {
      acceptedTokens.add(configuredControlToken);
    }
    if (syncToken) {
      acceptedTokens.add(syncToken);
    }

    if (acceptedTokens.size === 0) {
      throw new UnauthorizedException("control_token_not_configured");
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedException("missing_control_token");
    }

    const providedToken = authHeader.slice(7).trim();
    if (!providedToken) {
      throw new UnauthorizedException("invalid_control_token");
    }

    if (!acceptedTokens.has(providedToken)) {
      throw new UnauthorizedException("invalid_control_token");
    }

    return true;
  }
}
