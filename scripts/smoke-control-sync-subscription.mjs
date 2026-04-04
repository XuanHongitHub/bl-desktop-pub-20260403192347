#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const syncDir = path.join(rootDir, "buglogin-sync");

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const raw = readFileSync(filePath, "utf8");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function readMergedEnv(files) {
  const merged = {};
  for (const file of files) {
    Object.assign(merged, parseEnvFile(file));
  }
  return merged;
}

const syncEnv = readMergedEnv([
  path.join(syncDir, ".env"),
  path.join(syncDir, ".env.local"),
]);
const appEnv = readMergedEnv([
  path.join(rootDir, ".env"),
  path.join(rootDir, ".env.local"),
]);
const require = createRequire(import.meta.url);

const baseUrl = (
  process.env.SMOKE_BASE_URL ||
  process.env.BASE_URL ||
  "https://api.bugdev.site"
).replace(/\/+$/, "");
const controlToken =
  process.env.CONTROL_API_TOKEN ||
  process.env.SMOKE_CONTROL_TOKEN ||
  syncEnv.CONTROL_API_TOKEN ||
  "";
const syncToken =
  process.env.SYNC_TOKEN ||
  process.env.SMOKE_SYNC_TOKEN ||
  syncEnv.SYNC_TOKEN ||
  "";
const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.SMOKE_DATABASE_URL ||
  syncEnv.DATABASE_URL ||
  "";

if (!controlToken) {
  console.error("Missing CONTROL_API_TOKEN (env or buglogin-sync/.env.local).");
  process.exit(1);
}
if (!syncToken) {
  console.error("Missing SYNC_TOKEN (env or buglogin-sync/.env.local).");
  process.exit(1);
}

const runId = `smoke-${Date.now()}-${randomBytes(3).toString("hex")}`;
const suffix = randomBytes(3).toString("hex");
const ownerEmail = `smoke.owner.${suffix}@example.test`;
const memberEmail = `smoke.member.${suffix}@example.test`;
const password = "SmokePassw0rd!";

const resultRows = [];
const context = {
  ownerUser: null,
  memberUser: null,
  memberMembership: null,
  workspace: null,
  adminUser: null,
};

function addResult(name, status, detail) {
  resultRows.push({ name, status, detail });
}

function actorHeaders(user, roleHint = null) {
  const headers = {
    Authorization: `Bearer ${controlToken}`,
    "x-user-id": user.id,
    "x-user-email": user.email,
    "Content-Type": "application/json",
  };
  if (roleHint) headers["x-platform-role"] = roleHint;
  return headers;
}

