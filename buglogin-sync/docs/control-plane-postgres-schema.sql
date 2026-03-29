-- BugLogin control-plane schema bootstrap (Postgres)
-- This schema is the production target for replacing in-memory ControlService storage.

create table if not exists users (
  id text primary key,
  email text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists user_credentials (
  user_id text primary key references users(id) on delete cascade,
  password_salt text not null,
  password_hash text not null,
  platform_role text null check (platform_role in ('platform_admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists platform_admin_emails (
  email text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workspaces (
  id text primary key,
  name text not null,
  mode text not null check (mode in ('personal', 'team')),
  created_by text not null references users(id),
  created_at timestamptz not null default now()
);

create table if not exists workspace_admin_tiktok_state (
  workspace_id text primary key references workspaces(id) on delete cascade,
  bearer_key text not null default '',
  workflow_rows jsonb not null default '[]'::jsonb,
  auto_workflow_run jsonb null,
  rotation_cursor integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists workspace_tiktok_cookie_sources (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  phone text not null default '',
  api_phone text not null default '',
  cookie text not null,
  source text not null default 'excel_import' check (source in ('excel_import')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workspace_tiktok_automation_accounts (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  phone text not null default '',
  api_phone text not null default '',
  cookie text not null default '',
  username text not null default '',
  password text not null default '',
  profile_id text null,
  profile_name text null,
  status text not null default 'queued',
  last_step text null,
  last_error text null,
  source text not null default 'excel_import',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workspace_tiktok_automation_runs (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  flow_type text not null check (flow_type in ('signup', 'update_cookie')),
  mode text not null check (mode in ('auto', 'semi')),
  status text not null check (status in ('queued', 'running', 'paused', 'stopped', 'completed', 'failed')),
  account_ids jsonb not null default '[]'::jsonb,
  current_index integer not null default 0,
  active_item_id text null,
  total_count integer not null default 0,
  done_count integer not null default 0,
  failed_count integer not null default 0,
  blocked_count integer not null default 0,
  created_by text not null references users(id),
  started_at timestamptz null,
  finished_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workspace_tiktok_automation_run_items (
  id text primary key,
  run_id text not null references workspace_tiktok_automation_runs(id) on delete cascade,
  workspace_id text not null references workspaces(id) on delete cascade,
  account_id text not null,
  phone text not null default '',
  api_phone text not null default '',
  profile_id text null,
  profile_name text null,
  status text not null default 'queued',
  step text not null default 'queued',
  attempt integer not null default 0,
  username text not null default '',
  password text not null default '',
  cookie_preview text null,
  error_code text null,
  error_message text null,
  started_at timestamptz null,
  finished_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tiktok_cookie_records (
  id text primary key,
  label text not null,
  cookie text not null,
  status text not null default 'untested',
  notes text null,
  tested_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workspace_memberships (
  workspace_id text not null references workspaces(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists entitlements (
  workspace_id text primary key references workspaces(id) on delete cascade,
  state text not null check (state in ('active', 'grace_active', 'read_only')),
  grace_ends_at timestamptz null,
  updated_at timestamptz not null default now()
);

create table if not exists invites (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
  token text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz null,
  created_by text not null references users(id),
  created_at timestamptz not null default now()
);

create table if not exists share_grants (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  resource_type text not null check (resource_type in ('profile', 'group')),
  resource_id text not null,
  recipient_email text not null,
  access_mode text not null check (access_mode in ('full', 'run_sync_limited')),
  revoked_at timestamptz null,
  created_by text not null references users(id),
  created_at timestamptz not null default now()
);

create table if not exists coupons (
  id text primary key,
  code text not null,
  source text not null check (source in ('internal', 'stripe')),
  discount_percent integer not null,
  workspace_allowlist text[] not null default '{}',
  workspace_denylist text[] not null default '{}',
  max_redemptions integer not null,
  redeemed_count integer not null default 0,
  expires_at timestamptz not null,
  revoked_at timestamptz null,
  created_by text not null references users(id),
  created_at timestamptz not null default now()
);

create table if not exists license_redemptions (
  code text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  plan_id text not null check (plan_id in ('starter', 'growth', 'scale', 'custom')),
  plan_label text not null,
  profile_limit integer not null,
  billing_cycle text not null check (billing_cycle in ('monthly', 'yearly')),
  redeemed_at timestamptz not null,
  redeemed_by text not null references users(id)
);

create table if not exists audit_logs (
  id text primary key,
  action text not null,
  actor text not null,
  workspace_id text null references workspaces(id) on delete set null,
  target_id text null,
  reason text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_workspace_memberships_user on workspace_memberships(user_id);
create index if not exists idx_workspace_tiktok_cookie_sources_workspace on workspace_tiktok_cookie_sources(workspace_id, updated_at desc);
create index if not exists idx_workspace_tiktok_automation_accounts_workspace on workspace_tiktok_automation_accounts(workspace_id, updated_at desc);
create index if not exists idx_workspace_tiktok_automation_runs_workspace on workspace_tiktok_automation_runs(workspace_id, updated_at desc);
create index if not exists idx_workspace_tiktok_automation_run_items_run on workspace_tiktok_automation_run_items(run_id, updated_at desc);
create index if not exists idx_user_credentials_platform_role on user_credentials(platform_role);
create index if not exists idx_invites_workspace on invites(workspace_id);
create index if not exists idx_share_grants_workspace on share_grants(workspace_id);
create index if not exists idx_license_redemptions_workspace on license_redemptions(workspace_id);
create unique index if not exists idx_coupons_code_active on coupons(code) where revoked_at is null;
create index if not exists idx_audit_logs_workspace_created on audit_logs(workspace_id, created_at desc);
