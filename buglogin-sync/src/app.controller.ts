import { Controller, Get, HttpException, HttpStatus } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppService } from "./app.service.js";
import { SyncService } from "./sync/sync.service.js";

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly syncService: SyncService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get("health")
  getHealth(): { status: string } {
    return { status: "ok" };
  }

  @Get("readyz")
  async getReadiness(): Promise<{ status: string; s3: boolean }> {
    const s3Ready = await this.syncService.checkS3Connectivity();
    if (!s3Ready) {
      throw new HttpException(
        { status: "not ready", s3: false },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return { status: "ready", s3: true };
  }

  @Get("config-status")
  getConfigStatus() {
    const syncTokenConfigured = Boolean(
      this.configService.get<string>("SYNC_TOKEN"),
    );
    const syncJwtConfigured = Boolean(
      this.configService.get<string>("SYNC_JWT_PUBLIC_KEY"),
    );
    const s3EndpointConfigured = Boolean(
      this.configService.get<string>("S3_ENDPOINT"),
    );
    const s3BucketConfigured = Boolean(this.configService.get<string>("S3_BUCKET"));
    const stripeSecretConfigured = Boolean(
      this.configService.get<string>("STRIPE_SECRET_KEY"),
    );
    const stripeWebhookConfigured = Boolean(
      this.configService.get<string>("STRIPE_WEBHOOK_SECRET"),
    );
    const controlApiTokenConfigured = Boolean(
      this.configService.get<string>("CONTROL_API_TOKEN"),
    );
    const databaseUrlConfigured = Boolean(
      this.configService.get<string>("DATABASE_URL"),
    );
    const sqliteFileConfigured = databaseUrlConfigured
      ? false
      : Boolean(
          this.configService.get<string>("CONTROL_SQLITE_FILE") ||
            process.env.CONTROL_SQLITE_FILE ||
            "./.data/control-state.sqlite",
        );
    const controlStateFileConfigured = Boolean(
      this.configService.get<string>("CONTROL_STATE_FILE"),
    );

    return {
      auth: {
        syncTokenConfigured,
        syncJwtConfigured,
      },
      control: {
        controlApiTokenConfigured,
        databaseUrlConfigured,
        sqliteFileConfigured,
        controlStateFileConfigured: databaseUrlConfigured
          ? false
          : !sqliteFileConfigured && controlStateFileConfigured,
      },
      stripe: {
        stripeSecretConfigured,
        stripeWebhookConfigured,
      },
      s3: {
        s3EndpointConfigured,
        s3BucketConfigured,
      },
    };
  }
}
