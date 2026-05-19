import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCoverUrl } from "./coverArt";

afterEach(() => vi.restoreAllMocks());

describe("fetchCoverUrl", () => {
  it("returns the final URL after 302 redirect", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("ok", {
        status: 200,
        // simulate fetch followed the redirect — response.url contains final
        headers: {},
      } as ResponseInit),
    );
    // Mock the Response to have .url
    const finalUrl = "https://archive.org/download/mbid-abc/cover-500.jpg";
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      const r = new Response("ok", { status: 200 });
      Object.defineProperty(r, "url", { value: finalUrl });
      return r;
    });
    expect(await fetchCoverUrl("abc-1234")).toBe(finalUrl);
  });

  it("returns null on 404 (no cover for this release-group)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("not found", { status: 404 }),
    );
    expect(await fetchCoverUrl("abc-1234")).toBeNull();
  });

  it("throws on 503 (so caller can retry)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("busy", { status: 503 }),
    );
    await expect(fetchCoverUrl("abc-1234")).rejects.toThrow(/503/);
  });

  it("hits the front-500 endpoint for given mbid", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("not found", { status: 404 }),
    );
    await fetchCoverUrl("abc-1234");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://coverartarchive.org/release-group/abc-1234/front-500",
    );
  });
});
