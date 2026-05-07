import { FieldValue } from "firebase-admin/firestore"
import { getAdminDb, verifyAuthHeader } from "@/lib/firebase-admin"
import {
  corsJson,
  corsPreflight,
  logTrack,
  sanitizePlatform,
  sanitizeString,
} from "@/lib/track-server"

export const runtime = "nodejs"

export async function OPTIONS(req: Request) {
  return corsPreflight(req.headers.get("origin"))
}

/**
 * POST /api/track/pageview
 *
 * Logs a screen / page navigation event. Use a web-style path so events
 * unify across web and native: "/", "/shiurim", "/shiurim/{id}", etc.
 *
 * Body:
 *   { path: string, referrer?: string, platform?: string, userAgent?: string,
 *     userId?: string, userEmail?: string, userName?: string }
 */
export async function POST(req: Request) {
  const origin = req.headers.get("origin")
  const authHeader = req.headers.get("authorization")
  const hasAuth = !!authHeader && authHeader.startsWith("Bearer ")

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    logTrack("pageview", {
      ok: false,
      platform: null,
      hasAuth,
      origin,
      detail: "invalid_json",
    })
    return corsJson({ error: "Invalid JSON" }, { status: 400 }, origin)
  }

  const platform = sanitizePlatform(body.platform)
  const userAgent = sanitizeString(body.userAgent, 500)
  const path = sanitizeString(body.path, 500)
  if (!path) {
    logTrack("pageview", {
      ok: false,
      platform,
      hasAuth,
      origin,
      userAgent,
      detail: "missing_path",
    })
    return corsJson({ error: "path is required" }, { status: 400 }, origin)
  }

  const db = getAdminDb()
  if (!db) {
    logTrack("pageview", {
      ok: false,
      platform,
      hasAuth,
      origin,
      userAgent,
      detail: "no_admin_db",
    })
    return corsJson(
      { error: "Server tracking not configured" },
      { status: 503 },
      origin,
    )
  }

  const verified = await verifyAuthHeader(authHeader)
  if (hasAuth && !verified) {
    logTrack("pageview", {
      ok: false,
      platform,
      hasAuth,
      origin,
      userAgent,
      detail: "token_invalid",
    })
  }

  const referrer = sanitizeString(body.referrer, 500)
  const userId = verified?.uid || sanitizeString(body.userId, 200)
  const userEmail = verified?.email || sanitizeString(body.userEmail, 320)
  const userName = verified?.name || sanitizeString(body.userName, 200)

  try {
    await db.collection("pageViews").add({
      path,
      referrer,
      userId,
      userEmail,
      userName,
      platform,
      userAgent,
      source: "api",
      timestamp: FieldValue.serverTimestamp(),
    })

    logTrack("pageview", {
      ok: true,
      platform,
      hasAuth,
      userId,
      userEmail,
      userAgent,
      origin,
      detail: `path=${path}`,
    })
    return corsJson({ ok: true }, { status: 200 }, origin)
  } catch (err) {
    console.error("[v0] track/pageview failed:", err)
    logTrack("pageview", {
      ok: false,
      platform,
      hasAuth,
      userAgent,
      origin,
      detail: "write_failed",
    })
    return corsJson(
      { error: "Failed to log pageview event" },
      { status: 500 },
      origin,
    )
  }
}
