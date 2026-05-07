"use client"

import { useState, type ReactNode } from "react"
import { collection, getDocs, query, where, orderBy, limit } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Loader2, User } from "lucide-react"
import { platformLabel } from "@/lib/platform"

interface EngagementEntry {
  id: string
  userEmail: string | null
  userName: string | null
  userId: string | null
  platform: string | null
  timestamp: Date | null
}

interface EngagementHoverCardProps {
  shiurId: string
  type: "plays" | "downloads"
  total: number
  children: ReactNode
}

const COLLECTION_NAME: Record<"plays" | "downloads", string> = {
  plays: "shiurPlays",
  downloads: "shiurDownloads",
}

export function EngagementHoverCard({ shiurId, type, total, children }: EngagementHoverCardProps) {
  const [entries, setEntries] = useState<EngagementEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadEntries = async () => {
    if (entries !== null || loading) return
    setLoading(true)
    setError(null)
    try {
      // Try ordered query first; if a composite index is missing, fall back to a simple where query
      const collName = COLLECTION_NAME[type]
      let snapshot
      try {
        const q = query(
          collection(db, collName),
          where("shiurId", "==", shiurId),
          orderBy("timestamp", "desc"),
          limit(50),
        )
        snapshot = await getDocs(q)
      } catch (orderErr) {
        // Likely a missing composite index in Firestore. Fall back to unordered query.
        console.warn("[v0] Engagement hover-card falling back to unordered query:", orderErr)
        const fallback = query(collection(db, collName), where("shiurId", "==", shiurId), limit(50))
        snapshot = await getDocs(fallback)
      }

      const list: EngagementEntry[] = snapshot.docs.map((d) => {
        const data = d.data() as Record<string, unknown>
        const ts = data.timestamp as { toDate?: () => Date } | null | undefined
        return {
          id: d.id,
          userEmail: (data.userEmail as string) || null,
          userName: (data.userName as string) || null,
          userId: (data.userId as string) || null,
          platform: (data.platform as string) || null,
          timestamp: ts?.toDate ? ts.toDate() : null,
        }
      })
      // Manually sort if we used the fallback path
      list.sort((a, b) => {
        const at = a.timestamp ? a.timestamp.getTime() : 0
        const bt = b.timestamp ? b.timestamp.getTime() : 0
        return bt - at
      })
      setEntries(list)
    } catch (err) {
      console.error("[v0] Failed to load engagement entries:", err)
      setError("Failed to load history.")
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (date: Date | null) => {
    if (!date) return ""
    const now = Date.now()
    const diff = now - date.getTime()
    const minute = 60 * 1000
    const hour = 60 * minute
    const day = 24 * hour
    if (diff < minute) return "just now"
    if (diff < hour) return `${Math.floor(diff / minute)}m ago`
    if (diff < day) return `${Math.floor(diff / hour)}h ago`
    if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
  }

  // Group entries by user email so the same listener doesn't dominate the list
  const grouped = entries
    ? Array.from(
        entries.reduce((map, entry) => {
          const key = entry.userEmail || entry.userId || `anon-${entry.id}`
          const existing = map.get(key)
          if (!existing) {
            map.set(key, { ...entry, count: 1, latest: entry.timestamp })
          } else {
            existing.count += 1
            if (entry.timestamp && (!existing.latest || entry.timestamp > existing.latest)) {
              existing.latest = entry.timestamp
            }
          }
          return map
        }, new Map<string, EngagementEntry & { count: number; latest: Date | null }>()),
      ).map(([, v]) => v)
    : []

  return (
    <HoverCard openDelay={150} onOpenChange={(open) => { if (open) loadEntries() }}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); loadEntries() }}
          className="flex items-center gap-1 hover:text-navy hover:underline cursor-help focus:outline-none focus:ring-1 focus:ring-gold/40 rounded"
          aria-label={`View ${type} history`}
        >
          {children}
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 p-0" align="start">
        <div className="px-3 py-2 border-b border-border bg-muted/40">
          <p className="text-sm font-semibold text-navy">
            {total} {type === "plays" ? "Plays" : "Downloads"}
          </p>
          <p className="text-xs text-muted-foreground">
            {entries && entries.length > 0
              ? `${grouped.length} unique listener${grouped.length !== 1 ? "s" : ""}`
              : "Most recent activity"}
          </p>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-6 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs">Loading history...</span>
            </div>
          )}
          {!loading && error && (
            <p className="px-3 py-4 text-xs text-destructive">{error}</p>
          )}
          {!loading && !error && entries && entries.length === 0 && (
            <p className="px-3 py-4 text-xs text-muted-foreground">
              No tracked {type} yet. New {type} will be recorded going forward.
            </p>
          )}
          {!loading && !error && grouped.length > 0 && (
            <ul className="divide-y divide-border/60">
              {grouped.map((entry) => (
                <li key={entry.id} className="flex items-start gap-2 px-3 py-2">
                  <div className="h-7 w-7 rounded-full bg-navy/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="h-3.5 w-3.5 text-navy/60" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-navy truncate">
                        {entry.userName || entry.userEmail || "Anonymous"}
                      </p>
                      {entry.platform && (
                        <span
                          className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            entry.platform === "android"
                              ? "bg-green-100 text-green-700"
                              : entry.platform === "ios" || entry.platform === "ipados"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {platformLabel(entry.platform)}
                        </span>
                      )}
                    </div>
                    {entry.userName && entry.userEmail && (
                      <p className="text-[11px] text-muted-foreground truncate">{entry.userEmail}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {entry.count > 1 ? `${entry.count}x - ` : ""}
                      {formatTime(entry.latest)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
