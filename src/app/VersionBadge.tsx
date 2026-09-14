import styles from "./VersionBadge.module.css";

/**
 * `__APP_VERSION__` is the git short SHA at build time (see vite.config.ts),
 * not a hand-bumped semver -- it always matches what's actually deployed, so
 * there's nothing to remember to update.
 */
export function VersionBadge() {
  const buildTime = new Date(__BUILD_TIME__).toLocaleString();

  return (
    <div className={styles.badge} title={`Built ${buildTime}`}>
      {__APP_VERSION__}
    </div>
  );
}
