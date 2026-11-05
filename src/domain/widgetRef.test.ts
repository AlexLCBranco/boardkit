import { describe, expect, it } from "vitest";

import { readWidgetRef, widgetRefUrl } from "./widgetRef";

describe("widget references (Ctrl+C with no card picked)", () => {
  it("names a board, or one of its lists, and reads back", () => {
    const b = widgetRefUrl("https://gauntlet-home.vercel.app", { board: "b1" });
    expect(b).toBe("https://gauntlet-home.vercel.app/boardkit/?board=b1");
    expect(readWidgetRef(b)).toEqual({ board: "b1" });
    const l = widgetRefUrl("http://localhost:3000", { board: "b 2", list: "l/3" });
    expect(readWidgetRef(l)).toEqual({ board: "b 2", list: "l/3" });
  });
  it("anything else is not one", () => {
    for (const t of ["", "hello", "https://x.com/boardkit/", "https://x.com/linkkit/?board=1", "https://x.com/boardkit/?list=1"]) expect(readWidgetRef(t)).toBeNull();
  });
});
