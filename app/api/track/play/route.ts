import { FieldValue } from "firebase-admin/firestore"
import { getAdminDb, verifyAuthHeader } from "@/lib/firebase-admin"
import { corsJson, corsPreflight, sanitizePlatform, sanitizeString } from "@/lib/track-server"

export const runtime = "nodejs"

export async function OPTIONS(req: Request) {
  return corsPreflight(req.headers.get("origin"))
}

/**
 * POST /api/track/play
 *
 * Logs a shiur play event from any client (web, Android, iOS).
 * Body:
 *   { shiurId: string, platform?: string, userAgent?: string,
 *     userId?: string, userEmail?: string, userName?: string }
 *
 * If an `Authorization: Bearer <firebase-id-token>` header is present and
 * valid, the user info from the token overrides any client-claimed values.
 * If no token is present, the request is treated as anonymous and the
 * client-claimed user fields (if any) are stored verbatim - which is fine
 * because the engagement log is admin-only and we'd rather have lossy
 * attribution than no attribution at all.
 */
export async function POST(req: Request) {
  const origin = req.headers.get("origin")

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return corsJson({ error: "Invalid JSON" }, { status: 400 }, origin)
  }

  const shiurId = sanitizeString(body.shiurId, 200)
  if (!shiurId) {
    return corsJson({ error: "shiurId is required" }, { status: 400 }, origin)
  }

  const db = getAdminDb()
  if (!db) {
    return corsJson(
      { error: "Server tracking not configured" },
      { status: 503 },
      origin,
    )
  }

  // Verified user info from ID token (if present) takes precedence over
  // anything the client sent in the body
  const verified = await verifyAuthHeader(req.headers.get("authorization"))

  const platform = sanitizePlatform(body.platform)
  const userAgent = sanitizeString(body.userAgent, 500)
  const userId = verified?.uid || sanitizeString(body.userId, 200)
  const userEmail = verified?.email || sanitizeString(body.userEmail, 320)
  const userName = verified?.name || sanitizeString(body.userName, 200)

  try {
    // Best-effort counter increment - do not fail the whole request if this
    // misses (e.g. shiur was deleted)
    db.collection("shiurim")
      .doc(shiurId)
      .update({ playCount: FieldValue.increment(1) })
      .catch((err) => {
        console.error("[v0] track/play increment failed:", err)
      })

    await db.collection("shiurPlays").add({
      shiurId,
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
    console.error("[v0] track/play failed:", err)
    return corsJson(
      { error: "Failed to log play event" },
      { status: 500 },
      origin,
    )
  }
}
