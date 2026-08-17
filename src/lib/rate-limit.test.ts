import { describe, expect, it } from "vitest";

import { checkRateLimit, clientIpFromHeaders } from "./rate-limit";

describe("checkRateLimit", () => {
  it("autorise jusqu'à la limite puis bloque", () => {
    const key = `test:${Math.random()}`;
    expect(checkRateLimit(key, 3, 60_000).ok).toBe(true);
    expect(checkRateLimit(key, 3, 60_000).ok).toBe(true);
    expect(checkRateLimit(key, 3, 60_000).ok).toBe(true);
    const blocked = checkRateLimit(key, 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("isole les clés entre elles", () => {
    const a = `test:${Math.random()}`;
    const b = `test:${Math.random()}`;
    expect(checkRateLimit(a, 1, 60_000).ok).toBe(true);
    expect(checkRateLimit(a, 1, 60_000).ok).toBe(false);
    expect(checkRateLimit(b, 1, 60_000).ok).toBe(true);
  });
});

describe("clientIpFromHeaders", () => {
  it("prend la première IP du X-Forwarded-For", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
    expect(clientIpFromHeaders(h)).toBe("203.0.113.7");
  });

  it("retombe sur X-Real-IP puis unknown", () => {
    expect(clientIpFromHeaders(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe(
      "198.51.100.2",
    );
    expect(clientIpFromHeaders(new Headers())).toBe("unknown");
  });
});
