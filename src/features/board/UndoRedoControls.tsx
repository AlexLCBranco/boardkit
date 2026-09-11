import { useCanRedo, useCanUndo, useRedo, useUndo } from "../../store/selectors";
import styles from "./UndoRedoControls.module.css";

/**
 * The visible half of undo/redo -- the shortcuts in `useUndoRedoShortcuts`
 * do the same two actions, this just makes them discoverable and shows
 * whether there is anything to undo or redo without having to try it.
 */
export function UndoRedoControls() {
  const undo = useUndo();
  const redo = useRedo();
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();

  return (
    <div className={styles.control}>
      <button
        type="button"
        className={styles.button}
        onClick={undo}
        disabled={!canUndo}
        aria-label="Undo"
        title="Undo (Ctrl+Z)"
      >
        ↶
      </button>
      <button
        type="button"
        className={styles.button}
        onClick={redo}
        disabled={!canRedo}
        aria-label="Redo"
        title="Redo (Ctrl+Shift+Z)"
      >
        ↷
      </button>
    </div>
  );
}
