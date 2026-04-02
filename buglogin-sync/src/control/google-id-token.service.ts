import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type VerifiedGoogleIdentity = {
  sub: string;
  email: string;
  name: string;
  picture: string;
};

type GoogleTokenInfoResponse = {
  aud?: unknown;
  iss?: unknown;
  sub?: unknown;
  email?: unknown;
  email_verified?: unknown;
  name?: unknown;
  picture?: unknown;
  exp?: unknown;
};

@Injectable()
export class GoogleIdTokenService {
  private readonly allowedClientIds: Set<string>;

  constructor(private readonly configService: ConfigService) {
    const csv =
      this.configService.get<string>("GOOGLE_OAUTH_CLIENT_IDS") ??
      process.env.GOOGLE_OAUTH_CLIENT_IDS ??
      this.configService.get<string>("GOOGLE_OAUTH_CLIENT_ID") ??
      process.env.GOOGLE_OAUTH_CLIENT_ID ??
      "";
    this.allowedClientIds = new Set(
      csv
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    );
  }

  isConfigured(): boolean {
    return this.allowedClientIds.size > 0;
  }

  async verifyIdToken(idToken: string): Promise<VerifiedGoogleIdentity> {
    const normalizedToken = idToken.trim();
    if (!normalizedToken) {
      throw new UnauthorizedException("google_id_token_required");
    }
    if (!this.isConfigured()) {
      throw new UnauthorizedException("google_oauth_client_ids_not_configured");
    }

    const endpoint = new URL("https://oauth2.googleapis.com/tokeninfo");
    endpoint.searchParams.set("id_token", normalizedToken);

    let payload: GoogleTokenInfoResponse;
    try {
      const response = await fetch(endpoint, {
        method: "GET",
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) {
        throw new UnauthorizedException("google_id_token_invalid");
      }
      payload = (await response.json()) as GoogleTokenInfoResponse;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException("google_id_token_verification_failed");
    }

    const aud = typeof payload.aud === "string" ? payload.aud.trim() : "";
    if (!aud || !this.allowedClientIds.has(aud)) {
      throw new UnauthorizedException("google_id_token_audience_mismatch");
    }

    const iss = typeof payload.iss === "string" ? payload.iss.trim() : "";
    if (iss !== "https://accounts.google.com" && iss !== "accounts.google.com") {
      throw new UnauthorizedException("google_id_token_issuer_invalid");
    }

    const email = typeof payload.email === "string" ? payload.email.trim() : "";
    if (!email) {
      throw new UnauthorizedException("google_id_token_email_missing");
    }

    const emailVerified =
      payload.email_verified === true || payload.email_verified === "true";
    if (!emailVerified) {
      throw new UnauthorizedException("google_email_not_verified");
    }

    const subject = typeof payload.sub === "string" ? payload.sub.trim() : "";
    if (!subject) {
      throw new UnauthorizedException("google_id_token_subject_missing");
    }

    return {
      sub: subject,
      email,
      name: typeof payload.name === "string" ? payload.name.trim() : "",
      picture: typeof payload.picture === "string" ? payload.picture.trim() : "",
    };
  }
}
