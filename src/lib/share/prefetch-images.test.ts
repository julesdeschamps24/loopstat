import { afterEach, describe, expect, it, vi } from "vitest";

import { prefetchImages } from "./prefetch-images";

afterEach(() => {
  vi.unstubAllGlobals();
});

function okImage(bytes: number[], contentType = "image/png"): Response {
  return {
    ok: true,
    headers: { get: () => contentType },
    arrayBuffer: async () => new Uint8Array(bytes).buffer,
  } as unknown as Response;
}

// The share-card route depends on this contract: any URL that failed to
// prefetch is ABSENT from the returned map, so the route can drop it instead
// of handing a remote URL to Satori (which would fetch it without a timeout).
describe("prefetchImages", () => {
  it("returns a data URL for a successful fetch", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okImage([0xff, 0xd8, 0xff])));
    const url = `https://cdn.example/ok-${crypto.randomUUID()}.jpg`;

    const map = await prefetchImages([url]);

    expect(map.get(url)).toMatch(/^data:image\/png;base64,/);
  });

  it("omits URLs that return a non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404 }) as Response),
    );
    const url = `https://cdn.example/missing-${crypto.randomUUID()}.jpg`;

    const map = await prefetchImages([url]);

    expect(map.has(url)).toBe(false);
  });

  it("omits URLs whose fetch rejects (network error / timeout)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ETIMEDOUT");
      }),
    );
    const url = `https://cdn.example/flaky-${crypto.randomUUID()}.jpg`;

    const map = await prefetchImages([url]);

    expect(map.has(url)).toBe(false);
  });
});
