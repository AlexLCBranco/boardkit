import { describe, expect, it } from "vitest";

import { CARD_KIND_SPECS } from "./cardKinds";
import { nextCheck } from "./check";

describe("nextCheck", () => {
  it("steps empty -> green -> red -> empty", () => {
    expect(nextCheck(undefined)).toBe("green");
    expect(nextCheck("green")).toBe("red");
    expect(nextCheck("red")).toBeUndefined();
  });
});

describe("which cards get a check circle", () => {
  it("is normal cards only, not dividers or notes", () => {
    expect(CARD_KIND_SPECS.normal.checkable).toBe(true);
    expect(CARD_KIND_SPECS.divider.checkable).toBe(false);
    expect(CARD_KIND_SPECS.note.checkable).toBe(false);
  });
});
