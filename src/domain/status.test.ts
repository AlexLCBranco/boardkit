import { describe, expect, it } from "vitest";

import { cardLooksCut, listLooksCut } from "./status";
import type { ItemStatus } from "./types";

// Linkkit's `looksCut` cases (its domain/status.test.ts), on a board's
// fixed shape: board -> list -> card, one way into each.
const item = (status?: ItemStatus) => ({ status });

describe("listLooksCut", () => {
  it("is a list cut itself", () => {
    expect(listLooksCut(item("cut"))).toBe(true);
  });

  it("ignores keep, maybe and no status", () => {
    expect(listLooksCut(item("keep"))).toBe(false);
    expect(listLooksCut(item("maybe"))).toBe(false);
    expect(listLooksCut(item())).toBe(false);
  });
});

describe("cardLooksCut", () => {
  it("covers a cut card on its own, leaving its list alive", () => {
    expect(cardLooksCut(item("cut"), false)).toBe(true);
    expect(cardLooksCut(item(), false)).toBe(false);
  });

  it("covers every card of a cut list, whatever its own status", () => {
    for (const status of [undefined, "keep", "maybe", "cut"] as const) {
      expect(cardLooksCut(item(status), true)).toBe(true);
    }
  });

  it("ignores keep and maybe", () => {
    expect(cardLooksCut(item("keep"), false)).toBe(false);
    expect(cardLooksCut(item("maybe"), false)).toBe(false);
  });
});
