#!/usr/bin/env node
import { createHmac, timingSafeEqual } from "node:crypto";
import http from "node:http";
import { spawn } from "node:child_process";

const PORT = Number.parseInt(process.env.WEBHOOK_PORT || "9912", 10);
const HOST = process.env.WEBHOOK_HOST || "127.0.0.1";
const WEBHOOK_PATH = process.env.WEBHOOK_PATH || "/github/deploy";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";
const EXPECTED_REPO =
  process.env.WEBHOOK_REPO || "keyduc91/Malvanut-Login";
const EXPECTED_REF = process.env.WEBHOOK_REF || "refs/heads/main";
const DEPLOY_CMD =
  process.env.WEBHOOK_DEPLOY_CMD ||
  "cd /var/www/buglogin/app && VERIFY_STRICT=1 bash scripts/deploy-vps-web-api.sh";

if (!WEBHOOK_SECRET.trim()) {
  console.error("[webhook] Missing WEBHOOK_SECRET");
  process.exit(1);
}

let running = false;
let queued = false;

function sign(rawBody) {
  const digest = createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
  return `sha256=${digest}`;
}

function verifySignature(signatureHeader, rawBody) {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }
  const expected = Buffer.from(sign(rawBody));
  const provided = Buffer.from(signatureHeader);
  if (expected.length !== provided.length) {
    return false;
  }
  return timingSafeEqual(expected, provided);
}

function runDeploy() {
  if (running) {
    queued = true;
    console.log("[webhook] Deploy already running; queued next deploy.");
    return;
  }
  running = true;
  queued = false;
  console.log(`[webhook] Starting deploy: ${DEPLOY_CMD}`);
  const child = spawn("bash", ["-lc", DEPLOY_CMD], {
    stdio: "inherit",
    env: process.env,
  });
  child.on("exit", (code) => {
    running = false;
    if (code === 0) {
      console.log("[webhook] Deploy completed.");
    } else {
      console.error(`[webhook] Deploy failed (exit ${code ?? "null"}).`);
    }
    if (queued) {
      console.log("[webhook] Running queued deploy now.");
      runDeploy();
    }
  });
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  if (req.method !== "POST" || req.url !== WEBHOOK_PATH) {
    return send(res, 404, { ok: false, message: "not_found" });
  }

  const chunks = [];
  let size = 0;
  req.on("data", (chunk) => {
    size += chunk.length;
    if (size > 1024 * 1024) {
      req.destroy(new Error("payload_too_large"));
      return;
    }
    chunks.push(chunk);
  });

  req.on("error", () => {
    send(res, 400, { ok: false, message: "invalid_request" });
  });

  req.on("end", () => {
    const rawBody = Buffer.concat(chunks);
    const signatureHeader = req.headers["x-hub-signature-256"];
    const event = req.headers["x-github-event"];

    if (!verifySignature(String(signatureHeader || ""), rawBody)) {
      return send(res, 401, { ok: false, message: "invalid_signature" });
    }

    if (event === "ping") {
      return send(res, 200, { ok: true, message: "pong" });
    }

    if (event !== "push") {
      return send(res, 202, { ok: true, message: "ignored_event" });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return send(res, 400, { ok: false, message: "invalid_json" });
    }

    const repo = payload?.repository?.full_name;
    const ref = payload?.ref;
    if (repo !== EXPECTED_REPO || ref !== EXPECTED_REF) {
      return send(res, 202, {
        ok: true,
        message: "ignored_push",
        repo,
        ref,
      });
    }

    runDeploy();
    return send(res, 202, { ok: true, message: "deploy_started" });
  });
});

server.listen(PORT, HOST, () => {
  console.log(
    `[webhook] Listening on http://${HOST}:${PORT}${WEBHOOK_PATH} for ${EXPECTED_REPO} ${EXPECTED_REF}`,
  );
});
