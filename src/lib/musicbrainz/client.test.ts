import { afterEach, describe, expect, it, vi } from "vitest";
import { mbFetch, MusicBrainzError } from "./client";

afterEach(() => vi.restoreAllMocks());

describe("MusicBrainzError", () => {
  it("carries status + path + retryAfterMs", () => {
    const err = new MusicBrainzError(503, "/release-group/?query=x", "busy", 2000);
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(503);
    expect(err.path).toBe("/release-group/?query=x");
    expect(err.retryAfterMs).toBe(2000);
    expect(err.name).toBe("MusicBrainzError");
  });
});

describe("mbFetch", () => {
  it("sends required User-Agent header", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    await mbFetch("/release-group/?query=test");
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers["User-Agent"]).toMatch(/^loopstat\//);
    expect(headers["User-Agent"]).toContain("loopstat.tech");
  });

  it("throws MusicBrainzError on non-2xx response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("not found", { status: 404 }),
    );
    await expect(mbFetch("/release-group/?query=x")).rejects.toThrow(MusicBrainzError);
  });

  it("parses Retry-After (seconds) into retryAfterMs on 503", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("busy", {
        status: 503,
        headers: { "Retry-After": "5" },
      }),
    );
    await expect(mbFetch("/release-group/?query=x")).rejects.toMatchObject({
      status: 503,
      retryAfterMs: 5000,
    });
  });

  it("returns parsed JSON on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ hello: "world" }), { status: 200 }),
    );
    const data = await mbFetch<{ hello: string }>("/release-group/?query=x");
    expect(data.hello).toBe("world");
  });
});
