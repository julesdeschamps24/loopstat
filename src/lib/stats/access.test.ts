import { describe, expect, it } from "vitest";
import {
  FREE_PERIODS,
  FREE_TOP_LIMIT,
  PREMIUM_TOP_LIMIT,
  defaultPeriod,
  isPeriodAllowed,
  lockedPeriods,
  resolvePeriod,
  topLimit,
} from "./access";

describe("tier access policy", () => {
  it("free tier is limited to 1y + all", () => {
    expect([...FREE_PERIODS].sort()).toEqual(["1y", "all"]);
  });

  it("isPeriodAllowed: premium can access everything", () => {
    for (const p of ["1w", "4w", "6m", "1y", "all"] as const) {
      expect(isPeriodAllowed(p, true)).toBe(true);
    }
  });

  it("isPeriodAllowed: free can only access 1y + all", () => {
    expect(isPeriodAllowed("1y", false)).toBe(true);
    expect(isPeriodAllowed("all", false)).toBe(true);
    expect(isPeriodAllowed("1w", false)).toBe(false);
    expect(isPeriodAllowed("4w", false)).toBe(false);
    expect(isPeriodAllowed("6m", false)).toBe(false);
  });

  it("defaultPeriod: premium -> 1w (recent), free -> all (lifetime hook)", () => {
    expect(defaultPeriod(true)).toBe("1w");
    expect(defaultPeriod(false)).toBe("all");
  });

  it("resolvePeriod: clamps a disallowed period to 'all' for free", () => {
    expect(resolvePeriod("1w", false)).toBe("all");
    expect(resolvePeriod("6m", false)).toBe("all");
    expect(resolvePeriod("1y", false)).toBe("1y");
    expect(resolvePeriod("all", false)).toBe("all");
  });

  it("resolvePeriod: premium keeps whatever was requested", () => {
    expect(resolvePeriod("1w", true)).toBe("1w");
    expect(resolvePeriod("6m", true)).toBe("6m");
  });

  it("lockedPeriods: none for premium, the short ones for free", () => {
    expect(lockedPeriods(true)).toEqual([]);
    expect(lockedPeriods(false)).toEqual(["1w", "4w", "6m"]);
  });

  it("topLimit: 10 free, 100 premium", () => {
    expect(topLimit(false)).toBe(FREE_TOP_LIMIT);
    expect(topLimit(true)).toBe(PREMIUM_TOP_LIMIT);
    expect(FREE_TOP_LIMIT).toBe(10);
    expect(PREMIUM_TOP_LIMIT).toBe(100);
  });
});
