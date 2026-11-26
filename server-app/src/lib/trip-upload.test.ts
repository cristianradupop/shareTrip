import { describe, expect, it, vi } from "vitest";
import { jpgFile, sendForm } from "../test/helpers";

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", async () => (await import("../test/helpers")).dbModule());
vi.mock("@/lib/auth", async () => (await import("../test/helpers")).authModule());

const { TRIP_FIELDS } = await import("./validators");
const { readTripForm } = await import("./trip-upload");
const { requireMultipart } = await import("./api-auth");

const fields = {
  destinationCity: "Mirissa",
  destinationCountry: "Sri Lanka",
  departureDate: "2099-03-05",
  returnDate: "2099-03-12",
  maxTravelers: 4,
  gender: "mixed",
  budgetEstimate: 900,
  currency: "EUR",
  transport: "plane",
  theme: "Whales, beaches and surf.",
};

describe("TRIP_FIELDS", () => {
  it("lists the 10 tripSchema keys", () => {
    expect([...TRIP_FIELDS].sort()).toEqual(Object.keys(fields).sort());
  });
});

describe("requireMultipart", () => {
  const withType = (type?: string) =>
    new Request("http://app.test/x", { method: "POST", headers: type ? { "content-type": type } : {}, body: "x" });

  it("accepts multipart/form-data", () => {
    expect(requireMultipart(sendForm("POST", "/x", {}))).toBeNull();
  });

  it.each(["application/json", "text/plain", "application/x-www-form-urlencoded"])("returns 415 for %s", async (t) => {
    const res = requireMultipart(withType(t));
    expect(res?.status).toBe(415);
    expect(await res?.json()).toEqual({ ok: false, error: "Content-Type must be multipart/form-data" });
  });
});

describe("readTripForm", () => {
  it("returns the trip fields and the photo file", async () => {
    const r = await readTripForm(sendForm("POST", "/x", fields, jpgFile()));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.trip).toMatchObject({ destinationCity: "Mirissa", maxTravelers: 4, budgetEstimate: 900 });
    expect(r.photo).toBeInstanceOf(File);
  });

  it("gives photo null when it is missing", async () => {
    const r = await readTripForm(sendForm("POST", "/x", fields));
    expect(r).toMatchObject({ ok: true, photo: null });
  });

  it("gives photo null for a 0-byte file", async () => {
    const r = await readTripForm(sendForm("POST", "/x", fields, new File([], "e.jpg", { type: "image/jpeg" })));
    expect(r).toMatchObject({ ok: true, photo: null });
  });

  it("returns a 400 response with the tripSchema message for invalid fields", async () => {
    const r = await readTripForm(sendForm("POST", "/x", { ...fields, maxTravelers: 1 }, jpgFile()));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.response.status).toBe(400);
    expect(await r.response.json()).toEqual({ ok: false, error: "At least 2 travelers" });
  });

  it("returns 400 for an unparsable multipart body", async () => {
    const req = new Request("http://app.test/x", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=abc" },
      body: "this is not multipart",
    });
    const r = await readTripForm(req);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(400);
  });

  it("ignores a photoUrl form field", async () => {
    const r = await readTripForm(sendForm("POST", "/x", { ...fields, photoUrl: "https://evil.test/x.jpg" }, jpgFile()));
    expect(r.ok).toBe(true);
    if (r.ok) expect(JSON.stringify(r.trip)).not.toContain("evil");
  });
});