async function requestJson(method, pathName, { headers = {}, body } = {}) {
  const response = await fetch(`${baseUrl}${pathName}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  let json = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = { raw };
  }
  return { ok: response.ok, status: response.status, json };
}

async function expectOk(name, req) {
  const res = await req;
  if (!res.ok) {
    throw new Error(`${name} failed (${res.status}): ${JSON.stringify(res.json)}`);
  }
  return res.json;
}

async function runCase(name, fn) {
  try {
    await fn();
    addResult(name, "PASS", "");
  } catch (error) {
    addResult(
      name,
      "FAIL",
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function runCaseSkippable(name, fn) {
  try {
    const skipReason = await fn();
    if (skipReason) {
      addResult(name, "SKIP", skipReason);
      return;
    }
    addResult(name, "PASS", "");
  } catch (error) {
    addResult(
      name,
      "FAIL",
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function promotePlatformAdminIfPossible(email) {
  if (!databaseUrl) {
    return "DATABASE_URL missing";
  }
  let PoolCtor;
  try {
    const pg = require(path.resolve(syncDir, "node_modules/pg"));
    PoolCtor = pg.Pool;
  } catch {
    return "pg module unavailable";
  }
  const pool = new PoolCtor({ connectionString: databaseUrl });
  try {
    await pool.query(
      `
        insert into platform_admin_emails (email, created_at, updated_at)
        values ($1, now(), now())
        on conflict (email)
        do update set updated_at = excluded.updated_at
      `,
      [email],
    );
    await pool.query(
      `
        update user_credentials
        set platform_role = 'platform_admin', updated_at = now()
        where user_id in (
          select id from users where lower(email) = lower($1)
        )
      `,
      [email],
    );
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  } finally {
    await pool.end().catch(() => undefined);
  }
}

async function findExistingPlatformAdminActor() {
  if (!databaseUrl) {
    return { actor: null, reason: "DATABASE_URL missing" };
  }
  let PoolCtor;
  try {
    const pg = require(path.resolve(syncDir, "node_modules/pg"));
    PoolCtor = pg.Pool;
  } catch {
    return { actor: null, reason: "pg module unavailable" };
  }
  const pool = new PoolCtor({ connectionString: databaseUrl });
  try {
    const res = await pool.query(
      `
        select u.id as user_id, u.email
        from user_credentials c
        join users u on u.id = c.user_id
        where c.platform_role = 'platform_admin'
        order by c.updated_at desc
        limit 1
      `,
    );
    const row = res.rows?.[0];
    if (!row?.user_id || !row?.email) {
      return { actor: null, reason: "no platform_admin user in DB" };
    }
    return {
      actor: { id: row.user_id, email: row.email, platformRole: "platform_admin" },
      reason: "",
    };
  } catch (error) {
    return {
      actor: null,
      reason: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await pool.end().catch(() => undefined);
  }
}

await runCase("Health/Ready/Config", async () => {
  await expectOk(
    "health",
    requestJson("GET", "/health", { headers: { Accept: "application/json" } }),
  );
  const ready = await expectOk(
    "readyz",
    requestJson("GET", "/readyz", { headers: { Accept: "application/json" } }),
  );
  const cfg = await expectOk(
    "config-status",
    requestJson("GET", "/config-status", { headers: { Accept: "application/json" } }),
  );
  if (!ready?.s3) {
    throw new Error("readyz.s3=false");
  }
  if (!cfg?.control?.databaseUrlConfigured) {
    throw new Error("databaseUrlConfigured=false (not production-like)");
  }
});

await runCase("Register/Login + Workspace + Invite", async () => {
  const ownerRegister = await expectOk(
    "register owner",
    requestJson("POST", "/v1/control/public/auth/register", {
      headers: { "Content-Type": "application/json" },
      body: { email: ownerEmail, password },
    }),
  );
  const memberRegister = await expectOk(
    "register member",
    requestJson("POST", "/v1/control/public/auth/register", {
      headers: { "Content-Type": "application/json" },
      body: { email: memberEmail, password },
    }),
  );
  context.ownerUser = ownerRegister.user;
  context.memberUser = memberRegister.user;

  const workspace = await expectOk(
    "create workspace",
    requestJson("POST", "/v1/control/workspaces", {
      headers: actorHeaders(context.ownerUser),
      body: { name: `Smoke ${runId}`, mode: "team" },
    }),
  );
  context.workspace = workspace;

  const invite = await expectOk(
    "invite member",
    requestJson(
      "POST",
      `/v1/control/workspaces/${encodeURIComponent(workspace.id)}/members/invite`,
      {
        headers: actorHeaders(context.ownerUser),
        body: { email: memberEmail, role: "member" },
      },
    ),
  );

  await expectOk(
    "accept invite",
    requestJson("POST", "/v1/control/auth/invite/accept", {
      headers: actorHeaders(context.memberUser),
      body: { token: invite.token },
    }),
  );

  const members = await expectOk(
    "list members",
    requestJson(
      "GET",
      `/v1/control/workspaces/${encodeURIComponent(workspace.id)}/members`,
      { headers: actorHeaders(context.ownerUser) },
    ),
  );
  if (!Array.isArray(members) || members.length < 2) {
    throw new Error(`expected >=2 members, got ${Array.isArray(members) ? members.length : "invalid"}`);
  }
  const memberMembership = members.find(
    (item) => item?.email?.toLowerCase?.() === memberEmail.toLowerCase(),
  );
  if (!memberMembership?.userId) {
    throw new Error("member membership not found after invite accept");
  }
  context.memberMembership = memberMembership;
});

await runCase("Set role for workspace member", async () => {
  const workspaceId = context.workspace.id;
  const targetUserId = context.memberMembership?.userId;
  if (!targetUserId) {
    throw new Error("missing target membership userId");
  }

  await expectOk(
    "set member role viewer",
    requestJson(
      "PATCH",
      `/v1/control/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(targetUserId)}/role`,
      {
        headers: actorHeaders(context.ownerUser),
        body: { role: "viewer", reason: `smoke ${runId} role downgrade` },
      },
    ),
  );

  let members = await expectOk(
    "list members after downgrade",
    requestJson(
      "GET",
      `/v1/control/workspaces/${encodeURIComponent(workspaceId)}/members`,
      { headers: actorHeaders(context.ownerUser) },
    ),
  );
  let current = Array.isArray(members)
    ? members.find((item) => item?.userId === targetUserId)
    : null;
  if (!current || current.role !== "viewer") {
    throw new Error("member role did not update to viewer");
  }

  await expectOk(
    "set member role member",
    requestJson(
      "PATCH",
      `/v1/control/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(targetUserId)}/role`,
      {
        headers: actorHeaders(context.ownerUser),
        body: { role: "member", reason: `smoke ${runId} role restore` },
      },
    ),
  );

  members = await expectOk(
    "list members after restore",
    requestJson(
      "GET",
      `/v1/control/workspaces/${encodeURIComponent(workspaceId)}/members`,
      { headers: actorHeaders(context.ownerUser) },
    ),
  );
  current = Array.isArray(members)
    ? members.find((item) => item?.userId === targetUserId)
    : null;
  if (!current || current.role !== "member") {
    throw new Error("member role did not restore to member");
  }
});

await runCase("Share profile/group in workspace", async () => {
  const workspaceId = context.workspace.id;

  const profileGrant = await expectOk(
    "create profile share",
    requestJson(
      "POST",
      `/v1/control/workspaces/${encodeURIComponent(workspaceId)}/share-grants`,
      {
        headers: actorHeaders(context.ownerUser),
        body: {
          resourceType: "profile",
          resourceId: `profile-${runId}`,
          recipientEmail: memberEmail,
          reason: `smoke ${runId} share profile`,
        },
      },
    ),
  );
  const groupGrant = await expectOk(
    "create group share",
    requestJson(
      "POST",
      `/v1/control/workspaces/${encodeURIComponent(workspaceId)}/share-grants`,
      {
        headers: actorHeaders(context.ownerUser),
        body: {
          resourceType: "group",
          resourceId: `group-${runId}`,
          recipientEmail: memberEmail,
          reason: `smoke ${runId} share group`,
        },
      },
    ),
  );

  const grants = await expectOk(
    "list share grants",
    requestJson(
      "GET",
      `/v1/control/workspaces/${encodeURIComponent(workspaceId)}/share-grants`,
      { headers: actorHeaders(context.ownerUser) },
    ),
  );
  if (!Array.isArray(grants) || grants.length < 2) {
    throw new Error("share grants missing after create");
  }

  const hasProfileGrant = grants.some(
    (grant) =>
      grant?.resourceType === "profile" &&
      grant?.resourceId === `profile-${runId}` &&
      grant?.recipientEmail?.toLowerCase?.() === memberEmail.toLowerCase() &&
      !grant?.revokedAt,
  );
  const hasGroupGrant = grants.some(
    (grant) =>
      grant?.resourceType === "group" &&
      grant?.resourceId === `group-${runId}` &&
      grant?.recipientEmail?.toLowerCase?.() === memberEmail.toLowerCase() &&
      !grant?.revokedAt,
  );
  if (!hasProfileGrant || !hasGroupGrant) {
    throw new Error("missing profile/group share grants");
  }

  await expectOk(
    "revoke profile share",
    requestJson(
      "POST",
      `/v1/control/workspaces/${encodeURIComponent(workspaceId)}/share-grants/${encodeURIComponent(profileGrant.id)}/revoke`,
      {
        headers: actorHeaders(context.ownerUser),
        body: { reason: `smoke ${runId} cleanup profile share` },
      },
    ),
  );
  await expectOk(
    "revoke group share",
    requestJson(
      "POST",
      `/v1/control/workspaces/${encodeURIComponent(workspaceId)}/share-grants/${encodeURIComponent(groupGrant.id)}/revoke`,
      {
        headers: actorHeaders(context.ownerUser),
        body: { reason: `smoke ${runId} cleanup group share` },
      },
    ),
  );
});

await runCaseSkippable("Promote smoke owner to platform_admin", async () => {
  const reason = await promotePlatformAdminIfPossible(context.ownerUser.email);
  return reason || "";
});

await runCaseSkippable("Resolve platform_admin actor from DB", async () => {
  const { actor, reason } = await findExistingPlatformAdminActor();
  if (!actor) {
    return reason || "platform_admin actor unavailable";
  }
  context.adminUser = actor;
  return "";
});

await runCase("Subscription activate/cancel/reactivate", async () => {
  const workspaceId = context.workspace.id;
  const activated = await expectOk(
    "billing internal activate",
    requestJson(
      "POST",
      `/v1/control/workspaces/${encodeURIComponent(workspaceId)}/billing/internal-activate`,
      {
        headers: actorHeaders(context.ownerUser),
        body: {
          planId: "starter",
          billingCycle: "monthly",
          method: "self_host_checkout",
        },
      },
    ),
  );
  if (activated.subscription?.planId !== "starter") {
    throw new Error("plan did not activate to starter");
  }

  const periodEnd = await expectOk(
    "cancel at period end",
    requestJson(
      "POST",
      `/v1/control/workspaces/${encodeURIComponent(workspaceId)}/billing/subscription/cancel`,
      {
        headers: actorHeaders(context.ownerUser),
        body: { mode: "period_end" },
      },
    ),
  );
  if (!periodEnd.subscription?.cancelAtPeriodEnd) {
    throw new Error("cancelAtPeriodEnd not set");
  }

  const reactivated = await expectOk(
    "reactivate",
    requestJson(
      "POST",
      `/v1/control/workspaces/${encodeURIComponent(workspaceId)}/billing/subscription/reactivate`,
      {
        headers: actorHeaders(context.ownerUser),
        body: {},
      },
    ),
  );
  if (reactivated.subscription?.cancelAtPeriodEnd) {
    throw new Error("reactivate failed");
  }

  const billingState = await expectOk(
    "billing state",
    requestJson(
      "GET",
      `/v1/control/workspaces/${encodeURIComponent(workspaceId)}/billing/state`,
      {
        headers: actorHeaders(context.ownerUser),
      },
    ),
  );
  if ((billingState.usage?.storageLimitMb ?? 0) <= 0) {
    throw new Error("storageLimitMb not populated");
  }
});

await runCase("S3 sync round-trip + cleanup", async () => {
  const objectKey = `${runId}/profiles/profile-a/state.json`;
  const payload = JSON.stringify({ runId, at: new Date().toISOString() });

  const presignUpload = await expectOk(
    "presign upload",
    requestJson("POST", "/v1/objects/presign-upload", {
      headers: {
        Authorization: `Bearer ${syncToken}`,
        "Content-Type": "application/json",
      },
      body: { key: objectKey, contentType: "application/json" },
    }),
  );
  const uploadRes = await fetch(presignUpload.url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: payload,
  });
  if (!uploadRes.ok) {
    throw new Error(`upload failed (${uploadRes.status})`);
  }

  const statAfterUpload = await expectOk(
    "stat after upload",
    requestJson("POST", "/v1/objects/stat", {
      headers: {
        Authorization: `Bearer ${syncToken}`,
        "Content-Type": "application/json",
      },
      body: { key: objectKey },
    }),
  );
  if (!statAfterUpload.exists) {
    throw new Error("stat.exists=false after upload");
  }

  const listed = await expectOk(
    "list prefix",
    requestJson("POST", "/v1/objects/list", {
      headers: {
        Authorization: `Bearer ${syncToken}`,
        "Content-Type": "application/json",
      },
      body: { prefix: `${runId}/profiles/` },
    }),
  );
  const existsInList =
    Array.isArray(listed.objects) &&
    listed.objects.some((obj) => obj.key === objectKey);
  if (!existsInList) {
    throw new Error("uploaded object missing in list");
  }

  const presignDownload = await expectOk(
    "presign download",
    requestJson("POST", "/v1/objects/presign-download", {
      headers: {
        Authorization: `Bearer ${syncToken}`,
        "Content-Type": "application/json",
      },
      body: { key: objectKey },
    }),
  );
  const downloadRes = await fetch(presignDownload.url);
  if (!downloadRes.ok) {
    throw new Error(`download failed (${downloadRes.status})`);
  }
  const downloadedBody = await downloadRes.text();
  if (!downloadedBody.includes(runId)) {
    throw new Error("downloaded payload mismatch");
  }

  await expectOk(
    "delete prefix",
    requestJson("POST", "/v1/objects/delete-prefix", {
      headers: {
        Authorization: `Bearer ${syncToken}`,
        "Content-Type": "application/json",
      },
      body: {
        prefix: `${runId}/`,
        tombstoneKey: `tombstones/${runId}.json`,
      },
    }),
  );
});

await runCaseSkippable("Admin workspace health + budget/usage", async () => {
  const actor = context.adminUser ?? context.ownerUser;
  const res = await requestJson("GET", "/v1/control/admin/workspace-health", {
    headers: actorHeaders(actor, "platform_admin"),
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      return "platform_admin required in server config";
    }
    throw new Error(`admin health failed (${res.status}): ${JSON.stringify(res.json)}`);
  }
  const rows = Array.isArray(res.json) ? res.json : [];
  const row = rows.find((item) => item.workspaceId === context.workspace.id);
  if (!row) {
    throw new Error("workspace missing in admin/workspace-health");
  }
  if ((row.storageLimitMb ?? 0) <= 0) {
    throw new Error("storageLimitMb missing in admin health row");
  }
  return "";
});

await runCase("Automation run conflict (2 members, 1 profile)", async () => {
  const workspaceId = context.workspace.id;
  const imported = await expectOk(
    "import automation accounts",
    requestJson(
      "POST",
      `/v1/control/workspaces/${encodeURIComponent(workspaceId)}/admin/tiktok-automation/import`,
      {
        headers: actorHeaders(context.ownerUser),
        body: {
          force: true,
          rows: [
            {
              phone: `0901${suffix}`,
              apiPhone: `api-1-${suffix}`,
              cookie: "cookie-1",
              profileId: `profile-shared-${runId}`,
              profileName: "Shared Profile",
              source: "manual",
            },
            {
              phone: `0902${suffix}`,
              apiPhone: `api-2-${suffix}`,
              cookie: "cookie-2",
              profileId: `profile-shared-${runId}`,
              profileName: "Shared Profile",
              source: "manual",
            },
          ],
        },
      },
    ),
  );
  if (!Array.isArray(imported) || imported.length < 2) {
    throw new Error("failed to import 2 automation accounts");
  }
  const selected = imported.slice(0, 2).map((row) => row.id);
  const createdRun = await expectOk(
    "create run",
    requestJson(
      "POST",
      `/v1/control/workspaces/${encodeURIComponent(workspaceId)}/admin/tiktok-automation/runs`,
      {
        headers: actorHeaders(context.ownerUser),
        body: { flowType: "signup", mode: "semi", accountIds: selected },
      },
    ),
  );
  const runIdValue = createdRun.run?.id;
  if (!runIdValue) {
    throw new Error("run id missing");
  }
  const started = await expectOk(
    "start run",
    requestJson(
      "POST",
      `/v1/control/workspaces/${encodeURIComponent(workspaceId)}/admin/tiktok-automation/runs/${encodeURIComponent(runIdValue)}/start`,
      {
        headers: actorHeaders(context.ownerUser),
        body: {},
      },
    ),
  );
  const sharedProfileItems = (started.items || []).filter(
    (item) => item.profileId === `profile-shared-${runId}`,
  );
  if (sharedProfileItems.length < 2) {
    throw new Error("expected two run items with same profileId");
  }
});

await runCaseSkippable("Entitlement forced read_only test", async () => {
  const workspaceId = context.workspace.id;
  const actor = context.adminUser ?? context.ownerUser;
  const patchRes = await requestJson(
    "PATCH",
    `/v1/control/workspaces/${encodeURIComponent(workspaceId)}/entitlement`,
    {
      headers: actorHeaders(actor, "platform_admin"),
      body: { state: "read_only", reason: `smoke-${runId}` },
    },
  );
  if (!patchRes.ok) {
    if (patchRes.status === 401 || patchRes.status === 403) {
      return "platform_admin required in server config";
    }
    throw new Error(`set entitlement failed (${patchRes.status})`);
  }
  const ent = patchRes.json;
  if (ent.state !== "read_only") {
    throw new Error("entitlement state did not become read_only");
  }
  await expectOk(
    "restore entitlement active",
    requestJson(
      "PATCH",
      `/v1/control/workspaces/${encodeURIComponent(workspaceId)}/entitlement`,
      {
        headers: actorHeaders(actor, "platform_admin"),
        body: { state: "active", reason: `smoke-restore-${runId}` },
      },
    ),
  );
  return "";
});

await runCase("Auto-update config readiness snapshot", async () => {
  const enabledRaw = (
    process.env.BUGLOGIN_APP_AUTO_UPDATE_ENABLED ||
    appEnv.BUGLOGIN_APP_AUTO_UPDATE_ENABLED ||
    ""
  ).trim();
  const isEnabled =
    enabledRaw === "1" || enabledRaw.toLowerCase() === "true";
  const channel = (
    process.env.BUGLOGIN_APP_AUTO_UPDATE_CHANNEL ||
    appEnv.BUGLOGIN_APP_AUTO_UPDATE_CHANNEL ||
    "stable"
  ).trim();
  if (!channel) {
    throw new Error("auto-update channel missing");
  }
  addResult(
    "Auto-update mode",
    "INFO",
    isEnabled ? `enabled; channel=${channel}` : `disabled; channel=${channel}`,
  );
});

const total = resultRows.length;
const pass = resultRows.filter((row) => row.status === "PASS").length;
const fail = resultRows.filter((row) => row.status === "FAIL").length;
const skip = resultRows.filter((row) => row.status === "SKIP").length;

console.log(`Smoke target: ${baseUrl}`);
console.log(`Run ID: ${runId}`);
console.log("");
for (const row of resultRows) {
  const detail = row.detail ? ` | ${row.detail}` : "";
  console.log(`[${row.status}] ${row.name}${detail}`);
}
console.log("");
console.log(`Summary: total=${total}, pass=${pass}, fail=${fail}, skip=${skip}`);

if (fail > 0) {
  process.exitCode = 2;
}
