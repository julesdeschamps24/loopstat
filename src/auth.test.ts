import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the db module before importing auth
const findFirstMock = vi.fn();
const updateMock = vi.fn();
const insertMock = vi.fn();

vi.mock("@/db/client", () => ({
  db: {
    query: { users: { findFirst: findFirstMock } },
    update: () => ({ set: () => ({ where: () => updateMock() }) }),
    insert: () => ({ values: () => insertMock() }),
  },
}));

// Mock next-auth and its Google provider so that importing src/auth.ts in
// vitest (Node env, no Next.js server runtime) does not fail trying to resolve
// `next/server` (which next-auth@5 imports at module load time).
vi.mock("next-auth", () => ({
  default: () => ({ handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }),
}));
vi.mock("next-auth/providers/google", () => ({ default: vi.fn() }));

// Recreate the signIn callback shape so we can test it in isolation. The
// real callback in src/auth.ts has the exact same logic - this test file
// duplicates only the *behavior under test* (not the NextAuth handler shell).
async function signInCallback(args: {
  account: { provider: string } | null;
  profile: { email?: string; name?: string; picture?: string } | null;
}): Promise<boolean> {
  const { signInCallback: real } = await import("./auth");
  return real(args);
}

describe("auth signIn callback (Google)", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    updateMock.mockReset().mockResolvedValue(undefined);
    insertMock.mockReset().mockResolvedValue(undefined);
  });

  it("rejects if account is null", async () => {
    const ok = await signInCallback({ account: null, profile: { email: "x@y.z" } });
    expect(ok).toBe(false);
  });

  it("rejects if provider is not google", async () => {
    const ok = await signInCallback({
      account: { provider: "spotify" },
      profile: { email: "x@y.z" },
    });
    expect(ok).toBe(false);
  });

  it("rejects if profile.email is missing", async () => {
    const ok = await signInCallback({
      account: { provider: "google" },
      profile: { name: "no email" },
    });
    expect(ok).toBe(false);
  });

  it("updates existing user when email matches", async () => {
    findFirstMock.mockResolvedValue({
      id: "existing-uuid",
      email: "jules@example.com",
      displayName: "Old name",
      avatarUrl: "old-url",
    });
    const ok = await signInCallback({
      account: { provider: "google" },
      profile: { email: "JULES@example.com", name: "New name", picture: "new-url" },
    });
    expect(ok).toBe(true);
    expect(findFirstMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("inserts new user when email is unknown", async () => {
    findFirstMock.mockResolvedValue(undefined);
    const ok = await signInCallback({
      account: { provider: "google" },
      profile: { email: "new@example.com", name: "New user", picture: "url" },
    });
    expect(ok).toBe(true);
    expect(findFirstMock).toHaveBeenCalledTimes(1);
    expect(updateMock).not.toHaveBeenCalled();
    expect(insertMock).toHaveBeenCalledTimes(1);
  });
});
