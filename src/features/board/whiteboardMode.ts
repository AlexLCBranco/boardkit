import { createContext, useContext } from "react";

/**
 * True for a board on the gauntlet whiteboard (`app/whiteboard/`), where a
 * few things differ: slim "+" buttons instead of "+ Add a card", a "⋯" menu
 * instead of the header's ×, header controls shown only on hover. False in
 * Boardkit itself, which looks and works as always.
 */
export const WhiteboardModeContext = createContext(false);

export const useWhiteboardMode = () => useContext(WhiteboardModeContext);
