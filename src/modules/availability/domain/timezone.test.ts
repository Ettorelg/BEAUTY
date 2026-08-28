import { describe, expect, it } from "vitest";
import { zonedLocalToUtc } from "./timezone";

describe("zonedLocalToUtc", () => {
  it("uses the winter Rome offset", () => expect(zonedLocalToUtc("2026-01-15T10:30", "Europe/Rome").toISOString()).toBe("2026-01-15T09:30:00.000Z"));
  it("uses the summer Rome offset", () => expect(zonedLocalToUtc("2026-07-15T10:30", "Europe/Rome").toISOString()).toBe("2026-07-15T08:30:00.000Z"));
});
