import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { capitalize, formatDate, formatDueDate } from "./format";

describe("capitalize", () => {
  it("capitalises the first letter", () => {
    expect(capitalize("kelvin")).toBe("Kelvin");
  });

  it("leaves the rest of the string alone", () => {
    expect(capitalize("mcDonald")).toBe("McDonald");
  });

  it.each([null, undefined, ""])("returns an empty string for %s", (value) => {
    expect(capitalize(value)).toBe("");
  });
});

describe("formatDueDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-31T15:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("says Today for today", () => {
    expect(formatDueDate("2026-07-31")).toBe("Today");
  });

  it("says Tomorrow for tomorrow", () => {
    expect(formatDueDate("2026-08-01")).toBe("Tomorrow");
  });

  it("says Yesterday for yesterday", () => {
    expect(formatDueDate("2026-07-30")).toBe("Yesterday");
  });

  it("counts the days for anything further overdue", () => {
    expect(formatDueDate("2026-07-26")).toBe("5 days overdue");
  });

  it("names the weekday inside the coming week", () => {
    expect(formatDueDate("2026-08-03")).toBe("Monday");
  });

  it("falls back to a date further out", () => {
    expect(formatDueDate("2026-12-25")).toMatch(/Dec/);
  });

  it("parses at local midnight, not UTC", () => {
    // `new Date("2026-07-31")` is UTC midnight, which is 31 July 17:00 the
    // previous day in Berkeley — so a task due today used to read as due
    // yesterday for anyone west of Greenwich.
    expect(formatDueDate("2026-07-31")).not.toBe("Yesterday");
  });

  it.each([null, "", "not a date"])("returns an empty string for %s", (value) => {
    expect(formatDueDate(value)).toBe("");
  });
});

describe("formatDate", () => {
  it("formats an ISO timestamp", () => {
    expect(formatDate("2026-07-31T12:00:00")).toMatch(/2026/);
  });

  it("returns an empty string for junk", () => {
    expect(formatDate("nonsense")).toBe("");
  });
});
