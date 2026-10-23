// First, before anything loads the board store (see prepare.ts).
import "./prepare";

/**
 * What the gauntlet whiteboard imports from Boardkit: a board as a
 * whiteboard object, drawn and edited by Boardkit's own components. See
 * `WhiteboardBoard.tsx`.
 */
export { WhiteboardBoard, type WhiteboardBoardProps } from "./WhiteboardBoard";
export { SaveFailedBanner } from "./SaveFailedBanner";
export { onBoardHistory, redoBoard, undoBoard } from "./history";
export { keyStoredElsewhere, onWroteHere } from "./bridge";
export { createWhiteboardBoard, deleteEmptyWhiteboardBoard, flushBoard, renameWhiteboardBoard } from "../../store/boardStore";
export { useThemeStore } from "../../store/themeStore";
export { useSelectionStore } from "../../store/selectionStore";
export { setWhiteboardItemUrl, useWhiteboardBoardUrl, whiteboardItemUrl, type WhiteboardLinkTarget } from "./links";
export { checkUrl } from "../../domain/url";
export { IconSprite } from "../../components/IconSprite";
export { Toaster } from "../../components/ui/sonner";
