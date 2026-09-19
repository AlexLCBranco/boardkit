import { ImageIcon, LoaderIcon } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type RefObject } from "react";
import { toast } from "sonner";

import { ColorSwatchPicker } from "../../components/ColorSwatchPicker";
import { Popover } from "../../components/Popover";
import { Button } from "../../components/ui/button";
import { Slider } from "../../components/ui/slider";
import { useColorDraft } from "../../components/useColorDraft";
import { DEFAULT_WASH, MAX_WASH } from "../../domain/background";
import { createImageId } from "../../domain/ids";
import type { ItemColor } from "../../domain/types";
import { useBackgroundPreviewStore } from "../../store/backgroundPreviewStore";
import { saveImage } from "../../store/imageStore";
import {
  useBackground,
  useForgetColor,
  useRecentColors,
  useSetBackground,
} from "../../store/selectors";
import styles from "./BackgroundPanel.module.css";
import { ImageRejected, prepareBackgroundImage } from "./backgroundImage";

interface BackgroundPanelProps {
  readonly anchorRef: RefObject<HTMLElement | null>;
  readonly onClose: () => void;
}

/** The slider works in whole percent; the board stores a fraction. */
const WASH_STEP = 5;
const WASH_MAX_PERCENT = Math.round(MAX_WASH * 100);

/**
 * The board menu's "Background…": a colour (palette, the custom picker, or
 * none) or an image with a dimming slider. It is a popover rather than a modal
 * dialog so the board stays visible and undimmed behind it: the whole point
 * is to see the choice on the board while making it.
 *
 * Saving follows the picker's usual rule: a colour drag or a slider drag
 * previews live and is one write, one undo step, when it ends.
 *
 * Choosing an image shrinks it first (`prepareBackgroundImage`), stores it in
 * IndexedDB (`saveImage`), and only then points the board at it, so a board
 * never refers to an image that failed to save.
 */
export function BackgroundPanel({ anchorRef, onClose }: BackgroundPanelProps) {
  const background = useBackground();
  const setBackground = useSetBackground();
  const setPreviewColor = useBackgroundPreviewStore((state) => state.setColor);
  const previewWash = useBackgroundPreviewStore((state) => state.wash);
  const setPreviewWash = useBackgroundPreviewStore((state) => state.setWash);
  const recent = useRecentColors();
  const forgetColor = useForgetColor();
  const fileInput = useRef<HTMLInputElement>(null);
  const [isPreparing, setIsPreparing] = useState(false);

  const color: ItemColor | undefined = background?.kind === "color" ? background.color : undefined;
  const image = background?.kind === "image" ? background : undefined;
  const { draft, updateDraft, commit, finish } = useColorDraft(
    (next) => setBackground(next === undefined ? undefined : { kind: "color", color: next }),
    setPreviewColor,
  );

  // Never leave a preview behind, however the panel goes away.
  useEffect(
    () => () => {
      setPreviewColor(null);
      setPreviewWash(null);
    },
    [setPreviewColor, setPreviewWash],
  );

  function handleClose() {
    finish();
    onClose();
  }

  async function handleImageChosen(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    // Cleared so choosing the same file again still fires `change`.
    input.value = "";
    if (!file) return;
    setIsPreparing(true);
    try {
      const { blob, average } = await prepareBackgroundImage(file);
      const imageId = createImageId();
      await saveImage(imageId, blob);
      setBackground({ kind: "image", imageId, wash: image?.wash ?? DEFAULT_WASH, average });
    } catch (error) {
      toast.error(
        error instanceof ImageRejected
          ? error.message
          : "This browser couldn't store that image, so the background was left as it was.",
      );
    } finally {
      setIsPreparing(false);
    }
  }

  const washPercent = Math.round((previewWash ?? image?.wash ?? DEFAULT_WASH) * 100);

  return (
    <Popover anchorRef={anchorRef} onClose={handleClose}>
      <div className={styles.section}>
        <span className={styles.label}>Colour</span>
        <ColorSwatchPicker
          value={color}
          draft={draft}
          recent={recent}
          noneLabel="No background"
          noneIsSelected={background === undefined}
          onChange={commit}
          onForget={forgetColor}
          onDraftChange={updateDraft}
        />
      </div>
      <div className={styles.section}>
        <span className={styles.label}>Image</span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPreparing}
            onClick={() => fileInput.current?.click()}
          >
            {isPreparing ? <LoaderIcon className="animate-spin" /> : <ImageIcon />}
            {isPreparing ? "Preparing…" : image ? "Change image…" : "Choose image…"}
          </Button>
          {image && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setBackground(undefined)}>
              Remove
            </Button>
          )}
        </div>
        {image && (
          <label className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="shrink-0">Dim</span>
            <Slider
              min={0}
              max={WASH_MAX_PERCENT}
              step={WASH_STEP}
              value={[washPercent]}
              onValueChange={([percent]) => setPreviewWash(percent / 100)}
              onValueCommit={([percent]) => {
                setBackground({ ...image, wash: percent / 100 });
                setPreviewWash(null);
              }}
              aria-label="Dim the image"
            />
            <span className="w-9 shrink-0 text-right tabular-nums">{washPercent}%</span>
          </label>
        )}
        <p className={styles.hint}>
          Kept in this browser and shrunk to save space. Included in backups, which makes them larger.
        </p>
        <input ref={fileInput} type="file" accept="image/*" hidden onChange={handleImageChosen} />
      </div>
    </Popover>
  );
}
