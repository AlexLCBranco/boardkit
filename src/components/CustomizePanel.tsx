import type { RefObject } from "react";

import { CARD_KIND_CHOICES, CARD_KIND_SPECS, NORMAL_KIND } from "../domain/cardKinds";
import {
  NORMAL_EMPHASIS,
  NUMBER_EMPHASIS_LABELS,
  NUMBER_FORMAT_LABELS,
  PLAIN_FORMAT,
} from "../domain/numberStyle";
import type { CardKind, IconKey, ItemColor, NumberEmphasis, NumberFormat } from "../domain/types";
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
  /** Cards only, and only numbered ones: how this card's number stands out.
      `undefined` means normal. */
  readonly numberEmphasis?: NumberEmphasis;
  readonly onNumberEmphasisChange?: (emphasis: NumberEmphasis | undefined) => void;
}

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
  numberEmphasis,
  onNumberEmphasisChange,
}: CustomizePanelProps) {
  const recent = useRecentColors();
  const forgetColor = useForgetColor();
  const { draft, updateDraft, commit, finish } = useColorDraft(onColorChange, onColorPreview);

  function handleClose() {
    finish();
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
          choices={Object.keys(NUMBER_FORMAT_LABELS) as (keyof typeof NUMBER_FORMAT_LABELS)[]}
          labels={NUMBER_FORMAT_LABELS}
          value={numberFormat}
          absent={PLAIN_FORMAT}
          onChange={onNumberFormatChange}
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
 * is stored as `undefined` -- card type, number format and number emphasis
 * all work this way, so boards saved before each existed load unchanged.
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
