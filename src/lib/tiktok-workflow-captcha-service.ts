export type WorkflowCaptchaProvider = "none" | "omocaptcha";

export interface WorkflowApiPhoneResolution {
  rawSegments: string[];
  phoneApiEndpoint: string | null;
  detectedProvider: WorkflowCaptchaProvider;
  helperUrl: string | null;
  docsUrl: string | null;
}

export interface WorkflowCaptchaContext {
  provider: WorkflowCaptchaProvider;
  phoneApiEndpoint: string | null;
  helperUrl: string | null;
  docsUrl: string | null;
}

export interface OmoCaptchaCreateTaskInput {
  clientKey: string;
  task: Record<string, unknown>;
}

export interface OmoCaptchaSolveOptions {
  baseUrl?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  maxAttempts?: number;
}

export interface OmoCaptchaSolveResult {
  taskId: number | string;
  solution: Record<string, unknown>;
  cost?: number | string | null;
  solveCount?: number | null;
  createTime?: number | null;
  endTime?: number | null;
}

export const OMO_CAPTCHA_EXTENSION_URL = "https://omocaptcha.com/extension";
export const OMO_CAPTCHA_TIKTOK_DOCS_URL =
  "https://docs.omocaptcha.com/tai-lieu-api/tiktok";

const OMO_HOST = "omocaptcha.com";
const OMO_DOCS_HOST = "docs.omocaptcha.com";

function splitRawSegments(raw?: string | null): string[] {
  return (raw ?? "")
    .split(/\r?\n|\|/g)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function normalizeHttpUrl(rawValue: string): string | null {
  const value = rawValue.trim();
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function isOmoHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return lower === OMO_HOST || lower.endsWith(`.${OMO_HOST}`);
}

function isOmoDocsHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return lower === OMO_DOCS_HOST || lower.endsWith(`.${OMO_DOCS_HOST}`);
}

export function resolveWorkflowApiPhoneAndCaptcha(
  rawValue?: string | null,
): WorkflowApiPhoneResolution {
  const rawSegments = splitRawSegments(rawValue);
  const normalizedUrls = rawSegments
    .map((segment) => normalizeHttpUrl(segment))
    .filter((value): value is string => Boolean(value));

  let detectedProvider: WorkflowCaptchaProvider = "none";
  let phoneApiEndpoint: string | null = null;
  let helperUrl: string | null = null;
  let docsUrl: string | null = null;

  for (const rawSegment of rawSegments) {
    const lowerSegment = rawSegment.toLowerCase();
    if (lowerSegment.includes("omocaptcha")) {
      detectedProvider = "omocaptcha";
      break;
    }
  }

  for (const url of normalizedUrls) {
    const parsed = new URL(url);
    if (isOmoHost(parsed.hostname)) {
      detectedProvider = "omocaptcha";
      const path = parsed.pathname.toLowerCase();
      if (!helperUrl && path.includes("extension")) {
        helperUrl = url;
      }
      if (!docsUrl && isOmoDocsHost(parsed.hostname)) {
        docsUrl = url;
      }
      continue;
    }

    if (!phoneApiEndpoint) {
      phoneApiEndpoint = url;
    }
  }

  if (!phoneApiEndpoint && normalizedUrls.length > 0) {
    phoneApiEndpoint = normalizedUrls[0];
  }

  if (detectedProvider === "omocaptcha") {
    if (!helperUrl) {
      helperUrl = OMO_CAPTCHA_EXTENSION_URL;
    }
    if (!docsUrl) {
      docsUrl = OMO_CAPTCHA_TIKTOK_DOCS_URL;
    }
  }

  return {
    rawSegments,
    phoneApiEndpoint,
    detectedProvider,
    helperUrl,
    docsUrl,
  };
}

export function resolveWorkflowCaptchaContext(
  rawApiPhone: string | null | undefined,
  preferredProvider: WorkflowCaptchaProvider,
): WorkflowCaptchaContext {
  const resolved = resolveWorkflowApiPhoneAndCaptcha(rawApiPhone);
  const provider =
    preferredProvider !== "none"
      ? preferredProvider
      : resolved.detectedProvider;

  if (provider === "omocaptcha") {
    return {
      provider,
      phoneApiEndpoint: resolved.phoneApiEndpoint,
      helperUrl: resolved.helperUrl ?? OMO_CAPTCHA_EXTENSION_URL,
      docsUrl: resolved.docsUrl ?? OMO_CAPTCHA_TIKTOK_DOCS_URL,
    };
  }

  return {
    provider: "none",
    phoneApiEndpoint: resolved.phoneApiEndpoint,
    helperUrl: null,
    docsUrl: null,
  };
}

