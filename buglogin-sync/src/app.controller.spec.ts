import { Test, type TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { SyncService } from "./sync/sync.service.js";

describe("AppController", () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: SyncService,
          useValue: {
            checkS3Connectivity: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              switch (key) {
                case "SYNC_TOKEN":
                  return "test-token";
                case "S3_ENDPOINT":
                  return "http://localhost:9000";
                case "S3_BUCKET":
                  return "buglogin-sync";
                default:
                  return undefined;
              }
            }),
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe("root", () => {
    it("should return service name", () => {
      expect(appController.getHello()).toBe("BugLogin Sync Service");
    });
  });

  describe("health", () => {
    it("should return ok status", () => {
      expect(appController.getHealth()).toEqual({ status: "ok" });
    });
  });

  describe("config-status", () => {
    it("returns config readiness flags", () => {
      expect(appController.getConfigStatus()).toEqual({
        auth: {
          syncTokenConfigured: true,
          syncJwtConfigured: false,
        },
        control: {
          controlApiTokenConfigured: false,
          databaseUrlConfigured: false,
          sqliteFileConfigured: true,
          controlStateFileConfigured: false,
        },
        stripe: {
          stripeSecretConfigured: false,
          stripeWebhookConfigured: false,
        },
        s3: {
          s3EndpointConfigured: true,
          s3BucketConfigured: true,
        },
      });
    });
  });
});
