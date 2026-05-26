import { afterEach, describe, expect, it, vi } from "vitest";
import { deezerFetch, DeezerError } from "./client";

afterEach(() => vi.restoreAllMocks());

describe("DeezerError", () => {
  it("carries status + path + bodyText", () => {
    const err = new DeezerError(503, "/search/artist?q=x", "busy");
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(503);
    expect(err.path).toBe("/search/artist?q=x");
    expect(err.bodyText).toBe("busy");
    expect(err.name).toBe("DeezerError");
  });
});

describe("deezerFetch", () => {
  it("calls the correct Deezer API URL", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    );
    await deezerFetch("/search/artist?q=test&limit=1");
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe("https://api.deezer.com/search/artist?q=test&limit=1");
  });

  it("throws DeezerError on non-2xx", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("nope", { status: 429 }),
    );
    await expect(deezerFetch("/search/artist?q=x")).rejects.toThrow(DeezerError);
  });

  it("returns parsed JSON on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: 123 }] }), { status: 200 }),
    );
    const data = await deezerFetch<{ data: { id: number }[] }>("/x");
    expect(data.data[0].id).toBe(123);
  });

  it("sends Accept: application/json header", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    await deezerFetch("/test");
    const opts = fetchMock.mock.calls[0][1] as RequestInit;
    expect((opts.headers as Record<string, string>)["Accept"]).toBe("application/json");
  });
});
