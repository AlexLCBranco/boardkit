/**
 * Key-combo strings, parsed once and matched against `KeyboardEvent`s. No
 * React, no store -- just the vocabulary the registry writes shortcuts in.
 *
 * A combo is lower-case parts joined by `+`: `"n"`, `"shift+n"`, `"f2"`,
 * `"arrowup"`, `"mod+shift+z"`. `mod` means Ctrl on Windows/Linux and Cmd on
 * a Mac, so one entry works on both.
 */

export interface Combo {
  readonly key: string;
  readonly mod: boolean;
  readonly shift: boolean;
  readonly alt: boolean;
}

export function parseCombo(spec: string): Combo {
  const parts = spec.toLowerCase().split("+");
  // A literal "+" key would split into two empty parts; none is registered
  // today, so the key is simply whatever comes last.
  const key = parts[parts.length - 1];
  return {
    key,
    mod: parts.includes("mod"),
    shift: parts.includes("shift"),
    alt: parts.includes("alt"),
  };
}

/**
 * Shift only distinguishes letters and named keys ("n" vs "shift+n",
 * "arrowdown" vs "shift+arrowdown"). For a punctuation key like "?" the
 * shift is already baked into `event.key` -- and needs it on a US layout but
 * not on others -- so it is not compared.
 */
function shiftMatters(key: string): boolean {
  return key.length > 1 || /[a-z]/.test(key);
}

export function comboMatches(combo: Combo, event: KeyboardEvent): boolean {
  if (event.key.toLowerCase() !== combo.key) {
    return false;
  }
  if ((event.ctrlKey || event.metaKey) !== combo.mod || event.altKey !== combo.alt) {
    return false;
  }
  return !shiftMatters(combo.key) || event.shiftKey === combo.shift;
}

/** A canonical string for a combo, so two entries that mean the same keys
    compare equal however they were spelled. */
export function comboSignature(combo: Combo): string {
  const shift = shiftMatters(combo.key) && combo.shift;
  return [combo.mod && "mod", shift && "shift", combo.alt && "alt", combo.key]
    .filter(Boolean)
    .join("+");
}

const IS_MAC = typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.userAgent);

const KEY_LABELS: Readonly<Record<string, string>> = {
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  escape: "Esc",
  delete: "Del",
};

/** A combo as the separate keycaps to draw, e.g. `["Ctrl", "Shift", "Z"]`. */
export function formatCombo(combo: Combo): string[] {
  const caps: string[] = [];
  if (combo.mod) caps.push(IS_MAC ? "⌘" : "Ctrl");
  if (combo.alt) caps.push(IS_MAC ? "⌥" : "Alt");
  if (combo.shift) caps.push("Shift");
  caps.push(KEY_LABELS[combo.key] ?? combo.key.toUpperCase());
  return caps;
}
