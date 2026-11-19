import { describe, expect, it } from "vitest";
import { encodeFeedCursor, parseFeedCity, parseFeedCursor } from "./feed-params";

const TS = "2026-11-19T10:20:30.123456";
const ID = "3f2b8c1e-5d4a-4e6f-9a7b-0c1d2e3f4a5b";

describe("feed cursor", () => {
  it("round-trips a microsecond timestamp and a uuid", () => {
    expect(parseFeedCursor(encodeFeedCursor(TS, ID))).toEqual({ ts: TS, id: ID });
  });

  it("keeps trailing zeros of the microseconds", () => {
    const ts = "2026-11-19T10:20:30.100000";
    expect(parseFeedCursor(encodeFeedCursor(ts, ID))).toEqual({ ts, id: ID });
  });

  it.each([
    ["the old date|id format", `2026-11-19|${ID}`],
    ["a millisecond-only timestamp", `2026-11-19T10:20:30.123|${ID}`],
    ["an ISO string with Z", `2026-11-19T10:20:30.123456Z|${ID}`],
    ["a bad uuid", `${TS}|not-a-uuid`],
    ["a missing id", `${TS}|`],
    ["an empty string", ""],
    ["SQL in the id", `${TS}|' OR 1=1 --`],
    ["SQL in the timestamp", `2026-11-19'; DROP TABLE trips; --|${ID}`],
  ])("rejects %s", (_label, raw) => {
    expect(parseFeedCursor(raw)).toBeNull();
  });

  it("rejects null and undefined", () => {
    expect(parseFeedCursor(null)).toBeNull();
    expect(parseFeedCursor(undefined)).toBeNull();
  });
});

describe("parseFeedCity", () => {
  it("returns the trimmed city", () => {
    expect(parseFeedCity("  Lisbon ")).toEqual({ ok: true, city: "Lisbon" });
  });

  it("treats null, undefined, empty and blank as no filter", () => {
    expect(parseFeedCity(null)).toEqual({ ok: true, city: undefined });
    expect(parseFeedCity(undefined)).toEqual({ ok: true, city: undefined });
    expect(parseFeedCity("")).toEqual({ ok: true, city: undefined });
    expect(parseFeedCity("   ")).toEqual({ ok: true, city: undefined });
  });

  it("accepts exactly 100 characters and rejects 101", () => {
    expect(parseFeedCity("a".repeat(100))).toEqual({ ok: true, city: "a".repeat(100) });
    expect(parseFeedCity("a".repeat(101))).toEqual({ ok: false });
  });

  it("measures the length after trimming", () => {
    expect(parseFeedCity(` ${"a".repeat(100)} `)).toEqual({ ok: true, city: "a".repeat(100) });
  });
});
