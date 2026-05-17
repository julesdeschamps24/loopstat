import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { startSpotifySignin } from "./start-spotify-signin";

// Capture every element createElement returns so tests can assert on the
// properties the implementation set after the helper runs.
type StubElement = {
  tag: string;
  type: string;
  name: string;
  value: string;
  method: string;
  action: string;
  appendChild: ReturnType<typeof vi.fn>;
  submit: ReturnType<typeof vi.fn>;
};

let createdElements: StubElement[];
let bodyAppendChild: ReturnType<typeof vi.fn>;

describe("startSpotifySignin", () => {
  beforeEach(() => {
    createdElements = [];
    bodyAppendChild = vi.fn();

    const docMock = {
      createElement: vi.fn().mockImplementation((tag: string) => {
        const el: StubElement = {
          tag,
          type: "",
          name: "",
          value: "",
          method: "",
          action: "",
          appendChild: vi.fn(),
          submit: vi.fn(),
        };
        createdElements.push(el);
        return el;
      }),
      body: { appendChild: bodyAppendChild },
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

  it("builds a POST form to /api/auth/signin/spotify and submits it", async () => {
    await startSpotifySignin("/dashboard");

    // 1 form + 2 hidden inputs
    expect(createdElements).toHaveLength(3);
    const [form, csrfInput, cbInput] = createdElements;

    expect(form.tag).toBe("form");
    expect(form.method).toBe("POST");
    expect(form.action).toBe("/api/auth/signin/spotify");

    expect(csrfInput.tag).toBe("input");
    expect(csrfInput.type).toBe("hidden");
    expect(csrfInput.name).toBe("csrfToken");
    expect(csrfInput.value).toBe("fake-csrf-123");

    expect(cbInput.tag).toBe("input");
    expect(cbInput.type).toBe("hidden");
    expect(cbInput.name).toBe("callbackUrl");
    expect(cbInput.value).toBe("http://127.0.0.1:3000/dashboard");

    // Both inputs were attached to the form
    expect(form.appendChild).toHaveBeenCalledTimes(2);
    expect(form.appendChild).toHaveBeenNthCalledWith(1, csrfInput);
    expect(form.appendChild).toHaveBeenNthCalledWith(2, cbInput);

    // Form was attached to the body and submitted
    expect(bodyAppendChild).toHaveBeenCalledWith(form);
    expect(form.submit).toHaveBeenCalledTimes(1);
  });

  it("uses the provided callback path", async () => {
    await startSpotifySignin("/settings/billing");
    const cbInput = createdElements[2];
    expect(cbInput.value).toBe("http://127.0.0.1:3000/settings/billing");
  });
});
