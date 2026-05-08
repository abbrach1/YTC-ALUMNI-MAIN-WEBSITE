import { NextResponse } from "next/server"

/**
 * Allowed values for the `platform` field on tracking events.
 * Anything outside this set is coerced to "unknown" before being persisted.
 */
const ALLOWED_PLATFORMS = new Set([
  // Explicit native vs browser variants
  "ios-app",
  "ios-web",
  "ipados-app",
  "ipados-web",
  "android-app",
  "android-web",
  "web-mobile",
  "web-desktop",
  // Legacy bare values, kept so older clients aren't suddenly coerced to "unknown"
  "android",
  "ios",
  "ipados",
  "unknown",
])

export function sanitizePlatform(p: unknown): string {
  if (typeof p !== "string") return "unknown"
  const lower = p.toLowerCase().trim()
  return ALLOWED_PLATFORMS.has(lower) ? lower : "unknown"
}

/**
 * Caps a string to a max length and trims whitespace. Returns null for
 * empty / non-string input.
 */
export function sanitizeString(value: unknown, maxLen = 500): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, maxLen)
}

/**
 * Returns a CORS-friendly NextResponse. The tracking endpoints need to
 * accept requests from native apps that may use a custom origin (capacitor://,
 * ionic://, the Expo dev client, etc.) so we mirror the request's Origin
 * header rather than wildcarding.
 */
export function corsJson(
  data: unknown,
  init: ResponseInit = {},
  origin: string | null = null,
) {
  const res = NextResponse.json(data, init)
  res.headers.set("Access-Control-Allow-Origin", origin || "*")
  res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")
  res.headers.set("Vary", "Origin")
  return res
}

export function corsPreflight(origin: string | null = null) {
  return corsJson({ ok: true }, { status: 200 }, origin)
}

/**
 * Structured one-line log for incoming track requests so they're trivially
 * grep-able in Vercel logs while debugging Android integration:
 *
 *   [track] event=play platform=android auth=yes user=abc@x.com ua="ShiurPod/..."
 *
 * Pass minimal fields - we don't want PII in logs beyond what's necessary
 * to correlate with the in-app debug log on the device.
 */
export function logTrack(event: string, info: {
  ok: boolean
  platform: string | null
  hasAuth: boolean
  userId?: string | null
  userEmail?: string | null
  userAgent?: string | null
  origin?: string | null
  detail?: string
}) {
  const parts = [
    `[track] event=${event}`,
    `ok=${info.ok}`,
    `platform=${info.platform || "unknown"}`,
    `auth=${info.hasAuth ? "yes" : "no"}`,
  ]
  if (info.userId) parts.push(`uid=${info.userId.slice(0, 12)}`)
  if (info.userEmail) parts.push(`email=${info.userEmail}`)
  if (info.origin) parts.push(`origin=${info.origin}`)
  if (info.userAgent) parts.push(`ua="${info.userAgent.slice(0, 80)}"`)
  if (info.detail) parts.push(`detail=${info.detail}`)
  console.log(parts.join(" "))
}
