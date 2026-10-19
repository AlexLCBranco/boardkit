import { describe, expect, it } from "vitest";

import { homeUrl, isHomeAddress, isPreviewAddress } from "./address";

describe("isHomeAddress", () => {
  it("runs at home and on local development hosts", () => {
    for (const host of ["gauntlet-home.vercel.app", "GAUNTLET-HOME.vercel.app", "localhost", "127.0.0.1", "[::1]", "app.localhost"]) {
      expect(isHomeAddress(host)).toBe(true);
    }
  });

  it("treats every other address as an old one", () => {
    for (const host of [
      "boardkit-iota.vercel.app",
      "boardkit-git-main-alexlcbranco.vercel.app",
      "gauntlet-home.vercel.app.example.com",
      "evil-gauntlet-home.vercel.app",
      "localhost.example.com",
    ]) {
      expect(isHomeAddress(host)).toBe(false);
    }
  });
});

describe("isPreviewAddress", () => {
  it("is a preview of the gauntlet site", () => {
    for (const host of [
      "gauntlet-home-git-phase-2-alexlcbrancos-projects.vercel.app",
      "gauntlet-home-8jc7nejqy-alexlcbrancos-projects.vercel.app",
    ]) {
      expect(isPreviewAddress(host)).toBe(true);
      expect(isHomeAddress(host)).toBe(false);
    }
  });

  it("is not home, Boardkit's own address, or a look-alike", () => {
    for (const host of [
      "gauntlet-home.vercel.app",
      "boardkit-git-main-alexlcbrancos-projects.vercel.app",
      "gauntlet-home-x-alexlcbrancos-projects.vercel.app.evil.com",
      "gauntlet-home-x-someone-else.vercel.app",
      "evil-gauntlet-home-x-alexlcbrancos-projects.vercel.app",
    ]) {
      expect(isPreviewAddress(host)).toBe(false);
    }
  });
});

describe("homeUrl", () => {
  it("points at /boardkit/ on the gauntlet site, keeping query and hash", () => {
    expect(homeUrl("", "")).toBe("https://gauntlet-home.vercel.app/boardkit/");
    expect(homeUrl("?damage-test", "#x")).toBe("https://gauntlet-home.vercel.app/boardkit/?damage-test#x");
  });

  it("never points back at an old address, so there is no loop", () => {
    expect(isHomeAddress(new URL(homeUrl("", "")).hostname)).toBe(true);
  });
});
