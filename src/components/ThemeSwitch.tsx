import { Monitor, Moon, Sun } from "lucide-react";

import { THEME_CHOICES, THEME_LABELS, isThemeChoice, type ThemeChoice } from "../domain/theme";
import { useResolvedTheme, useSetThemeChoice, useThemeChoice } from "../store/themeStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

const ICONS: Readonly<Record<ThemeChoice, typeof Sun>> = {
  dark: Moon,
  light: Sun,
  system: Monitor,
};

/**
 * The Dark / Light / System switch, in the header. Supporting chrome, so
 * shadcn + Tailwind, styled like its neighbour the trash button. The trigger
 * shows the theme currently on screen (a sun in the light theme, a moon in
 * the dark one), even when the choice is System.
 */
export function ThemeSwitch() {
  const choice = useThemeChoice();
  const resolved = useResolvedTheme();
  const setChoice = useSetThemeChoice();
  const TriggerIcon = resolved === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Theme"
          title="Theme"
          className="ml-auto inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-muted hover:text-muted-foreground"
        >
          <TriggerIcon size={15} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuRadioGroup
          value={choice}
          onValueChange={(value) => isThemeChoice(value) && setChoice(value)}
        >
          {THEME_CHOICES.map((option) => {
            const Icon = ICONS[option];
            return (
              <DropdownMenuRadioItem key={option} value={option}>
                <Icon />
                {THEME_LABELS[option]}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
