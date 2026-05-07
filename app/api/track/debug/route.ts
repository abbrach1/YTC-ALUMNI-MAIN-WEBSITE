import { getAdminDb } from "@/lib/firebase-admin"
import { corsJson, corsPreflight } from "@/lib/track-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function OPTIONS(req: Request) {
  return corsPreflight(req.headers.get("origin"))
}

/**
 * GET /api/track/debug
 *
 * Admin-only diagnostic endpoint that returns the most recent N raw events
 * from each tracking collection. Used by /admin/debug/tracking and by
 * mobile devs to confirm their writes are landing in real time, before the
 * daily-aggregation rollup runs.
 *
 * Optional query params:
 *   ?limit=50          (max 200)
 *   ?platform=android  (filter all collections by exact platform string)
 */
export async function GET(req: Request) {
  const origin = req.headers.get("origin")
  const db = getAdminDb()
  if (!db) {
    return corsJson(
      { error: "Server tracking not configured" },
      { status: 503 },
      origin,
    )
  }

  const url = new URL(req.url)
  const limitRaw = parseInt(url.searchParams.get("limit") || "50", 10)
  const limit = Math.max(1, Math.min(200, isNaN(limitRaw) ? 50 : limitRaw))
  const platformFilter = url.searchParams.get("platform")

  const fetchCollection = async (name: string) => {
    let q = db.collection(name).orderBy("timestamp", "desc").limit(limit)
    if (platformFilter) {
      // Re-build query with where clause when filtering
      q = db
        .collection(name)
        .where("platform", "==", platformFilter)
        .orderBy("timestamp", "desc")
        .limit(limit)
    }
    try {
      const snap = await q.get()
      return snap.docs.map((d) => {
        const data = d.data()
        const ts = data.timestamp
        return {
          id: d.id,
          ...data,
          timestamp:
            ts && typeof ts.toDate === "function" ? ts.toDate().toISOString() : null,
        }
      })
    } catch (err: any) {
      // Most likely cause: missing composite index when filtering by platform.
      console.error(`[v0] debug fetch ${name} failed:`, err)
      return { error: err?.message || "fetch failed" }
    }
  }

  const [plays, downloads, pageViews] = await Promise.all([
    fetchCollection("shiurPlays"),
    fetchCollection("shiurDownloads"),
    fetchCollection("pageViews"),
  ])

  return corsJson(
    {
      ok: true,
      filter: { limit, platform: platformFilter },
      counts: {
        plays: Array.isArray(plays) ? plays.length : 0,
        downloads: Array.isArray(downloads) ? downloads.length : 0,
        pageViews: Array.isArray(pageViews) ? pageViews.length : 0,
      },
      plays,
      downloads,
      pageViews,
    },
    { status: 200 },
    origin,
  )
}
