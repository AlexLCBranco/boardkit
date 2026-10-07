/**
 * Where Boardkit lives. Its home is `/boardkit` on the shared gauntlet site;
 * the app's own Vercel address (and any other) is an old one, where the app
 * shows a "moved" notice instead of running. Pure, so it is unit-tested
 * without a browser: callers pass in `window.location`'s parts.
 */

export const HOME_HOST = "gauntlet-home.vercel.app";
export const HOME_PATH = "/boardkit/";

/** Hosts the app runs on normally: its home, and local development. */
const RUNS_ON = new Set([HOME_HOST, "localhost", "127.0.0.1", "[::1]"]);

/** True where the app should run; false at an old address. Matching is on
    the exact host, so a look-alike such as `gauntlet-home.vercel.app.evil`
    or a Vercel preview URL counts as an old address. */
export function isHomeAddress(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return RUNS_ON.has(host) || host.endsWith(".localhost");
}

/** The address at home that matches this one: the query and hash carry over
    (`?damage-test`, say); the path does not, since there is only one page. */
export function homeUrl(search: string, hash: string): string {
  return `https://${HOME_HOST}${HOME_PATH}${search}${hash}`;
}
