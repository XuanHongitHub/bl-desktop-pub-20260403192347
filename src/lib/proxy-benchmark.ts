import { invoke } from "@tauri-apps/api/core";
import type { ParsedProxyLine, ProxyProtocolBenchmark } from "@/types";

interface OptimizeParsedProxiesOptions {
  onProgress?: (completed: number, total: number) => void;
  concurrency?: number;
}

export async function optimizeParsedProxies(
  parsed: ParsedProxyLine[],
  options: OptimizeParsedProxiesOptions = {},
): Promise<ParsedProxyLine[]> {
  const total = parsed.length;
  if (total === 0) {
    return [];
  }

  const { onProgress, concurrency = 4 } = options;
  const maxConcurrency = Math.max(1, Math.min(concurrency, 8));
  const optimized = [...parsed];
  let cursor = 0;
  let completed = 0;

  const runWorker = async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= total) {
        return;
      }

      const proxy = parsed[index];
      try {
        const benchmark = await invoke<ProxyProtocolBenchmark>(
          "benchmark_proxy_protocols",
          {
            host: proxy.host,
            port: proxy.port,
            username: proxy.username ?? null,
            password: proxy.password ?? null,
          },
        );

        if (!benchmark.best_protocol) {
          optimized[index] = proxy;
          continue;
        }

        optimized[index] = {
          ...proxy,
          proxy_type: benchmark.best_protocol,
        };
      } catch {
        optimized[index] = proxy;
      } finally {
        completed += 1;
        onProgress?.(completed, total);
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(maxConcurrency, total) }, () => runWorker()),
  );

  return optimized;
}
