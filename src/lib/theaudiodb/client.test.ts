import { afterEach, describe, expect, it, vi } from "vitest";
import { tadbFetch, TheAudioDBError } from "./client";

afterEach(() => vi.restoreAllMocks());

describe("TheAudioDBError", () => {
  it("carries status + path + bodyText", () => {
    const err = new TheAudioDBError(503, "/artist-mb.php?i=x", "busy");
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(503);
    expect(err.path).toBe("/artist-mb.php?i=x");
    expect(err.bodyText).toBe("busy");
    expect(err.name).toBe("TheAudioDBError");
  });
});

describe("tadbFetch", () => {
  it("calls the URL with the API key in the path", async () => {
    vi.stubEnv("TADB_API_KEY", "test-key");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    await tadbFetch("/artist-mb.php?i=abc");
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe("https://www.theaudiodb.com/api/v1/json/test-key/artist-mb.php?i=abc");
  });

  it("defaults to key '2' when TADB_API_KEY is unset", async () => {
    vi.stubEnv("TADB_API_KEY", "");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    await tadbFetch("/search.php?s=x");
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toMatch(/\/json\/2\//);
  });

  it("throws TheAudioDBError on non-2xx", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("nope", { status: 503 }),
    );
    await expect(tadbFetch("/artist-mb.php?i=x")).rejects.toThrow(TheAudioDBError);
  });

  it("returns parsed JSON on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ hello: "world" }), { status: 200 }),
    );
    const data = await tadbFetch<{ hello: string }>("/x");
    expect(data.hello).toBe("world");
  });
});
