// Pure parsers for the public feed query string. No DB and no `server-only`, so tests need no mocks.

const CURSOR_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CITY_LENGTH = 100;

/** `ts` is the Postgres created_at at microsecond precision (no timezone), `id` the trip uuid. */
export function encodeFeedCursor(ts: string, id: string): string {
  return `${ts}|${id}`;
}

export function parseFeedCursor(raw: string | null | undefined): { ts: string; id: string } | null {
  if (!raw) return null;
  const parts = raw.split("|");
  if (parts.length !== 2) return null;
  const [ts, id] = parts;
  if (!CURSOR_TS.test(ts) || !UUID.test(id)) return null;
  return { ts, id };
}

/** The viewer a feed query needs for the join state, from the session user; gender is null when unset or unknown. */
export function feedViewer(u: { id: string; gender?: unknown }): { id: string; gender: "male" | "female" | null } {
  return { id: u.id, gender: u.gender === "male" || u.gender === "female" ? u.gender : null };
}

export function parseFeedCity(raw: string | null | undefined): { ok: true; city: string | undefined } | { ok: false } {
  const city = (raw ?? "").trim();
  if (city.length > MAX_CITY_LENGTH) return { ok: false };
  return { ok: true, city: city || undefined };
}
