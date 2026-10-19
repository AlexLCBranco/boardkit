import { setEmbedded } from "../../store/embedStore";

/**
 * Imported first by `whiteboard/index.ts`, before anything loads the board
 * store: the whiteboard is embed mode with no board open yet, so loading the
 * store opens nothing and writes nothing (no first-run seed board, no board
 * list, not the active board). `openEmbeddedBoard` opens the board being
 * edited. The id is a placeholder no board has.
 */
setEmbedded({ id: "whiteboard:none" });
