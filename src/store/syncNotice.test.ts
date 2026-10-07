import { describe, expect, it } from "vitest";

import { refusedText } from "./syncNoticeStore";

describe("refusedText", () => {
  it("names the item and where it may have changed", () => {
    expect(refusedText([{ kind: "card", title: "Rent" }], "undo", false)).toBe(
      "Can't undo further: “Rent” was changed in another tab.",
    );
    expect(refusedText([{ kind: "background", title: "The background" }], "redo", true)).toBe(
      "Can't redo further: The background was changed in Linkkit or another tab.",
    );
  });
});
