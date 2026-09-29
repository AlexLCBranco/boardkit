import { useRef, useState, type ChangeEvent } from "react";

import { useAutoBackupStatus } from "../../store/selectors";
import { useRecoveryStore } from "../../store/recoveryStore";
import { keepRecoveredBoard, restoreFromBackupFile, restoreFromLatestBackup } from "./recovery";
import styles from "./RecoveryNotice.module.css";

/**
 * The banner shown when the board on screen was damaged in storage. It stays
 * until the user picks one of its actions -- there is no plain close button,
 * because each action is also what allows the damaged original to be written
 * over (see `recovery.ts`), and automatic backups stay paused until then.
 */
export function RecoveryNotice() {
  const damage = useRecoveryStore((state) => state.damage);
  const status = useAutoBackupStatus();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  if (!damage) return null;

  const hasFolder = status === "active" || status === "needs-permission" || status === "folder-error";
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };
  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void run(() => restoreFromBackupFile(file));
  };

  return (
    <div className={styles.notice} role="alert">
      <div className={styles.text}>
        <p className={styles.title}>
          {damage.status === "repaired"
            ? "Part of this board’s saved data was damaged"
            : "This board’s saved data couldn’t be read"}
        </p>
        <p className={styles.body}>
          {damage.status === "repaired"
            ? `Everything that could still be read is shown${lostClause(damage.lost)}.`
            : "It is shown empty."}{" "}
          {damage.setAsideKey
            ? "The original is kept, untouched, in case it is needed."
            : "There wasn’t room to keep a copy of the original, so changes to this board aren’t saved until you choose below."}{" "}
          Automatic backups are paused until you choose.
        </p>
      </div>
      <div className={styles.actions}>
        {hasFolder && (
          <button
            type="button"
            className={styles.primary}
            disabled={busy}
            onClick={() => void run(restoreFromLatestBackup)}
          >
            Restore from latest backup
          </button>
        )}
        <button
          type="button"
          className={hasFolder ? styles.secondary : styles.primary}
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          Restore from a file…
        </button>
        <button type="button" className={styles.secondary} disabled={busy} onClick={keepRecoveredBoard}>
          Keep this version
        </button>
      </div>
      <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={handleFile} />
    </div>
  );
}

function lostClause(lost: number): string {
  if (lost === 0) return "";
  return `; ${lost} damaged ${lost === 1 ? "entry" : "entries"} couldn’t be recovered`;
}
