export type BaselineProfileStatus =
  | "running"
  | "stopped"
  | "locked"
  | "syncing";

export interface BaselineProfile {
  id: string;
  name: string;
  workspace: string;
  browser: "wayfern" | "camoufox";
  status: BaselineProfileStatus;
  note: string;
  tags: string[];
  syncAt: number;
}

export interface ProfileBenchmarkRow {
  mode: "legacy" | "optimized";
  datasetSize: number;
  renderLatencyMs: number;
  interactionDelayMs: number;
  scrollFps: number;
  minFps: number;
  cpuBusyPercent: number;
  longTaskMs: number;
  memoryMb: number | null;
}
