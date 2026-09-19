import { chromeOnBackground } from "../../domain/background";
import type { Chrome } from "../../domain/colors";
import type { BoardBackground, ItemColor } from "../../domain/types";
import { useBackgroundPreviewStore } from "../../store/backgroundPreviewStore";
import { useBackground } from "../../store/selectors";
import { useResolvedTheme } from "../../store/themeStore";

/** What is behind the lists right now: a colour still being tried in the
    picker wins over the saved one, so the board follows a drag live. */
export function useShownBackground(): BoardBackground | undefined {
  const saved = useBackground();
  const preview: ItemColor | null = useBackgroundPreviewStore((state) => state.color);
  return preview === null ? saved : { kind: "color", color: preview };
}

/**
 * How controls that sit directly on the board's background (the toolbar,
 * "Add a list") should be drawn to stay readable on it; `undefined` when the
 * board has no background and they can simply follow the app's theme.
 */
export function useBackgroundChrome(): Chrome | undefined {
  const shown = useShownBackground();
  const theme = useResolvedTheme();
  return chromeOnBackground(shown, theme);
}
