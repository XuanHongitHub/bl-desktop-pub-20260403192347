type WorkflowCookieHydrationRow = {
  profileId: string;
  localCookieSnapshot?: string | null;
  cookiePreview?: string | null;
  status?: string | null;
};

type WorkflowCookiePreviewRecord = {
  preview: string;
  snapshot: string;
};

export function shouldHydrateWorkflowCookiePreviewRow(
  row: WorkflowCookieHydrationRow,
): boolean {
  if (!row.localCookieSnapshot?.trim()) {
    return true;
  }
  const preview = row.cookiePreview?.trim();
  if (!preview) {
    return true;
  }
  return (
    (row.status === "started" || row.status === "cookie_ready") &&
    !preview.includes("=")
  );
}

export function selectWorkflowCookieProfilesForHydration(
  rows: WorkflowCookieHydrationRow[],
  input: {
    hydratedProfileIds: Set<string>;
    cachedProfileIds?: Set<string>;
    limit: number;
  },
): string[] {
  const selected: string[] = [];
  for (const row of rows) {
    if (!shouldHydrateWorkflowCookiePreviewRow(row)) {
      continue;
    }
    if (input.hydratedProfileIds.has(row.profileId)) {
      continue;
    }
    if (input.cachedProfileIds?.has(row.profileId)) {
      continue;
    }
    selected.push(row.profileId);
    if (selected.length >= input.limit) {
      break;
    }
  }
  return selected;
}

export function applyWorkflowCookiePreviewRecords<
  T extends WorkflowCookieHydrationRow,
>(rows: T[], records: Map<string, WorkflowCookiePreviewRecord>): T[] {
  let changed = false;
  const nextRows = rows.map((row) => {
    const nextCookieData = records.get(row.profileId);
    if (!nextCookieData) {
      return row;
    }
    if (
      row.cookiePreview === nextCookieData.preview &&
      row.localCookieSnapshot === nextCookieData.snapshot
    ) {
      return row;
    }
    changed = true;
    return {
      ...row,
      cookiePreview: nextCookieData.preview,
      localCookieSnapshot: nextCookieData.snapshot,
    };
  });
  return changed ? nextRows : rows;
}
