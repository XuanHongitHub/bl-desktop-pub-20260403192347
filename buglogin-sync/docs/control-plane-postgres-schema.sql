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

create table if not exists workspaces (
  id text primary key,
  name text not null,
  mode text not null check (mode in ('personal', 'team')),
  created_by text not null references users(id),
  created_at timestamptz not null default now()
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
create index if not exists idx_user_credentials_platform_role on user_credentials(platform_role);
create index if not exists idx_invites_workspace on invites(workspace_id);
create index if not exists idx_share_grants_workspace on share_grants(workspace_id);
create index if not exists idx_license_redemptions_workspace on license_redemptions(workspace_id);
create unique index if not exists idx_coupons_code_active on coupons(code) where revoked_at is null;
create index if not exists idx_audit_logs_workspace_created on audit_logs(workspace_id, created_at desc);
