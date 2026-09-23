import type { RefObject } from "react";

import { CARD_KIND_CHOICES, CARD_KIND_SPECS, NORMAL_KIND } from "../domain/cardKinds";
import { HIGHLIGHT_STYLE_LABELS, RING_HIGHLIGHT } from "../domain/highlight";
import {
  NORMAL_EMPHASIS,
  NUMBER_EMPHASIS_LABELS,
  HIDDEN_NUMBERS,
  NUMBER_DISPLAY_LABELS,
  PLAIN_FORMAT,
} from "../domain/numberStyle";
import type {
  CardKind,
  HighlightStyle,
  IconKey,
  ItemColor,
  NumberEmphasis,
  NumberFormat,
} from "../domain/types";
import { useForgetColor, useRecentColors } from "../store/selectors";
import { ColorSwatchPicker } from "./ColorSwatchPicker";
import styles from "./CustomizePanel.module.css";
import { IconPicker } from "./IconPicker";
import { Popover } from "./Popover";
import { useColorDraft } from "./useColorDraft";

interface CustomizePanelProps {
  readonly anchorRef: RefObject<HTMLElement | null>;
  readonly color: ItemColor | undefined;
  /** Save a colour: one call, one undo step. */
  readonly onColorChange: (color: ItemColor | undefined) => void;
  /** Show a colour on the item without saving it -- called live while the
      custom picker is dragged, and with `null` when the preview ends. */
  readonly onColorPreview: (color: ItemColor | null) => void;
  readonly onClose: () => void;
  /** Lists only -- a card carries no icon of its own any more, so a caller
      that omits both of these simply gets no Icon section. */
  readonly icon?: IconKey;
  readonly onIconChange?: (icon: IconKey | undefined) => void;
  /** Cards only -- a list has no type, so a caller that omits `onKindChange`
      gets no "Card type" section. `kind` undefined means a normal card. */
  readonly kind?: CardKind;
  readonly onKindChange?: (kind: CardKind | undefined) => void;
  /** Lists only: how the list writes its card numbers. Omit the handler and
      there is no "Numbers" section. `undefined` means plain digits. */
  readonly numberFormat?: NumberFormat;
  readonly onNumberFormatChange?: (format: NumberFormat | undefined) => void;
  /** Lists only: hide the numbers without losing the format. Offered as a
      last "Hidden" choice in the same row; picking a format unhides. */
  readonly numbersHidden?: boolean;
  readonly onNumbersHiddenChange?: (hidden: boolean) => void;
  /** Cards only, and only numbered ones: how this card's number stands out.
      `undefined` means normal. */
  readonly numberEmphasis?: NumberEmphasis;
  readonly onNumberEmphasisChange?: (emphasis: NumberEmphasis | undefined) => void;
  /** Cards only: a border colour separate from `color`, and how it is
      drawn. Omit `onHighlightChange` and there is no "Highlight" section.
      The preview works like `onColorPreview`. */
  readonly highlight?: ItemColor;
  readonly onHighlightChange?: (highlight: ItemColor | undefined) => void;
  readonly onHighlightPreview?: (highlight: ItemColor | null) => void;
  readonly highlightStyle?: HighlightStyle;
  readonly onHighlightStyleChange?: (style: HighlightStyle | undefined) => void;
}

function ignore() {}

/**
 * The colour (and, for a list, icon; for a card, type) popover. Cards and
 * lists used to share an identical Icon section here; a card's has been
 * dropped, since colour turned out to be the only customisation anyone
 * actually reached for on a card, so the picker for the other is gone rather
 * than left unused.
 *
 * A card's description used to live here too, but editing it meant opening
 * this popover -- which sits over part of the board -- just to change a few
 * words. It's now edited in place on the card itself (see CardItem.tsx),
 * where the rest of the board stays visible.
 *
 * List width used to have a third section here (a three-way picker over a
 * closed set of sizes) but is now a drag handle on the column's own right
 * edge instead -- direct manipulation beats a menu for a continuous value,
 * and it needed no closed set once dragging replaced picking.
 */
