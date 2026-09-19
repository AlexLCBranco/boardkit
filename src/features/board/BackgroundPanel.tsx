import { useEffect, type RefObject } from "react";

import { ColorSwatchPicker } from "../../components/ColorSwatchPicker";
import { Popover } from "../../components/Popover";
import { useColorDraft } from "../../components/useColorDraft";
import type { ItemColor } from "../../domain/types";
import { useBackgroundPreviewStore } from "../../store/backgroundPreviewStore";
import {
  useBackground,
  useForgetColor,
  useRecentColors,
  useSetBackground,
} from "../../store/selectors";
import styles from "./BackgroundPanel.module.css";

interface BackgroundPanelProps {
  readonly anchorRef: RefObject<HTMLElement | null>;
  readonly onClose: () => void;
}

/**
 * The board menu's "Background…": palette swatches, the custom colour picker
 * and "None", the same picker a list or card uses. It is a popover rather
 * than a modal dialog so the board stays visible and undimmed behind it: the
 * whole point is to see the colour on the board while choosing it.
 *
 * Saving follows the picker's usual rule (`useColorDraft`): a drag previews
 * live and is one write, one undo step, when it ends.
 */
export function BackgroundPanel({ anchorRef, onClose }: BackgroundPanelProps) {
  const background = useBackground();
  const setBackground = useSetBackground();
  const setPreview = useBackgroundPreviewStore((state) => state.setColor);
  const recent = useRecentColors();
  const forgetColor = useForgetColor();

  const color: ItemColor | undefined = background?.kind === "color" ? background.color : undefined;
  const { draft, updateDraft, commit, finish } = useColorDraft(
    (next) => setBackground(next === undefined ? undefined : { kind: "color", color: next }),
    setPreview,
  );

  // Never leave a preview behind, however the panel goes away.
  useEffect(() => () => setPreview(null), [setPreview]);

  function handleClose() {
    finish();
    onClose();
  }

  return (
    <Popover anchorRef={anchorRef} onClose={handleClose}>
      <div className={styles.section}>
        <span className={styles.label}>Background</span>
        <ColorSwatchPicker
          value={color}
          draft={draft}
          recent={recent}
          noneLabel="No background"
          onChange={commit}
          onForget={forgetColor}
          onDraftChange={updateDraft}
        />
      </div>
    </Popover>
  );
}
