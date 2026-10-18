import { useBackupStore } from "../../store/backupStore";
import { chooseBackupFolder, resumeBackups } from "./autoBackup";
import styles from "./RecoveryNotice.module.css";

/**
 * In embed mode there is no board menu, so a stopped automatic backup says
 * so here, with the one click that restarts it (the browser asks for that
 * click after a restart; one click resumes it in every tab and frame).
 * Backups never stop silently.
 */
export function EmbedBackupStrip() {
  const status = useBackupStore((s) => s.status);
  if (status !== "needs-permission" && status !== "folder-error") return null;
  const paused = status === "needs-permission";
  return (
    <div className={styles.notice} role="status" data-testid="embed-backup">
      <div className={styles.text}>
        <p className={styles.body}>
          {paused
            ? "Boardkit’s automatic backups are paused until you allow the folder again."
            : "Boardkit can’t write to its backup folder."}
        </p>
      </div>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          onClick={() => void (paused ? resumeBackups() : chooseBackupFolder())}
        >
          {paused ? "Resume backups" : "Choose folder…"}
        </button>
      </div>
    </div>
  );
}
