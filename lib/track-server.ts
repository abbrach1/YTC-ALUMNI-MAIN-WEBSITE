import { NextResponse } from "next/server"

/**
 * Allowed values for the `platform` field on tracking events.
 * Anything outside this set is coerced to "unknown" before being persisted.
 */
const ALLOWED_PLATFORMS = new Set([
  "android",
  "ios",
  "ipados",
  "web-mobile",
  "web-desktop",
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
