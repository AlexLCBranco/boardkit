import { chromeOnBackground, imageIdOf } from "../../domain/background";
import type { Chrome } from "../../domain/colors";
import type { BoardBackground } from "../../domain/types";
import { useBackgroundPreviewStore } from "../../store/backgroundPreviewStore";
import { useImageUrl } from "../../store/imageUrlStore";
import { useBackground } from "../../store/selectors";
import { useResolvedTheme } from "../../store/themeStore";

/** What is behind the lists as far as the user has chosen it: a colour or
    dimming still being tried in the panel wins over the saved one, so the
    board follows a drag live. */
function useShownBackground(): BoardBackground | undefined {
  const saved = useBackground();
  const previewColor = useBackgroundPreviewStore((state) => state.color);
  const previewWash = useBackgroundPreviewStore((state) => state.wash);
  if (previewColor !== null) {
    return { kind: "color", color: previewColor };
  }
  if (saved?.kind === "image" && previewWash !== null) {
    return { ...saved, wash: previewWash };
  }
  return saved;
}

export interface Backdrop {
  readonly background: BoardBackground;
  /** The picture to draw, for an image background; `undefined` while it loads. */
  readonly imageUrl: string | undefined;
}

/**
 * What to draw behind the lists, or `undefined` for the theme's own
 * background. An image that is missing from storage (cleared site data,
 * IndexedDB unavailable in a private window) counts as no background at all:
 * never an error, never a blank board.
 */
export function useBackdrop(): Backdrop | undefined {
  const background = useShownBackground();
  const url = useImageUrl(imageIdOf(background));
  if (background === undefined || url === null) {
    return undefined;
  }
  return { background, imageUrl: url };
}

/**
 * How controls that sit directly on the board's background (the toolbar,
 * "Add a list") should be drawn to stay readable on it; `undefined` when the
 * board has no background and they can simply follow the app's theme. For an
 * image this uses its average colour under the dimming, so the toolbar is
 * tuned to the picture without waiting for it to load.
 */
export function useBackgroundChrome(): Chrome | undefined {
  const backdrop = useBackdrop();
  const theme = useResolvedTheme();
  return chromeOnBackground(backdrop?.background, theme);
}
