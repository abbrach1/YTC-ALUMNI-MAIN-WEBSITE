import { FieldValue } from "firebase-admin/firestore"
import { getAdminDb, verifyAuthHeader } from "@/lib/firebase-admin"
import { corsJson, corsPreflight, sanitizePlatform, sanitizeString } from "@/lib/track-server"

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

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return corsJson({ error: "Invalid JSON" }, { status: 400 }, origin)
  }

  const path = sanitizeString(body.path, 500)
  if (!path) {
    return corsJson({ error: "path is required" }, { status: 400 }, origin)
  }

  const db = getAdminDb()
  if (!db) {
    return corsJson(
      { error: "Server tracking not configured" },
      { status: 503 },
      origin,
    )
  }

  const verified = await verifyAuthHeader(req.headers.get("authorization"))

  const platform = sanitizePlatform(body.platform)
  const referrer = sanitizeString(body.referrer, 500)
  const userAgent = sanitizeString(body.userAgent, 500)
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

    return corsJson({ ok: true }, { status: 200 }, origin)
  } catch (err) {
    console.error("[v0] track/pageview failed:", err)
    return corsJson(
      { error: "Failed to log pageview event" },
      { status: 500 },
      origin,
    )
  }
}
