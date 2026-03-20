import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

function validateEnv() {
  if (!process.env.SYNC_TOKEN && !process.env.SYNC_JWT_PUBLIC_KEY) {
    console.warn(
      "[config-status] Neither SYNC_TOKEN nor SYNC_JWT_PUBLIC_KEY is configured. Sync auth endpoints will stay in pending_config state.",
    );
  }
}

async function bootstrap() {
  validateEnv();

  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-user-id",
      "x-user-email",
      "x-platform-role",
    ],
  });

  const port = process.env.PORT ?? 3929;
  await app.listen(port);
  console.log(`BugLogin Sync service running on port ${port}`);
}
void bootstrap();
