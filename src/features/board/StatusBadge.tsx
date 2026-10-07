import { Check, CircleQuestionMark, Scissors, type LucideIcon } from "lucide-react";

import type { ItemStatus } from "../../domain/types";
import styles from "./StatusBadge.module.css";

/** How each status is shown: Linkkit's labels and icons (its
    `statusMeta.ts`), so a decision reads the same in both apps. */
const STATUS_META: Readonly<Record<ItemStatus, { readonly label: string; readonly icon: LucideIcon }>> = {
  keep: { label: "Keep", icon: Check },
  maybe: { label: "Maybe", icon: CircleQuestionMark },
  cut: { label: "Cut", icon: Scissors },
};

/**
 * A card's or list's keep / maybe / cut decision, as a small round badge.
 * Display only: statuses are set in Linkkit for now. Grey, never coloured,
 * so it never competes with the card's and list's own colours.
 */
export function StatusBadge({ status }: { readonly status: ItemStatus }) {
  const { label, icon: StatusIcon } = STATUS_META[status];
  return (
    <span className={styles.badge} data-status={status} role="img" aria-label={label} title={label}>
      <StatusIcon aria-hidden="true" />
    </span>
  );
}
