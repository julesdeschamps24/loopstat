import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { formatDate, formatRelativeDate } from "./date";

describe("formatDate", () => {
  it("formats a date in French long form", () => {
    // 22 novembre 2024
    expect(formatDate(new Date("2024-11-22T10:00:00Z"))).toBe("22 novembre 2024");
  });

  it("uses lowercase month name and no leading zero on day", () => {
    expect(formatDate(new Date("2025-01-05T00:00:00Z"))).toBe("5 janvier 2025");
  });
});

describe("formatRelativeDate", () => {
  beforeEach(() => {
    // Freeze "now" to 2026-05-17 12:00 UTC
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-17T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'aujourd'hui' for today", () => {
    expect(formatRelativeDate(new Date("2026-05-17T03:00:00Z"))).toBe(
      "aujourd’hui",
    );
  });

  it("returns 'hier' for yesterday", () => {
    expect(formatRelativeDate(new Date("2026-05-16T03:00:00Z"))).toBe("hier");
  });

  it("returns 'il y a N jours' for less than 30 days ago", () => {
    expect(formatRelativeDate(new Date("2026-05-10T12:00:00Z"))).toBe(
      "il y a 7 jours",
    );
  });

  it("delegates to formatDate for dates older than 30 days", () => {
    expect(formatRelativeDate(new Date("2024-11-22T10:00:00Z"))).toBe(
      "22 novembre 2024",
    );
  });
});