export function CustomizePanel({
  anchorRef,
  color,
  onColorChange,
  onColorPreview,
  onClose,
  icon,
  onIconChange,
  kind,
  onKindChange,
  numberFormat,
  onNumberFormatChange,
  numbersHidden,
  onNumbersHiddenChange,
  numberEmphasis,
  onNumberEmphasisChange,
  highlight,
  onHighlightChange,
  onHighlightPreview,
  highlightStyle,
  onHighlightStyleChange,
}: CustomizePanelProps) {
  const recent = useRecentColors();
  const forgetColor = useForgetColor();
  const { draft, updateDraft, commit, finish } = useColorDraft(onColorChange, onColorPreview);
  // The highlight has a picker of its own, so it gets its own draft: a drag
  // in one picker must never save into the other. Hooks can't be skipped, so
  // a host with no highlight gets a draft wired to nothing.
  const highlightDraft = useColorDraft(onHighlightChange ?? ignore, onHighlightPreview ?? ignore);

  function handleClose() {
    finish();
    highlightDraft.finish();
    onClose();
  }

  return (
    <Popover anchorRef={anchorRef} onClose={handleClose}>
      <div className={styles.section}>
        <span className={styles.label}>Colour</span>
        <ColorSwatchPicker
          value={color}
          draft={draft}
          recent={recent}
          onChange={commit}
          onForget={forgetColor}
          onDraftChange={updateDraft}
        />
      </div>
      {onHighlightChange && (
        <div className={styles.section}>
          <span className={styles.label}>Highlight</span>
          <ColorSwatchPicker
            value={highlight}
            draft={highlightDraft.draft}
            recent={recent}
            onChange={highlightDraft.commit}
            onForget={forgetColor}
            onDraftChange={highlightDraft.updateDraft}
            noneLabel="No highlight"
          />
        </div>
      )}
      {onHighlightStyleChange && (highlight !== undefined || highlightDraft.draft !== null) && (
        <ChoiceSection
          label="Highlight style"
          choices={Object.keys(HIGHLIGHT_STYLE_LABELS) as (keyof typeof HIGHLIGHT_STYLE_LABELS)[]}
          labels={HIGHLIGHT_STYLE_LABELS}
          value={highlightStyle}
          absent={RING_HIGHLIGHT}
          onChange={onHighlightStyleChange}
        />
      )}
      {onIconChange && (
        <div className={styles.section}>
          <span className={styles.label}>Icon</span>
          <IconPicker value={icon} onChange={onIconChange} />
        </div>
      )}
      {onKindChange && (
        <ChoiceSection
          label="Card type"
          choices={CARD_KIND_CHOICES}
          labels={Object.fromEntries(CARD_KIND_CHOICES.map((c) => [c, CARD_KIND_SPECS[c].label]))}
          value={kind}
          absent={NORMAL_KIND}
          onChange={onKindChange}
        />
      )}
      {onNumberFormatChange && (
        <ChoiceSection
          label="Numbers"
          choices={Object.keys(NUMBER_DISPLAY_LABELS) as (keyof typeof NUMBER_DISPLAY_LABELS)[]}
          labels={NUMBER_DISPLAY_LABELS}
          value={numbersHidden ? HIDDEN_NUMBERS : numberFormat}
          absent={PLAIN_FORMAT}
          onChange={(choice) =>
            choice === HIDDEN_NUMBERS ? onNumbersHiddenChange?.(true) : onNumberFormatChange(choice)
          }
        />
      )}
      {onNumberEmphasisChange && (
        <ChoiceSection
          label="Number"
          choices={Object.keys(NUMBER_EMPHASIS_LABELS) as (keyof typeof NUMBER_EMPHASIS_LABELS)[]}
          labels={NUMBER_EMPHASIS_LABELS}
          value={numberEmphasis}
          absent={NORMAL_EMPHASIS}
          onChange={onNumberEmphasisChange}
        />
      )}
    </Popover>
  );
}

/**
 * One row of pill choices over a closed set where one member (`absent`)
 * is stored as `undefined` -- card type, number format, number emphasis and
 * highlight style all work this way, so boards saved before each existed load unchanged.
 */
function ChoiceSection<T extends string, A extends string>({
  label,
  choices,
  labels,
  value,
  absent,
  onChange,
}: {
  readonly label: string;
  readonly choices: readonly (T | A)[];
  readonly labels: Readonly<Record<string, string>>;
  readonly value: T | undefined;
  readonly absent: A;
  readonly onChange: (value: T | undefined) => void;
}) {
  const current = value ?? absent;
  return (
    <div className={styles.section}>
      <span className={styles.label}>{label}</span>
      <div className={styles.choices} role="group" aria-label={label}>
        {choices.map((choice) => (
          <button
            key={choice}
            type="button"
            className={`${styles.choice} ${current === choice ? styles.choiceSelected : ""}`}
            onClick={() => onChange(choice === absent ? undefined : (choice as T))}
            aria-pressed={current === choice}
          >
            {labels[choice]}
          </button>
        ))}
      </div>
    </div>
  );
}
