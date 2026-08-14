/*
 * Dentons KMN ERP
 * Copyright (c) 2026 Bouquet Innovation SA. All rights reserved.
 * Proprietary and confidential. Unauthorised copying, distribution, modification,
 * or use of this file, via any medium, is strictly prohibited.
 */
// Timer helpers. Elapsed time is always DERIVED from the stored
// accumulatedSec + runningSince, never from the browser, so a timer survives
// reloads, device switches and sleeping laptops.
import "server-only";

export interface TimerRow {
  accumulatedSec: number;
  runningSince: Date | null;
  status: string;
}

/** Seconds elapsed on a timer, including the currently running stretch. */
export function elapsedSeconds(t: TimerRow, now: Date = new Date()): number {
  const running = t.runningSince ? Math.max(0, Math.floor((now.getTime() - t.runningSince.getTime()) / 1000)) : 0;
  return t.accumulatedSec + running;
}

// Law firms bill in 6-minute (0.1 hour) increments. Round the captured time UP
// to the next increment, with a 6-minute floor for any recorded work.
export const BILLING_INCREMENT_MIN = 6;

export function toBillableMinutes(seconds: number): number {
  const mins = seconds / 60;
  const inc = BILLING_INCREMENT_MIN;
  return Math.max(inc, Math.ceil(mins / inc) * inc);
}

/** "1h 23m" / "45m" for compact display. */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}
