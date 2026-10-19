// First, before anything loads the board store (see prepare.ts).
import "./prepare";

/**
 * What the gauntlet whiteboard imports from Boardkit: a board as a
 * whiteboard object, drawn and edited by Boardkit's own components. See
 * `WhiteboardBoard.tsx`.
 */
export { WhiteboardBoard, type WhiteboardBoardProps } from "./WhiteboardBoard";
export { flushBoard } from "../../store/boardStore";
export { useThemeStore } from "../../store/themeStore";
export { IconSprite } from "../../components/IconSprite";
export { Toaster } from "../../components/ui/sonner";
