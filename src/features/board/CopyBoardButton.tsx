import { CheckIcon, CopyIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "../../components/ui/button";
import { copyAsImage } from "./copyAsImage";

interface CopyBoardButtonProps {
  readonly railRef: React.RefObject<HTMLElement | null>;
}

/**
 * Copies the whole board -- every list side by side, not just what the
 * scroller currently shows -- to the clipboard as an image, the board-level
 * twin of each list's own copy button. The rail is captured at zoom 1 so the
 * result does not depend on the current zoom level.
 */
export function CopyBoardButton({ railRef }: CopyBoardButtonProps) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");

  async function handleClick() {
    const rail = railRef.current;
    if (!rail) {
      return;
    }
    try {
      await copyAsImage(rail, { pixelRatio: 4, zoom: 1 });
      setState("copied");
    } catch (error) {
      console.error("copy board as image failed", error);
      setState("error");
    } finally {
      setTimeout(() => setState("idle"), 1500);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={handleClick}
      aria-label="Copy board as image"
      title="Copy board as image"
    >
      {state === "copied" ? <CheckIcon /> : state === "error" ? <TriangleAlertIcon /> : <CopyIcon />}
    </Button>
  );
}
