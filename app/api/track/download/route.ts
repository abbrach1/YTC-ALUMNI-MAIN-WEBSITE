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
 * POST /api/track/download
 *
 * Logs a shiur download event. Same body/auth contract as /api/track/play.
 */
export async function POST(req: Request) {
  const origin = req.headers.get("origin")
  const authHeader = req.headers.get("authorization")
  const hasAuth = !!authHeader && authHeader.startsWith("Bearer ")

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    logTrack("download", { ok: false, platform: null, hasAuth, origin, detail: "invalid_json" })
    return corsJson({ error: "Invalid JSON" }, { status: 400 }, origin)
  }

  const platform = sanitizePlatform(body.platform)
  const userAgent = sanitizeString(body.userAgent, 500)

  const shiurId = sanitizeString(body.shiurId, 200)
  if (!shiurId) {
    logTrack("download", {
      ok: false,
      platform,
      hasAuth,
      origin,
      userAgent,
      detail: "missing_shiurId",
    })
    return corsJson({ error: "shiurId is required" }, { status: 400 }, origin)
  }

  const db = getAdminDb()
  if (!db) {
    logTrack("download", {
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
    logTrack("download", {
      ok: false,
      platform,
      hasAuth,
      origin,
      userAgent,
      detail: "token_invalid",
    })
  }

  const userId = verified?.uid || sanitizeString(body.userId, 200)
  const userEmail = verified?.email || sanitizeString(body.userEmail, 320)
  const userName = verified?.name || sanitizeString(body.userName, 200)

  try {
    db.collection("shiurim")
      .doc(shiurId)
      .update({ downloadCount: FieldValue.increment(1) })
      .catch((err) => {
        console.error("[v0] track/download increment failed:", err)
      })

    await db.collection("shiurDownloads").add({
      shiurId,
      userId,
      userEmail,
      userName,
      platform,
      userAgent,
      source: "api",
      timestamp: FieldValue.serverTimestamp(),
    })

    logTrack("download", {
      ok: true,
      platform,
      hasAuth,
      userId,
      userEmail,
      userAgent,
      origin,
    })
    return corsJson({ ok: true }, { status: 200 }, origin)
  } catch (err) {
    console.error("[v0] track/download failed:", err)
    logTrack("download", {
      ok: false,
      platform,
      hasAuth,
      userAgent,
      origin,
      detail: "write_failed",
    })
    return corsJson(
      { error: "Failed to log download event" },
      { status: 500 },
      origin,
    )
  }
}
