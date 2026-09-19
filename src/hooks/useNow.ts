import { useEffect, useState } from "react";

/** The current time, refreshed every `intervalMs`, for text like "2 min ago"
    that must keep ageing while nothing else re-renders it. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
