import type { BrowserProfile, GroupWithCount } from "@/types";

export type ScopedEntityType = "profiles" | "groups" | "proxies" | "vpns";

export interface DataScopeContext {
  accountId: string;
  workspaceId: string;
}

interface ScopeRegistry {
  profiles: Record<string, string>;
  groups: Record<string, string>;
  proxies: Record<string, string>;
  vpns: Record<string, string>;
}

const DATA_SCOPE_CONTEXT_KEY = "buglogin.dataScope.context.v1";
const DATA_SCOPE_REGISTRY_KEY = "buglogin.dataScope.registry.v1";
export const DATA_SCOPE_CHANGED_EVENT = "buglogin:data-scope-changed";

const DEFAULT_SCOPE: DataScopeContext = {
  accountId: "guest",
  workspaceId: "personal",
};

const EMPTY_REGISTRY: ScopeRegistry = {
  profiles: {},
  groups: {},
  proxies: {},
  vpns: {},
};

function canUseStorage(): boolean {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function normalizeScopeContext(
  scope: Partial<DataScopeContext> | null | undefined,
): DataScopeContext {
  const accountId = scope?.accountId?.trim() || DEFAULT_SCOPE.accountId;
  const workspaceId = scope?.workspaceId?.trim() || DEFAULT_SCOPE.workspaceId;
  return {
    accountId,
    workspaceId,
  };
}

function parseContext(raw: string | null): DataScopeContext {
  if (!raw) {
    return DEFAULT_SCOPE;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<DataScopeContext>;
    return normalizeScopeContext(parsed);
  } catch {
    return DEFAULT_SCOPE;
  }
}

function cloneEmptyRegistry(): ScopeRegistry {
  return {
    profiles: {},
    groups: {},
    proxies: {},
    vpns: {},
  };
}

function parseRegistry(raw: string | null): ScopeRegistry {
  if (!raw) {
    return cloneEmptyRegistry();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ScopeRegistry>;
    return {
      profiles: parsed.profiles ?? {},
      groups: parsed.groups ?? {},
      proxies: parsed.proxies ?? {},
      vpns: parsed.vpns ?? {},
    };
  } catch {
    return cloneEmptyRegistry();
  }
}

// In-memory cache to avoid re-parsing localStorage JSON on every call.
let registryCache: ScopeRegistry | null = null;

function readRegistry(): ScopeRegistry {
  if (!canUseStorage()) {
    return EMPTY_REGISTRY;
  }
  if (registryCache) {
    return registryCache;
  }
  registryCache = parseRegistry(
    window.localStorage.getItem(DATA_SCOPE_REGISTRY_KEY),
  );
  return registryCache;
}

function writeRegistry(registry: ScopeRegistry): void {
  if (!canUseStorage()) {
    return;
  }
  registryCache = registry;
  window.localStorage.setItem(
    DATA_SCOPE_REGISTRY_KEY,
    JSON.stringify(registry),
  );
}

// Invalidate cache when another tab/window writes to the same key.
if (canUseStorage()) {
  window.addEventListener("storage", (event) => {
    if (event.key === DATA_SCOPE_REGISTRY_KEY) {
      registryCache = null;
    }
  });
}

function emitDataScopeChanged(scope?: DataScopeContext): void {
  if (!canUseStorage()) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<DataScopeContext>(DATA_SCOPE_CHANGED_EVENT, {
      detail: scope ?? getCurrentDataScope(),
    }),
  );
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function toDataScopeKey(scope: DataScopeContext): string {
  return `${scope.accountId}::${scope.workspaceId}`;
}

export function getCurrentDataScope(): DataScopeContext {
  if (!canUseStorage()) {
    return DEFAULT_SCOPE;
  }
  return parseContext(window.localStorage.getItem(DATA_SCOPE_CONTEXT_KEY));
}

export function setCurrentDataScope(
  scope: Partial<DataScopeContext> | null | undefined,
): void {
  if (!canUseStorage()) {
    return;
  }

  const nextScope = normalizeScopeContext(scope);
  const currentScope = getCurrentDataScope();
  const hasChanged =
    currentScope.accountId !== nextScope.accountId ||
    currentScope.workspaceId !== nextScope.workspaceId;

  window.localStorage.setItem(
    DATA_SCOPE_CONTEXT_KEY,
    JSON.stringify(nextScope),
  );

  if (!hasChanged) {
    return;
  }

  emitDataScopeChanged(nextScope);
}

interface ScopeEntitiesOptions {
  keepGlobalIds?: string[];
}

export function scopeEntitiesForContext<T>(
  entity: ScopedEntityType,
  rows: T[],
  getId: (row: T) => string | null | undefined,
  scope: DataScopeContext,
  options?: ScopeEntitiesOptions,
): T[] {
  if (!canUseStorage()) {
    return rows;
  }

  const keepGlobalIds = new Set(options?.keepGlobalIds ?? []);
  const scopeKey = toDataScopeKey(scope);
  const registry = readRegistry();
  const entityRegistry = registry[entity];
  let didMutate = false;
  const filteredRows: T[] = [];

  for (const row of rows) {
    const rawId = getId(row);
    if (!rawId) {
      continue;
    }
    const id = rawId.trim();
    if (!id) {
      continue;
    }

    if (keepGlobalIds.has(id)) {
      filteredRows.push(row);
      continue;
    }

    let assignedScopeKey = entityRegistry[id];
    if (!assignedScopeKey) {
      assignedScopeKey = scopeKey;
      entityRegistry[id] = assignedScopeKey;
      didMutate = true;
    }

    if (assignedScopeKey === scopeKey) {
      filteredRows.push(row);
    }
  }

  if (didMutate) {
    writeRegistry(registry);
    emitDataScopeChanged(scope);
  }

  return filteredRows;
}

export function scopeEntities<T>(
  entity: ScopedEntityType,
  rows: T[],
  getId: (row: T) => string | null | undefined,
  options?: ScopeEntitiesOptions,
): T[] {
  return scopeEntitiesForContext(
    entity,
    rows,
    getId,
    getCurrentDataScope(),
    options,
  );
}

export function distributeUnscopedEntityIdsForAccount(
  entity: ScopedEntityType,
  ids: string[],
  accountScopeKeys: string[],
  preferredScopeKey?: string,
): boolean {
  if (!canUseStorage()) {
    return false;
  }

  const sanitizedScopeKeys = Array.from(
    new Set(accountScopeKeys.map((value) => value.trim()).filter(Boolean)),
  );

  if (sanitizedScopeKeys.length === 0) {
    return false;
  }

  const registry = readRegistry();
  const entityRegistry = registry[entity];
  let didMutate = false;

  for (const rawId of ids) {
    const id = rawId.trim();
    if (!id || entityRegistry[id]) {
      continue;
    }
    const hasPreferred =
      preferredScopeKey && sanitizedScopeKeys.includes(preferredScopeKey);
    const targetScopeKey = hasPreferred
      ? preferredScopeKey!
      : sanitizedScopeKeys[0];
    entityRegistry[id] = targetScopeKey;
    didMutate = true;
  }

  if (didMutate) {
    writeRegistry(registry);
  }
  return didMutate;
}

export function getScopedEntityCountsForWorkspaces(
  entity: ScopedEntityType,
  ids: string[],
  accountId: string,
  workspaceIds: string[],
): Record<string, number> {
  const sanitizedWorkspaceIds = Array.from(
    new Set(workspaceIds.map((value) => value.trim()).filter(Boolean)),
  );
  const counts: Record<string, number> = {};
  for (const workspaceId of sanitizedWorkspaceIds) {
    counts[workspaceId] = 0;
  }

  if (!canUseStorage() || sanitizedWorkspaceIds.length === 0) {
    return counts;
  }

  const workspaceIdByScopeKey = new Map<string, string>();
  for (const workspaceId of sanitizedWorkspaceIds) {
    workspaceIdByScopeKey.set(
      toDataScopeKey({ accountId, workspaceId }),
      workspaceId,
    );
  }

  const registry = readRegistry();
  const entityRegistry = registry[entity];

  for (const rawId of ids) {
    const id = rawId.trim();
    if (!id) {
      continue;
    }

    const scopeKey = entityRegistry[id];
    if (!scopeKey) {
      continue;
    }

    const workspaceId = workspaceIdByScopeKey.get(scopeKey);
    if (!workspaceId) {
      continue;
    }
    counts[workspaceId] = (counts[workspaceId] ?? 0) + 1;
  }

  return counts;
}

export function migrateDataScopeAccount(
  fromAccountId: string,
  toAccountId: string,
  allowedWorkspaceIds: string[],
  preferredWorkspaceId?: string,
): boolean {
  if (!canUseStorage()) {
    return false;
  }

  const sourceAccountId = fromAccountId.trim();
  const targetAccountId = toAccountId.trim();
  if (
    !sourceAccountId ||
    !targetAccountId ||
    sourceAccountId === targetAccountId
  ) {
    return false;
  }

  const sanitizedWorkspaceIds = Array.from(
    new Set(allowedWorkspaceIds.map((value) => value.trim()).filter(Boolean)),
  );
  if (sanitizedWorkspaceIds.length === 0) {
    return false;
  }

  const sanitizedPreferredWorkspaceId = preferredWorkspaceId?.trim() || "";
  const fallbackWorkspaceId = sanitizedWorkspaceIds.includes(
    sanitizedPreferredWorkspaceId,
  )
    ? sanitizedPreferredWorkspaceId
    : sanitizedWorkspaceIds[0];
  if (!fallbackWorkspaceId) {
    return false;
  }
  const allowedWorkspaceSet = new Set(sanitizedWorkspaceIds);

  const registry = readRegistry();
  let didMutate = false;

  const migrateEntity = (entity: ScopedEntityType) => {
    const entityRegistry = registry[entity];
    for (const [id, scopeKey] of Object.entries(entityRegistry)) {
      if (!scopeKey || !scopeKey.startsWith(`${sourceAccountId}::`)) {
        continue;
      }
      const currentWorkspaceId = scopeKey.split("::")[1]?.trim() || "";
      const targetWorkspaceId: string = allowedWorkspaceSet.has(currentWorkspaceId)
        ? currentWorkspaceId
        : fallbackWorkspaceId;
      const targetScopeKey = toDataScopeKey({
        accountId: targetAccountId,
        workspaceId: targetWorkspaceId,
      });
      if (entityRegistry[id] !== targetScopeKey) {
        entityRegistry[id] = targetScopeKey;
        didMutate = true;
      }
    }
  };

  migrateEntity("profiles");
  migrateEntity("groups");
  migrateEntity("proxies");
  migrateEntity("vpns");

  if (didMutate) {
    writeRegistry(registry);
  }

  return didMutate;
}

export function normalizeDataScopeWorkspacesForAccount(
  accountId: string,
  allowedWorkspaceIds: string[],
  preferredWorkspaceId?: string,
): boolean {
  if (!canUseStorage()) {
    return false;
  }

  const sanitizedAccountId = accountId.trim();
  if (!sanitizedAccountId) {
    return false;
  }

  const sanitizedWorkspaceIds = Array.from(
    new Set(allowedWorkspaceIds.map((value) => value.trim()).filter(Boolean)),
  );
  if (sanitizedWorkspaceIds.length === 0) {
    return false;
  }

  const sanitizedPreferredWorkspaceId = preferredWorkspaceId?.trim() || "";
  const fallbackWorkspaceId = sanitizedWorkspaceIds.includes(
    sanitizedPreferredWorkspaceId,
  )
    ? sanitizedPreferredWorkspaceId
    : sanitizedWorkspaceIds[0];
  if (!fallbackWorkspaceId) {
    return false;
  }
  const allowedWorkspaceSet = new Set(sanitizedWorkspaceIds);

  const registry = readRegistry();
  let didMutate = false;

  const normalizeEntity = (entity: ScopedEntityType) => {
    const entityRegistry = registry[entity];
    for (const [id, scopeKey] of Object.entries(entityRegistry)) {
      if (!scopeKey || !scopeKey.startsWith(`${sanitizedAccountId}::`)) {
        continue;
      }

      const workspaceId = scopeKey.split("::")[1]?.trim() || "";
      if (allowedWorkspaceSet.has(workspaceId)) {
        continue;
      }

      const targetScopeKey = toDataScopeKey({
        accountId: sanitizedAccountId,
        workspaceId: fallbackWorkspaceId as string,
      });
      if (entityRegistry[id] !== targetScopeKey) {
        entityRegistry[id] = targetScopeKey;
        didMutate = true;
      }
    }
  };

  normalizeEntity("profiles");
  normalizeEntity("groups");
  normalizeEntity("proxies");
  normalizeEntity("vpns");

  if (didMutate) {
    writeRegistry(registry);
  }

  return didMutate;
}

export function rebalanceEntityScopesForAccountIfBiased(
  entity: ScopedEntityType,
  ids: string[],
  accountId: string,
  workspaceIds: string[],
): boolean {
  if (!canUseStorage()) {
    return false;
  }

  const sanitizedAccountId = accountId.trim();
  const sanitizedWorkspaceIds = Array.from(
    new Set(workspaceIds.map((value) => value.trim()).filter(Boolean)),
  );

  if (!sanitizedAccountId || sanitizedWorkspaceIds.length <= 1) {
    return false;
  }

  const idList = ids.map((value) => value.trim()).filter(Boolean);
  if (idList.length < 2) {
    return false;
  }

  const registry = readRegistry();
  const entityRegistry = registry[entity];
  const accountScopePrefix = `${sanitizedAccountId}::`;
  const counts = new Map<string, number>();

  for (const id of idList) {
    const scopeKey = entityRegistry[id];
    if (!scopeKey || !scopeKey.startsWith(accountScopePrefix)) {
      continue;
    }
    counts.set(scopeKey, (counts.get(scopeKey) ?? 0) + 1);
  }

  if (counts.size !== 1) {
    return false;
  }

  let didMutate = false;
  const scopeKeys = sanitizedWorkspaceIds.map((workspaceId) =>
    toDataScopeKey({ accountId: sanitizedAccountId, workspaceId }),
  );

  for (const id of idList) {
    const scopeKey = entityRegistry[id];
    if (!scopeKey || !scopeKey.startsWith(accountScopePrefix)) {
      continue;
    }
    const targetScopeKey = scopeKeys[hashString(id) % scopeKeys.length];
    if (scopeKey !== targetScopeKey) {
      entityRegistry[id] = targetScopeKey;
      didMutate = true;
    }
  }

  if (didMutate) {
    writeRegistry(registry);
  }

  return didMutate;
}

interface EntityProfileReference {
  entityId: string;
  profileId: string;
}

export function alignEntityScopesFromProfileReferences(
  accountId: string,
  entity: "groups" | "proxies" | "vpns",
  references: EntityProfileReference[],
): boolean {
  if (!canUseStorage()) {
    return false;
  }

  const sanitizedAccountId = accountId.trim();
  if (!sanitizedAccountId || references.length === 0) {
    return false;
  }

  const registry = readRegistry();
  const profilesRegistry = registry.profiles;
  const entityRegistry = registry[entity];
  const accountPrefix = `${sanitizedAccountId}::`;
  const votes = new Map<string, Map<string, number>>();

  for (const reference of references) {
    const entityId = reference.entityId.trim();
    const profileId = reference.profileId.trim();
    if (!entityId || !profileId) {
      continue;
    }
    const profileScope = profilesRegistry[profileId];
    if (!profileScope || !profileScope.startsWith(accountPrefix)) {
      continue;
    }

    let entityVotes = votes.get(entityId);
    if (!entityVotes) {
      entityVotes = new Map<string, number>();
      votes.set(entityId, entityVotes);
    }
    entityVotes.set(profileScope, (entityVotes.get(profileScope) ?? 0) + 1);
  }

  let didMutate = false;
  for (const [entityId, scopeVotes] of votes.entries()) {
    let winnerScope: string | null = null;
    let winnerCount = -1;
    for (const [scopeKey, count] of scopeVotes.entries()) {
      if (count > winnerCount) {
        winnerScope = scopeKey;
        winnerCount = count;
      }
    }
    if (!winnerScope) {
      continue;
    }
    if (entityRegistry[entityId] !== winnerScope) {
      entityRegistry[entityId] = winnerScope;
      didMutate = true;
    }
  }

  if (didMutate) {
    writeRegistry(registry);
  }

  return didMutate;
}

export function applyScopedGroupCounts(
  allGroups: GroupWithCount[],
  scopedProfiles: Pick<BrowserProfile, "group_id">[],
  defaultGroupName = "Default",
): GroupWithCount[] {
  const counts = new Map<string, number>();
  const knownGroupIds = new Set(allGroups.map((group) => group.id));
  knownGroupIds.add("default");

  for (const profile of scopedProfiles) {
    const rawGroupId = profile.group_id || "default";
    const groupId = knownGroupIds.has(rawGroupId) ? rawGroupId : "default";
    counts.set(groupId, (counts.get(groupId) ?? 0) + 1);
  }

  const groupsById = new Map<string, GroupWithCount>();
  for (const group of allGroups) {
    groupsById.set(group.id, {
      ...group,
      count: counts.get(group.id) ?? 0,
    });
  }

  if (!groupsById.has("default")) {
    groupsById.set("default", {
      id: "default",
      name: defaultGroupName,
      count: counts.get("default") ?? 0,
      sync_enabled: false,
      last_sync: undefined,
    });
  } else {
    const defaultGroup = groupsById.get("default");
    if (defaultGroup) {
      groupsById.set("default", {
        ...defaultGroup,
        count: counts.get("default") ?? 0,
      });
    }
  }

  return Array.from(groupsById.values()).sort((left, right) => {
    if (left.id === "default") {
      return -1;
    }
    if (right.id === "default") {
      return 1;
    }
    return left.name.localeCompare(right.name);
  });
}
