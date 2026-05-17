import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { startSpotifySignin } from "./start-spotify-signin";

describe("startSpotifySignin", () => {
  beforeEach(() => {
    // jsdom n'est pas chargé, on stub manuellement document/window
    const docMock = {
      createElement: vi.fn().mockImplementation((tag: string) => ({
        tag,
        appendChild: vi.fn(),
        submit: vi.fn(),
        setAttribute: vi.fn(),
        type: "",
        name: "",
        value: "",
        method: "",
        action: "",
      })),
      body: { appendChild: vi.fn() },
    };
    const winMock = { location: { origin: "http://127.0.0.1:3000" } };

    vi.stubGlobal("document", docMock);
    vi.stubGlobal("window", winMock);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ csrfToken: "fake-csrf-123" }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches the CSRF token from /api/auth/csrf", async () => {
    await startSpotifySignin("/dashboard");
    expect(fetch).toHaveBeenCalledWith("/api/auth/csrf", {
      credentials: "include",
    });
  });

  it("submits a form to /api/auth/signin/spotify with csrf and callback", async () => {
    await startSpotifySignin("/dashboard");
    const createEl = vi.mocked(document.createElement);
    // 1 form + 2 hidden inputs = 3 createElement calls
    expect(createEl).toHaveBeenCalledTimes(3);
    expect(createEl).toHaveBeenNthCalledWith(1, "form");
    expect(createEl).toHaveBeenNthCalledWith(2, "input");
    expect(createEl).toHaveBeenNthCalledWith(3, "input");
  });
});
