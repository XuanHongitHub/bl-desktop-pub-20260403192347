import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export type BrowserSlug = "bugox" | "bugium";

type BrowserUpdatePolicy = {
  mode?: string;
  required?: boolean;
  min_supported_version?: string;
  message?: string;
};

type BrowserMetadata = {
  version: string;
  downloads: Record<string, string | null>;
  update_policy?: BrowserUpdatePolicy;
  updated_at: string;
};

type BrowserReleaseState = {
  browser: Partial<Record<BrowserSlug, BrowserMetadata>>;
};

const SUPPORTED_PLATFORMS = [
  "windows-x64",
  "windows-arm64",
  "linux-x64",
  "linux-arm64",
  "macos-x64",
  "macos-arm64",
] as const;

@Injectable()
export class BrowserReleaseService {
  private readonly logger = new Logger(BrowserReleaseService.name);
  private readonly s3Client: S3Client;
  private readonly s3Bucket: string;
  private readonly s3Key: string;
  private readonly storageMode: "s3" | "file";

  constructor(private readonly configService: ConfigService) {
    const endpoint =
      this.configService.get<string>("S3_ENDPOINT") || "http://localhost:8987";
    const region = this.configService.get<string>("S3_REGION") || "us-east-1";
    const accessKeyId =
      this.configService.get<string>("S3_ACCESS_KEY_ID") || "minioadmin";
    const secretAccessKey =
      this.configService.get<string>("S3_SECRET_ACCESS_KEY") || "minioadmin";
    const forcePathStyle =
      this.configService.get<string>("S3_FORCE_PATH_STYLE") !== "false";

    this.s3Client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle,
    });

    this.s3Bucket = this.configService.get<string>("S3_BUCKET") || "buglogin-sync";
    this.s3Key =
      this.configService.get<string>("BROWSER_RELEASE_S3_KEY") ||
      "meta/browser-release-state.json";

    const configuredStorageMode = this.configService
      .get<string>("BROWSER_RELEASE_STORAGE")
      ?.trim()
      .toLowerCase();
    this.storageMode = configuredStorageMode === "file" ? "file" : "s3";
  }

  async getBrowserMetadata(
    slug: BrowserSlug,
  ): Promise<Omit<BrowserMetadata, "updated_at"> | null> {
    const state = await this.readState();
    const payload = state.browser[slug];
    if (!payload) {
      return null;
    }
    return {
      version: payload.version,
      downloads: payload.downloads,
      update_policy: payload.update_policy,
    };
  }

  async upsertBrowserRelease(
    rawBody: unknown,
  ): Promise<Omit<BrowserMetadata, "updated_at">> {
    const body = this.parseBody(rawBody);
    const state = await this.readState();
    state.browser[body.browser] = {
      version: body.version,
      downloads: body.downloads,
      update_policy: body.update_policy,
      updated_at: new Date().toISOString(),
    };
    await this.writeState(state);
    return {
      version: body.version,
      downloads: body.downloads,
      update_policy: body.update_policy,
    };
  }

  private parseBody(rawBody: unknown): {
    browser: BrowserSlug;
    version: string;
    downloads: Record<string, string | null>;
    update_policy?: BrowserUpdatePolicy;
  } {
    if (!rawBody || typeof rawBody !== "object") {
      throw new Error("invalid_payload");
    }
    const body = rawBody as Record<string, unknown>;
    const browser = String(body.browser ?? "").trim().toLowerCase();
    if (browser !== "bugox" && browser !== "bugium") {
      throw new Error("invalid_browser");
    }

    const version = String(body.version ?? "").trim();
    if (!version) {
      throw new Error("invalid_version");
    }

    const downloads: Record<string, string | null> = {};
    for (const platform of SUPPORTED_PLATFORMS) {
      downloads[platform] = null;
    }

    const rawDownloads =
      body.downloads && typeof body.downloads === "object"
        ? (body.downloads as Record<string, unknown>)
        : null;
    if (rawDownloads) {
      for (const platform of SUPPORTED_PLATFORMS) {
        const value = rawDownloads[platform];
        if (typeof value === "string" && value.trim().length > 0) {
          downloads[platform] = value.trim();
        }
      }
    }

    const platform = String(body.platform ?? "").trim().toLowerCase();
    const artifactUrl = this.extractArtifactUrl(body);
    if (artifactUrl && platform && platform in downloads && !downloads[platform]) {
      downloads[platform] = artifactUrl;
    }

    const update_policy = this.extractUpdatePolicy(body);

    return {
      browser: browser as BrowserSlug,
      version,
      downloads,
      update_policy,
    };
  }

  private extractArtifactUrl(body: Record<string, unknown>): string | null {
    const artifact = body.artifact;
    if (artifact && typeof artifact === "object") {
      const urlValue = (artifact as Record<string, unknown>).url;
      if (typeof urlValue === "string" && urlValue.trim().length > 0) {
        return urlValue.trim();
      }
    }
    return null;
  }

  private extractUpdatePolicy(
    body: Record<string, unknown>,
  ): BrowserUpdatePolicy | undefined {
    let mode: string | undefined;
    let required: boolean | undefined;
    let minSupportedVersion: string | undefined;
    let message: string | undefined;

    const rawPolicy =
      body.update_policy && typeof body.update_policy === "object"
        ? (body.update_policy as Record<string, unknown>)
        : null;

    if (rawPolicy) {
      const policyMode = rawPolicy.mode;
      if (typeof policyMode === "string" && policyMode.trim().length > 0) {
        mode = policyMode.trim();
      }
      if (typeof rawPolicy.required === "boolean") {
        required = rawPolicy.required;
      }
      const minVersion = rawPolicy.min_supported_version;
      if (typeof minVersion === "string" && minVersion.trim().length > 0) {
        minSupportedVersion = minVersion.trim();
      }
      const policyMessage = rawPolicy.message;
      if (typeof policyMessage === "string" && policyMessage.trim().length > 0) {
        message = policyMessage.trim();
      }
    }

    if (mode === undefined && typeof body.update_mode === "string") {
      const value = body.update_mode.trim();
      if (value) {
        mode = value;
      }
    }
    if (required === undefined && typeof body.required === "boolean") {
      required = body.required;
    }
    if (
      minSupportedVersion === undefined &&
      typeof body.min_supported_version === "string" &&
      body.min_supported_version.trim().length > 0
    ) {
      minSupportedVersion = body.min_supported_version.trim();
    }
    if (
      message === undefined &&
      typeof body.message === "string" &&
      body.message.trim().length > 0
    ) {
      message = body.message.trim();
    }

    if (
      mode === undefined &&
      required === undefined &&
      minSupportedVersion === undefined &&
      message === undefined
    ) {
      return undefined;
    }

    return {
      mode,
      required,
      min_supported_version: minSupportedVersion,
      message,
    };
  }

  private getStateFilePath(): string {
    const configured = this.configService
      .get<string>("BROWSER_RELEASE_STATE_FILE")
      ?.trim();
    if (configured) {
      return resolve(configured);
    }
    return resolve(process.cwd(), ".data/browser-release-state.json");
  }

  private async readState(): Promise<BrowserReleaseState> {
    if (this.storageMode === "s3") {
      const s3State = await this.readStateFromS3();
      if (s3State) {
        return s3State;
      }
    }

    return this.readStateFromFile();
  }

  private async readStateFromFile(): Promise<BrowserReleaseState> {
    const filePath = this.getStateFilePath();
    try {
      const content = await readFile(filePath, "utf8");
      const parsed = JSON.parse(content) as BrowserReleaseState;
      return parsed && parsed.browser ? parsed : { browser: {} };
    } catch {
      return { browser: {} };
    }
  }

  private async writeState(state: BrowserReleaseState): Promise<void> {
    if (this.storageMode === "s3") {
      const wroteToS3 = await this.writeStateToS3(state);
      if (wroteToS3) {
        return;
      }
    }

    await this.writeStateToFile(state);
  }

  private async writeStateToFile(state: BrowserReleaseState): Promise<void> {
    const filePath = this.getStateFilePath();
    const directory = dirname(filePath);
    await mkdir(directory, { recursive: true });
    await writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }

  private async readStateFromS3(): Promise<BrowserReleaseState | null> {
    try {
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.s3Bucket,
          Key: this.s3Key,
        }),
      );
      const body = response.Body;
      if (!body || typeof body !== "object" || !("transformToString" in body)) {
        return null;
      }
      const jsonText = await (
        body as { transformToString: () => Promise<string> }
      ).transformToString();
      const parsed = JSON.parse(jsonText) as BrowserReleaseState;
      return parsed && parsed.browser ? parsed : { browser: {} };
    } catch (error) {
      this.logger.warn(
        `Failed reading browser release state from S3; fallback to file: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private async writeStateToS3(state: BrowserReleaseState): Promise<boolean> {
    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.s3Bucket,
          Key: this.s3Key,
          Body: JSON.stringify(state, null, 2),
          ContentType: "application/json",
        }),
      );
      return true;
    } catch (error) {
      this.logger.warn(
        `Failed writing browser release state to S3; fallback to file: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return false;
    }
  }
}
