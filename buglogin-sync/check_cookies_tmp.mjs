import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const { Client } = pg;

function loadEnv() {
  const files = [path.resolve(".env.local"), path.resolve(".env")];
  const env = { ...process.env };
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    for (const raw of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const i = line.indexOf("=");
      if (i <= 0) continue;
      const k = line.slice(0, i).trim();
      let v = line.slice(i + 1).trim();
      if ((v.startsWith("\"") && v.endsWith("\"")) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      env[k] = v;
    }
  }
  return env;
}

const env = loadEnv();
const c = new Client({ connectionString: env.DATABASE_URL });
await c.connect();

const wsOld = "a5de8d9e-1c0c-404d-9f0d-0464bd3d5a21";
const wsNew = "da5ad292-cdcc-4f3d-a652-7cb1ecfd70ae";

const byWs = await c.query(
  `select workspace_id, count(*)::int as cookie_sources
   from workspace_tiktok_cookie_sources
   where workspace_id = any($1::text[])
   group by workspace_id
   order by workspace_id`,
  [[wsOld, wsNew]],
);

const accSummary = await c.query(
  `select workspace_id,
          count(*)::int as total_accounts,
          count(*) filter (where coalesce(cookie,'')='')::int as empty_cookie_accounts,
          count(*) filter (where coalesce(cookie,'')<>'')::int as non_empty_cookie_accounts
   from workspace_tiktok_automation_accounts
   where workspace_id = any($1::text[])
   group by workspace_id
   order by workspace_id`,
  [[wsOld, wsNew]],
);

const sampleNew = await c.query(
  `select id, phone, api_phone, length(coalesce(cookie,''))::int as cookie_len, status, updated_at
   from workspace_tiktok_automation_accounts
   where workspace_id=$1
   order by updated_at desc
   limit 12`,
  [wsNew],
);

console.log("cookie_sources_by_workspace=", JSON.stringify(byWs.rows, null, 2));
console.log("accounts_cookie_summary=", JSON.stringify(accSummary.rows, null, 2));
console.log("new_workspace_sample=", JSON.stringify(sampleNew.rows, null, 2));

await c.end();
