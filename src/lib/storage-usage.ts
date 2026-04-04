type UsageLike = {
  storageUsedBytes?: number | null;
  storageLimitMb?: number | null;
};

export function computeStorageUsagePercent(usage: UsageLike | null | undefined): number {
  const storageLimitMb = usage?.storageLimitMb ?? 0;
  const storageUsedBytes = usage?.storageUsedBytes ?? 0;
  if (!storageLimitMb || storageLimitMb <= 0 || storageUsedBytes <= 0) {
    return 0;
  }
  const raw = (storageUsedBytes / (storageLimitMb * 1024 * 1024)) * 100;
  if (!Number.isFinite(raw) || raw <= 0) {
    return 0;
  }
  return Math.min(100, raw);
}

export function formatStorageUsagePercentLabel(
  percentValue: number,
  storageUsedBytes: number,
): string {
  if (storageUsedBytes > 0 && percentValue > 0 && percentValue < 0.01) {
    return "<0.01%";
  }
  return `${Math.round(percentValue)}%`;
}
