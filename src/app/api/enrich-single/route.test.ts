import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "u1" } })),
}));

const setMock = vi.fn();
vi.mock("@/lib/redis", () => ({
  getRedis: () => ({ set: setMock }),
}));

const addMock = vi.fn();
vi.mock("../../../../worker/queue", () => ({
  enrichCatalogSingleQueue: { add: addMock },
}));

// Import after mocks are hoisted
const { POST } = await import("./route");

afterEach(() => {
  setMock.mockReset();
  addMock.mockReset();
});

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/enrich-single", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/enrich-single", () => {
  it("enqueues when guard returns OK", async () => {
    setMock.mockResolvedValue("OK");
    const res = await POST(jsonRequest({ type: "album", id: "alb_x" }));
    expect(res.status).toBe(200);
    expect(addMock).toHaveBeenCalledOnce();
  });

  it("skips when guard returns nil (already enqueued)", async () => {
    setMock.mockResolvedValue(null);
    const res = await POST(jsonRequest({ type: "album", id: "alb_x" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.skipped).toBe(true);
    expect(addMock).not.toHaveBeenCalled();
  });

  it("rejects invalid type", async () => {
    const res = await POST(jsonRequest({ type: "bogus", id: "x" }));
    expect(res.status).toBe(400);
    expect(addMock).not.toHaveBeenCalled();
  });

  it("rejects missing fields", async () => {
    const res = await POST(jsonRequest({}));
    expect(res.status).toBe(400);
  });
});
