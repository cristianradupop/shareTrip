/** Returns `next` only when it is a path inside this site, otherwise null. Guards the post-login redirect. */
export function safeNext(next?: string | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  // Control characters and backslashes let browsers read "/\evil.com" or "/\t/evil.com" as another host.
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return null;
  return next;
}
