import "server-only";
import { cookies } from "next/headers";

const baseUrl = () => {
  const url = process.env.SERVER_APP_URL ?? "http://localhost:3001";
  if (process.env.VERCEL_ENV && new URL(url).protocol !== "https:") throw new Error("SERVER_APP_URL must be https on Vercel");
  return url;
};

/** Server-side call to server-app that forwards the visitor's cookies (the session lives there). */
export async function apiFetch(path: string, init: RequestInit = {}) {
  // Only server-app API paths: "//host" or an absolute URL would send the visitor's cookies elsewhere.
  if (!path.startsWith("/api/") || path.startsWith("//")) throw new Error(`apiFetch: invalid path ${path}`);
  const base = baseUrl();
  const headers = new Headers(init.headers);
  headers.set("cookie", (await cookies()).toString());
  return fetch(`${base}${path}`, { ...init, headers, cache: "no-store" });
}

/** GET a JSON body from server-app. Throws when the request fails, so the page shows the error boundary. */
export async function apiGet<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`server-app ${path} answered ${res.status}`);
  return (await res.json()) as T;
}
