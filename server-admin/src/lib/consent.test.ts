import { afterEach, describe, expect, it, vi } from "vitest";
import { consentView, revokeAnalytics } from "./consent";

// Contract assumed: consentView({ stored, gpc, dnt }) where stored is the raw tt_consent cookie value (or undefined)
// and gpc/dnt are booleans. Returns { showBanner, analytics, signalRespected }.
const view = (o: { stored?: string; gpc?: boolean; dnt?: boolean }) => consentView({ stored: undefined, gpc: false, dnt: false, ...o });

describe("consentView", () => {
  it("shows the banner with analytics off when nothing is stored and no signal is sent", () => {
    expect(view({})).toMatchObject({ showBanner: true, analytics: false, signalRespected: false });
  });

  it.each([{ gpc: true }, { dnt: true }, { gpc: true, dnt: true }])("%j with nothing stored hides the banner and turns analytics off", (o) => {
    expect(view(o)).toEqual({ showBanner: false, analytics: false, signalRespected: true });
  });

  it("an explicit grant wins over a browser signal", () => {
    expect(view({ stored: "1.granted", gpc: true })).toMatchObject({ showBanner: false, analytics: true });
  });

  it("an explicit denial keeps analytics off and the banner closed", () => {
    expect(view({ stored: "1.denied" })).toMatchObject({ showBanner: false, analytics: false });
  });

  it.each(["2.granted", "garbage", ""])("a stored value of %j (wrong version) shows the banner and keeps analytics off", (stored) => {
    expect(view({ stored })).toMatchObject({ showBanner: true, analytics: false });
  });

  it("a wrong version with a browser signal does not show the banner", () => {
    expect(view({ stored: "2.granted", dnt: true })).toMatchObject({ showBanner: false, analytics: false });
  });
});

describe("revokeAnalytics (F1/F7)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("deletes tt_vid and tt_sid with max-age=0 on the root path", () => {
    const writes: string[] = [];
    vi.stubGlobal("location", { protocol: "https:" });
    vi.stubGlobal("document", {
      get cookie() {
        return "";
      },
      set cookie(v: string) {
        writes.push(v);
      },
    });
    revokeAnalytics();
    for (const name of ["tt_vid", "tt_sid"]) {
      const w = writes.find((x) => x.startsWith(`${name}=`));
      expect(w, name).toBeDefined();
      expect(w).toMatch(/max-age=0/);
      expect(w).toMatch(/path=\//);
    }
  });
});
