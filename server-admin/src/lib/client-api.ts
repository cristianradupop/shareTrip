import type { ApiResult } from "server-app/shared";
import { recordApiTiming } from "@/lib/analytics";

/** Browser call to server-app through the /api rewrite. Always resolves to `{ ok, ... }`, never throws. */
export async function clientFetch<T = object>(
  path: string,
  options: { method?: string; json?: unknown; form?: FormData } = {},
): Promise<ApiResult<T>> {
  const { method = options.json !== undefined || options.form ? "POST" : "GET", json, form } = options;
  const started = performance.now();
  let status = 0;
  try {
    const res = await fetch(path, {
      method,
      headers: json !== undefined ? { "content-type": "application/json" } : undefined,
      body: form ?? (json !== undefined ? JSON.stringify(json) : undefined),
    });
    status = res.status;
    const body = (await res.json().catch(() => null)) as (Partial<{ ok: boolean; error: string }> & T) | null;
    if (!res.ok || !body) return { ok: false, error: body?.error ?? "Something went wrong" };
    return { ok: true, ...body } as ApiResult<T>;
  } catch {
    return { ok: false, error: "Something went wrong" };
  } finally {
    recordApiTiming(method, path, status, Math.round(performance.now() - started));
  }
}
