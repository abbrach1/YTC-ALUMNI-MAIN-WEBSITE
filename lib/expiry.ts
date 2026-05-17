/**
 * Optional auto-hide timer for content (announcements, events, collections).
 *
 * Admin sets `hideAfterDays` (a positive integer). When the admin first
 * sets the field, `timerStartAt` is captured (ISO string). Item is hidden
 * when `now >= timerStartAt + hideAfterDays days`.
 *
 * If `hideAfterDays` is missing or 0/negative, the item never auto-hides.
 */
export interface Expirable {
  hideAfterDays?: number | null
  timerStartAt?: string | null
}

const DAY_MS = 24 * 60 * 60 * 1000

export function getExpiryAt(item: Expirable): number | null {
  if (!item.hideAfterDays || item.hideAfterDays <= 0) return null
  if (!item.timerStartAt) return null
  const start = Date.parse(item.timerStartAt)
  if (Number.isNaN(start)) return null
  return start + item.hideAfterDays * DAY_MS
}

export function isExpired(item: Expirable, now: number = Date.now()): boolean {
  const expiresAt = getExpiryAt(item)
  return expiresAt !== null && now >= expiresAt
}

export function filterExpired<T extends Expirable>(items: T[], now: number = Date.now()): T[] {
  return items.filter((item) => !isExpired(item, now))
}

/**
 * Compute the next-save payload for the timer fields.
 * - newDays falsy/<=0  → clears the timer (null both fields)
 * - newDays unchanged  → preserves existing timerStartAt
 * - newDays changed    → resets timerStartAt to now
 */
export function computeTimerFields(
  newDays: number | null | undefined,
  existing?: Expirable | null,
): { hideAfterDays: number | null; timerStartAt: string | null } {
  if (!newDays || newDays <= 0) {
    return { hideAfterDays: null, timerStartAt: null }
  }
  const unchanged = existing?.hideAfterDays === newDays && !!existing?.timerStartAt
  return {
    hideAfterDays: newDays,
    timerStartAt: unchanged ? existing!.timerStartAt! : new Date().toISOString(),
  }
}

/** Human-readable countdown like "expires in 3 days" or "expired 2 days ago". */
export function formatExpiryCountdown(item: Expirable, now: number = Date.now()): string | null {
  const expiresAt = getExpiryAt(item)
  if (expiresAt === null) return null
  const diffMs = expiresAt - now
  const absDays = Math.floor(Math.abs(diffMs) / DAY_MS)
  const absHours = Math.floor(Math.abs(diffMs) / (60 * 60 * 1000))
  if (diffMs <= 0) {
    if (absDays >= 1) return `expired ${absDays} day${absDays === 1 ? "" : "s"} ago`
    return `expired ${Math.max(absHours, 1)}h ago`
  }
  if (absDays >= 1) return `hides in ${absDays} day${absDays === 1 ? "" : "s"}`
  return `hides in ${Math.max(absHours, 1)}h`
}
