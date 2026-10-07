import { describe, expect, it } from "vitest";

import type { BoardId } from "../domain/types";
import { findLinkedMap } from "./linkedMap";

const BOARD = "board00001" as BoardId;

/** Linkkit's keys as a plain object, read the way `localStorage` would be. */
function storage(entries: Record<string, unknown>) {
  return (key: string) => (key in entries ? (typeof entries[key] === "string" ? (entries[key] as string) : JSON.stringify(entries[key])) : null);
}

const registry = (...maps: { id: string; name: string }[]) => ({ version: 1, maps });
const linked = (name: string, linkedBoard: string) => ({ version: 2, rev: 3, map: { id: "x", name, linkedBoard } });
const plain = (name: string) => ({ version: 1, rev: 3, map: { id: "x", name } });

describe("findLinkedMap", () => {
  it("names the map in Linkkit's list whose record links this board", () => {
    const read = storage({
      "linkkit:registry": registry({ id: "m1", name: "Other" }, { id: "m2", name: "Rent or buy" }),
      "linkkit:map:m1": plain("Other"),
      "linkkit:map:m2": linked("Rent or buy", BOARD),
    });
    expect(findLinkedMap(BOARD, read)).toEqual({ name: "Rent or buy", inTrash: false });
  });

  it("finds nothing when no map links this board", () => {
    const read = storage({
      "linkkit:registry": registry({ id: "m1", name: "Other" }),
      "linkkit:map:m1": linked("Other", "someone-else"),
    });
    expect(findLinkedMap(BOARD, read)).toBeNull();
  });

  it("finds nothing where Linkkit has never been opened", () => {
    expect(findLinkedMap(BOARD, storage({}))).toBeNull();
  });

  it("finds a linked map in Linkkit's trash, and says so", () => {
    const read = storage({
      "linkkit:registry": registry(),
      "linkkit:trash:maps": { version: 1, maps: [{ id: "m2", name: "Rent or buy", boxes: 4, deletedAt: 1 }] },
      "linkkit:map:m2": linked("Rent or buy", BOARD),
    });
    expect(findLinkedMap(BOARD, read)).toEqual({ name: "Rent or buy", inTrash: true });
  });

  it("prefers the record's name and falls back to the list's", () => {
    const read = storage({
      "linkkit:registry": registry({ id: "m1", name: "From the list" }),
      "linkkit:map:m1": linked("  ", BOARD),
    });
    expect(findLinkedMap(BOARD, read)?.name).toBe("From the list");
  });

  it("treats damaged or unknown records as no link", () => {
    const read = storage({
      "linkkit:registry": registry({ id: "m1", name: "A" }, { id: "m2", name: "B" }, { id: "m3", name: "C" }),
      "linkkit:map:m1": "{ not json",
      "linkkit:map:m2": { version: 3, map: { name: "B", linkedBoard: BOARD } },
      // m3 has no record at all
    });
    expect(findLinkedMap(BOARD, read)).toBeNull();
    expect(findLinkedMap(BOARD, storage({ "linkkit:registry": "garbage" }))).toBeNull();
  });

  it("finds nothing when storage itself can't be read", () => {
    const read = () => {
      throw new DOMException("denied", "SecurityError");
    };
    expect(findLinkedMap(BOARD, read)).toBeNull();
  });
});