export function buildWorkflowCaptchaSetupUrls(
  context: WorkflowCaptchaContext,
  apiKey?: string | null,
): string[] {
  const urls: string[] = [];
  const normalizedApiKey = apiKey?.trim() ?? "";

  if (context.provider === "omocaptcha") {
    if (normalizedApiKey) {
      urls.push(
        `https://omocaptcha.com/set-key?api_key=${encodeURIComponent(normalizedApiKey)}`,
      );
    }
    if (context.helperUrl) {
      urls.push(context.helperUrl);
    }
  }

  const deduped = new Set<string>();
  for (const url of urls) {
    const normalizedUrl = normalizeHttpUrl(url);
    if (!normalizedUrl) {
      continue;
    }
    deduped.add(normalizedUrl);
  }
  return Array.from(deduped);
}

function normalizeOmoApiBaseUrl(input?: string): string {
  const raw = input?.trim() || "https://api.omocaptcha.com";
  const normalized = normalizeHttpUrl(raw);
  if (!normalized) {
    return "https://api.omocaptcha.com";
  }
  return normalized.replace(/\/+$/, "");
}

async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} when calling ${url}`);
  }
  return (await response.json()) as T;
}

export async function createOmoCaptchaTask(
  input: OmoCaptchaCreateTaskInput,
  options?: OmoCaptchaSolveOptions,
): Promise<number | string> {
  const baseUrl = normalizeOmoApiBaseUrl(options?.baseUrl);
  const payload = await postJson<{
    errorId?: number;
    errorCode?: string;
    errorDescription?: string;
    taskId?: number | string;
  }>(`${baseUrl}/v2/createTask`, input);

  if (payload.errorId && payload.errorId !== 0) {
    throw new Error(
      payload.errorDescription || payload.errorCode || "createTask failed",
    );
  }

  if (payload.taskId === undefined || payload.taskId === null) {
    throw new Error("createTask succeeded but taskId is missing");
  }

  return payload.taskId;
}

export async function waitForOmoCaptchaTask(
  input: { clientKey: string; taskId: number | string },
  options?: OmoCaptchaSolveOptions,
): Promise<OmoCaptchaSolveResult> {
  const baseUrl = normalizeOmoApiBaseUrl(options?.baseUrl);
  const timeoutMs = Math.max(5_000, options?.timeoutMs ?? 90_000);
  const pollIntervalMs = Math.max(1_000, options?.pollIntervalMs ?? 3_000);
  const maxAttempts = Math.max(3, options?.maxAttempts ?? 40);
  const startedAt = Date.now();

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const payload = await postJson<{
      errorId?: number;
      errorCode?: string;
      errorDescription?: string;
      status?: string;
      solution?: Record<string, unknown>;
      cost?: number | string;
      solveCount?: number;
      createTime?: number;
      endTime?: number;
    }>(`${baseUrl}/v2/getTaskResult`, input);

    if (payload.errorId && payload.errorId !== 0) {
      throw new Error(
        payload.errorDescription || payload.errorCode || "getTaskResult failed",
      );
    }

    if (payload.status === "ready" && payload.solution) {
      return {
        taskId: input.taskId,
        solution: payload.solution,
        cost: payload.cost ?? null,
        solveCount: payload.solveCount ?? null,
        createTime: payload.createTime ?? null,
        endTime: payload.endTime ?? null,
      };
    }

    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error("OMOcaptcha task timed out");
    }
    if (attempt >= maxAttempts) {
      throw new Error("OMOcaptcha task exceeded max polling attempts");
    }

    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error("OMOcaptcha polling loop exited unexpectedly");
}

export async function solveOmoCaptchaTask(
  input: OmoCaptchaCreateTaskInput,
  options?: OmoCaptchaSolveOptions,
): Promise<OmoCaptchaSolveResult> {
  const taskId = await createOmoCaptchaTask(input, options);
  return waitForOmoCaptchaTask(
    {
      clientKey: input.clientKey,
      taskId,
    },
    options,
  );
}
