import type { IconKey } from "../domain/types";
import styles from "./Icon.module.css";

interface IconProps {
  readonly name: IconKey;
  readonly size?: number;
  readonly className?: string;
}

/** One icon from `IconSprite`, sized and coloured like text via `currentColor`. */
export function Icon({ name, size = 14, className }: IconProps) {
  return (
    <svg
      className={[styles.icon, className].filter(Boolean).join(" ")}
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <use href={`#icon-${name}`} />
    </svg>
  );
}
