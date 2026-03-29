import { NestFactory } from "@nestjs/core";
import { json, urlencoded } from "express";
import { existsSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { AppModule } from "./app.module.js";

export const LOCAL_CONTROL_DEFAULT_TOKEN = "dev-sync-token-change-me";

function hasNonEmptyValue(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isEmbeddedLocalControlEnv(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.BUGLOGIN_EMBEDDED_LOCAL_CONTROL === "1";
}

function loadEnvFiles() {
  const files = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), ".env.local"),
  ];
  for (const filePath of files) {
    if (!existsSync(filePath)) {
      continue;
    }
    const content = readFileSync(filePath, "utf8");
    for (const rawLine of content.split(/\r?\n/u)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }
      const separatorIndex = line.indexOf("=");
      if (separatorIndex <= 0) {
        continue;
      }
      const key = line.slice(0, separatorIndex).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(key)) {
        continue;
      }
      if (process.env[key] !== undefined) {
        continue;
      }
      let value = line.slice(separatorIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

export function applyEmbeddedLocalControlDefaults(
  env: NodeJS.ProcessEnv = process.env,
) {
  if (!isEmbeddedLocalControlEnv(env)) {
    return;
  }

  if (!hasNonEmptyValue(env.PORT)) {
    env.PORT = "12342";
  }
  if (!hasNonEmptyValue(env.SYNC_TOKEN)) {
    env.SYNC_TOKEN = LOCAL_CONTROL_DEFAULT_TOKEN;
  }
  if (!hasNonEmptyValue(env.CONTROL_API_TOKEN)) {
    env.CONTROL_API_TOKEN = env.SYNC_TOKEN;
  }
}

export function validateEnv(env: NodeJS.ProcessEnv = process.env) {
  const missing: string[] = [];

  if (!hasNonEmptyValue(env.SYNC_TOKEN) && !hasNonEmptyValue(env.SYNC_JWT_PUBLIC_KEY)) {
    missing.push("SYNC_TOKEN or SYNC_JWT_PUBLIC_KEY");
  }
  if (!hasNonEmptyValue(env.CONTROL_API_TOKEN) && !hasNonEmptyValue(env.SYNC_TOKEN)) {
    missing.push("CONTROL_API_TOKEN or SYNC_TOKEN");
  }

  if (missing.length > 0) {
    throw new Error(
      `[config-status] Missing required production configuration: ${missing.join(", ")}`,
    );
  }
}

async function bootstrap() {
  loadEnvFiles();
  applyEmbeddedLocalControlDefaults();
  validateEnv();

  const app = await NestFactory.create(AppModule);
  app.use(json({ limit: "2mb" }));
  app.use(urlencoded({ extended: true, limit: "2mb" }));

  app.enableCors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-user-id",
      "x-user-email",
      "x-platform-role",
      "x-bugidea-bearer",
    ],
  });

  const port = process.env.PORT ?? 3929;
  await app.listen(port, "0.0.0.0");
  console.log(`BugLogin Sync service running on 0.0.0.0:${port}`);
}

function isDirectExecution(): boolean {
  const entrypoint = process.argv[1];
  if (!entrypoint) {
    return false;
  }

  const normalizeEntrypoint = (value: string) => {
    const normalized = resolve(value);
    return extname(normalized) === ".js" ? normalized : `${normalized}.js`;
  };

  if (typeof require !== "undefined" && require.main) {
    return normalizeEntrypoint(require.main.filename) === normalizeEntrypoint(entrypoint);
  }

  return normalizeEntrypoint(entrypoint).endsWith("main.js");
}

if (isDirectExecution()) {
  void bootstrap();
}
