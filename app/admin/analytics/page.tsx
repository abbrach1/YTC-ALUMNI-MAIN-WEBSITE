"use client"

import { useEffect, useMemo, useState } from "react"
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  Timestamp,
  where,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { platformLabel } from "@/lib/platform"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmailSubscriptionsTab } from "@/components/admin/email-subscriptions-tab"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"
import {
  BarChart3,
  Download,
  Eye,
  Loader2,
  Play,
  Smartphone,
  TrendingUp,
  User as UserIcon,
  Users,
} from "lucide-react"

interface EngagementEvent {
  id: string
  shiurId: string
  userId: string | null
  userEmail: string | null
  userName: string | null
  platform: string | null
  timestamp: Date | null
}

interface PageViewEvent {
  id: string
  path: string
  userId: string | null
  userEmail: string | null
  userName: string | null
  platform: string | null
  referrer: string | null
  timestamp: Date | null
}

interface VisitorRecord {
  email: string | null
  name: string
  lastSeen: Date | null
  visits: number
}

interface DailyAggregate {
  pages: Record<string, { views: number; lastVisit: Date | null }>
  visitors: VisitorRecord[]
}

interface ShiurInfo {
  id: string
  title: string
  rebbe?: string
}

type Range = "7d" | "30d" | "90d" | "all"

const RANGE_LABELS: Record<Range, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  all: "All time",
}

const PLATFORM_COLORS: Record<string, string> = {
  // Explicit native vs browser
  "ios-app": "#3b82f6",
  "ios-web": "#93c5fd",
  "ipados-app": "#60a5fa",
  "ipados-web": "#bfdbfe",
  "android-app": "#22c55e",
  "android-web": "#86efac",
  "web-desktop": "#0c1a35",
  "web-mobile": "#6b7280",
  // Legacy bare values
  android: "#22c55e",
  ios: "#3b82f6",
  ipados: "#60a5fa",
  unknown: "#9ca3af",
}

function rangeToCutoff(range: Range): Date | null {
  if (range === "all") return null
  const now = new Date()
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90
  const d = new Date(now)
  d.setDate(d.getDate() - days)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function formatDayLabel(key: string): string {
  const d = new Date(key + "T00:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function formatTime(d: Date | null): string {
  if (!d) return "—"
  const now = Date.now()
  const diff = now - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function userLabel(e: EngagementEvent): string {
  return e.userName || e.userEmail || "Anonymous"
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>("30d")
  const [loading, setLoading] = useState(true)
  const [plays, setPlays] = useState<EngagementEvent[]>([])
  const [downloads, setDownloads] = useState<EngagementEvent[]>([])
  const [pageViews, setPageViews] = useState<PageViewEvent[]>([])
  const [dailyAggregates, setDailyAggregates] = useState<Record<string, DailyAggregate>>({})
  const [dateRangeList, setDateRangeList] = useState<string[]>([])
  const [shiurInfo, setShiurInfo] = useState<Record<string, ShiurInfo>>({})
  const [pageViewTotals, setPageViewTotals] = useState<{
    totalPageViews: number
    uniqueVisitors: number
  } | null>(null)

  // Fetch engagement events whenever range changes
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const cutoff = rangeToCutoff(range)
        const buildQuery = (col: string) => {
          if (cutoff) {
            return query(
              collection(db, col),
              where("timestamp", ">=", Timestamp.fromDate(cutoff)),
            )
          }
          return query(collection(db, col))
        }

        // Build a list of dates to fetch from legacy analytics/daily/{date}/* schema.
        // For "all" timeframe, fall back to last 365 days as a reasonable upper bound.
        const dateList: string[] = []
        const daysToFetch = range === "all" ? 365 : range === "90d" ? 90 : range === "30d" ? 30 : 7
        for (let i = 0; i < daysToFetch; i++) {
          const d = new Date()
          d.setHours(0, 0, 0, 0)
          d.setDate(d.getDate() - i)
          dateList.push(d.toISOString().split("T")[0])
        }

        const [playsSnap, downloadsSnap, pageViewsSnap, totalsSnap, ...dailySnaps] = await Promise.all([
          getDocs(buildQuery("shiurPlays")),
          getDocs(buildQuery("shiurDownloads")),
          getDocs(buildQuery("pageViews")),
          getDoc(doc(db, "analytics", "totals")),
          ...dateList.map((date) =>
            getDocs(collection(db, "analytics", "daily", date)).catch(() => null),
          ),
        ])

        const mapEvent = (d: any): EngagementEvent => {
          const data = d.data()
          const ts = data.timestamp as { toDate?: () => Date } | null | undefined
          return {
            id: d.id,
            shiurId: data.shiurId || "",
            userId: data.userId || null,
            userEmail: data.userEmail || null,
            userName: data.userName || null,
            platform: (data.platform as string) || null,
            timestamp: ts?.toDate ? ts.toDate() : null,
          }
        }

        const mapPageView = (d: any): PageViewEvent => {
          const data = d.data()
          const ts = data.timestamp as { toDate?: () => Date } | null | undefined
          return {
            id: d.id,
            path: data.path || "/",
            userId: data.userId || null,
            userEmail: data.userEmail || null,
            userName: data.userName || null,
            platform: (data.platform as string) || null,
            referrer: data.referrer || null,
            timestamp: ts?.toDate ? ts.toDate() : null,
          }
        }

        const playsData = playsSnap.docs.map(mapEvent)
        const downloadsData = downloadsSnap.docs.map(mapEvent)
        const pageViewsData = pageViewsSnap.docs.map(mapPageView)

        // Build structured daily aggregates from legacy analytics/daily/{date}/* docs.
        // No event-expansion - we read counts directly from the page-counter docs and
        // visitor arrays directly from the _visitors doc. Days with no data become
        // empty aggregates so the UI can still show a row for that date.
        const aggregates: Record<string, DailyAggregate> = {}
        dateList.forEach((date) => {
          aggregates[date] = { pages: {}, visitors: [] }
        })
        dailySnaps.forEach((snap, idx) => {
          if (!snap) return
          const date = dateList[idx]
          const bucket = aggregates[date]
          snap.docs.forEach((d) => {
            const data = d.data() as Record<string, unknown>
            if (d.id === "_visitors") {
              type VisitorEntry = {
                email?: string
                name?: string
                lastSeen?: string
                visits?: number
              }
              // Newer schema: users is a map keyed by uid with an authoritative
              // `visits` count per user per day. Legacy schema: users is an array
              // with one element per pageview (no `visits` field) — fall back to
              // counting array occurrences. Handle both for backward compat.
              const rawUsers = data.users
              const isMap =
                rawUsers && typeof rawUsers === "object" && !Array.isArray(rawUsers)
              const userList: VisitorEntry[] = Array.isArray(rawUsers)
                ? (rawUsers as VisitorEntry[])
                : isMap
                  ? (Object.values(rawUsers) as VisitorEntry[])
                  : []
              const seen: Record<string, VisitorRecord> = {}
              userList.forEach((u) => {
                const email = u.email || "anon"
                const ts = u.lastSeen ? new Date(u.lastSeen) : null
                const existing = seen[email]
                // For map shape, trust the stored `visits` count.
                // For array shape (legacy), every element is one pageview, so add 1.
                const visitDelta = isMap ? Math.max(1, u.visits || 1) : 1
                if (!existing) {
                  seen[email] = {
                    email: u.email || null,
                    name: u.name || u.email || "Anonymous",
                    lastSeen: ts && !isNaN(ts.getTime()) ? ts : null,
                    visits: visitDelta,
                  }
                } else {
                  if (isMap) {
                    existing.visits = visitDelta
                  } else {
                    existing.visits += 1
                  }
                  if (ts && (!existing.lastSeen || ts > existing.lastSeen)) {
                    existing.lastSeen = ts
                  }
                }
              })
              bucket.visitors = Object.values(seen)
              return
            }
            const path = (data.path as string) || "/"
            const views = (data.views as number) || 0
            const lastVisit = data.lastVisit as string | undefined
            const ts = lastVisit ? new Date(lastVisit) : null
            bucket.pages[path] = {
              views: (bucket.pages[path]?.views || 0) + views,
              lastVisit: ts && !isNaN(ts.getTime()) ? ts : null,
            }
          })
        })

        if (cancelled) return
        setPlays(playsData)
        setDownloads(downloadsData)
        setPageViews(pageViewsData)
        setDailyAggregates(aggregates)
        setDateRangeList(dateList)
        if (totalsSnap.exists()) {
          const data = totalsSnap.data() as Record<string, unknown>
          setPageViewTotals({
            totalPageViews: (data.totalPageViews as number) || 0,
            uniqueVisitors: (data.uniqueVisitors as number) || 0,
          })
        }
      } catch (err) {
        console.error("[v0] Error loading analytics:", err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [range])

  // Fetch shiur metadata once we have IDs
  useEffect(() => {
    let cancelled = false
    const ids = new Set<string>()
    plays.forEach((p) => p.shiurId && ids.add(p.shiurId))
    downloads.forEach((d) => d.shiurId && ids.add(d.shiurId))
    const missing = Array.from(ids).filter((id) => !shiurInfo[id])
    if (missing.length === 0) return

    const load = async () => {
      try {
        const snap = await getDocs(collection(db, "shiurim"))
        if (cancelled) return
        const next: Record<string, ShiurInfo> = { ...shiurInfo }
        snap.forEach((d) => {
          const data = d.data() as Record<string, unknown>
          next[d.id] = {
            id: d.id,
            title: (data.title as string) || "Untitled",
            rebbe: (data.rebbe as string) || (data.rabbi as string) || undefined,
          }
        })
        setShiurInfo(next)
      } catch (err) {
        console.error("[v0] Error loading shiur info:", err)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plays, downloads])

  const stats = useMemo(() => {
    const uniqueListeners = new Set<string>()
    plays.forEach((p) => uniqueListeners.add(p.userId || p.userEmail || `anon:${p.id}`))

    const platformCounts: Record<string, number> = {}
    plays.forEach((p) => {
      const key = p.platform || "unknown"
      platformCounts[key] = (platformCounts[key] || 0) + 1
    })
    downloads.forEach((d) => {
      const key = d.platform || "unknown"
      platformCounts[key] = (platformCounts[key] || 0) + 1
    })

    const topPlatform =
      Object.entries(platformCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || null

    return {
      totalPlays: plays.length,
      totalDownloads: downloads.length,
      uniqueListeners: uniqueListeners.size,
      topPlatform,
      platformCounts,
    }
  }, [plays, downloads])

  const dailyData = useMemo(() => {
    const cutoff = rangeToCutoff(range)
    const start =
      cutoff ||
      (() => {
        const d = new Date()
        d.setDate(d.getDate() - 90)
        d.setHours(0, 0, 0, 0)
        return d
      })()

    const map: Record<string, { plays: number; downloads: number }> = {}
    const cursor = new Date(start)
    while (cursor <= new Date()) {
      map[formatDayKey(cursor)] = { plays: 0, downloads: 0 }
      cursor.setDate(cursor.getDate() + 1)
    }

    plays.forEach((p) => {
      if (!p.timestamp) return
      const key = formatDayKey(p.timestamp)
      if (map[key]) map[key].plays += 1
    })
    downloads.forEach((d) => {
      if (!d.timestamp) return
      const key = formatDayKey(d.timestamp)
      if (map[key]) map[key].downloads += 1
    })

    return Object.keys(map)
      .sort()
      .map((day) => ({ day, ...map[day] }))
  }, [plays, downloads, range])

  const platformPieData = useMemo(() => {
    return Object.entries(stats.platformCounts)
      .map(([platform, count]) => ({
        platform,
        label: platformLabel(platform),
        count,
        color: PLATFORM_COLORS[platform] || PLATFORM_COLORS.unknown,
      }))
      .sort((a, b) => b.count - a.count)
  }, [stats.platformCounts])

  // Users grouped by platform — answers "who used the Android app", etc.
  // Sources: pageViews (mobile pageview API events), plays, downloads.
  // Anonymous events (no userId/email) are skipped since they can't be named.
  const usersByPlatform = useMemo(() => {
    type UserStat = {
      key: string
      email: string | null
      name: string
      events: number
      lastSeen: Date | null
    }
    const byPlatform: Record<string, Record<string, UserStat>> = {}

    const visit = (
      platform: string | null,
      userId: string | null,
      userEmail: string | null,
      userName: string | null,
      timestamp: Date | null,
    ) => {
      const p = platform || "unknown"
      const key = userId || userEmail
      if (!key) return // anonymous events have no identity to group
      byPlatform[p] = byPlatform[p] || {}
      const existing = byPlatform[p][key]
      const name = userName || userEmail || "Anonymous"
      if (!existing) {
        byPlatform[p][key] = {
          key,
          email: userEmail,
          name,
          events: 1,
          lastSeen: timestamp,
        }
      } else {
        existing.events += 1
        if (timestamp && (!existing.lastSeen || timestamp > existing.lastSeen)) {
          existing.lastSeen = timestamp
          existing.name = name
        }
      }
    }

    pageViews.forEach((pv) =>
      visit(pv.platform, pv.userId, pv.userEmail, pv.userName, pv.timestamp),
    )
    plays.forEach((e) =>
      visit(e.platform, e.userId, e.userEmail, e.userName, e.timestamp),
    )
    downloads.forEach((e) =>
      visit(e.platform, e.userId, e.userEmail, e.userName, e.timestamp),
    )

    return Object.entries(byPlatform)
      .map(([platform, users]) => {
        const userList = Object.values(users).sort((a, b) => {
          const at = a.lastSeen?.getTime() ?? 0
          const bt = b.lastSeen?.getTime() ?? 0
          return bt - at
        })
        return {
          platform,
          label: platformLabel(platform),
          color: PLATFORM_COLORS[platform] || PLATFORM_COLORS.unknown,
          users: userList,
        }
      })
      .sort((a, b) => b.users.length - a.users.length)
  }, [pageViews, plays, downloads])

  const topShiurim = useMemo(() => {
    const counts: Record<string, { plays: number; downloads: number }> = {}
    plays.forEach((p) => {
      if (!p.shiurId) return
      counts[p.shiurId] = counts[p.shiurId] || { plays: 0, downloads: 0 }
      counts[p.shiurId].plays += 1
    })
    downloads.forEach((d) => {
      if (!d.shiurId) return
      counts[d.shiurId] = counts[d.shiurId] || { plays: 0, downloads: 0 }
      counts[d.shiurId].downloads += 1
    })
    return Object.entries(counts)
      .map(([shiurId, c]) => ({
        shiurId,
        title: shiurInfo[shiurId]?.title || shiurId,
        rebbe: shiurInfo[shiurId]?.rebbe,
        plays: c.plays,
        downloads: c.downloads,
        total: c.plays + c.downloads,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
  }, [plays, downloads, shiurInfo])

  const topListeners = useMemo(() => {
    const counts: Record<
      string,
      { name: string; email: string | null; plays: number; downloads: number }
    > = {}
    const add = (e: EngagementEvent, kind: "plays" | "downloads") => {
      const key = e.userId || e.userEmail
      if (!key) return // skip anonymous
      if (!counts[key]) {
        counts[key] = {
          name: e.userName || e.userEmail || "User",
          email: e.userEmail,
          plays: 0,
          downloads: 0,
        }
      }
      counts[key][kind] += 1
    }
    plays.forEach((p) => add(p, "plays"))
    downloads.forEach((d) => add(d, "downloads"))
    return Object.values(counts)
      .map((c) => ({ ...c, total: c.plays + c.downloads }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
  }, [plays, downloads])

  // Per-day breakdown: for each day in the selected range, who visited and which
  // pages got how many views. Reads from BOTH the legacy daily aggregates
  // (analytics/daily/{date}/...) AND any flat pageViews/plays/downloads events.
  // Platform info is collected per visitor so we can badge Android/iOS/etc.
  const dailyBreakdown = useMemo(() => {
    type VisitorBucket = {
      name: string
      email: string | null
      lastSeen: Date | null
      platforms: Set<string>
      visits: number
    }
    type Day = {
      dayKey: string
      dayLabel: string
      totalViews: number
      pages: { path: string; views: number }[]
      visitors: {
        key: string
        name: string
        email: string | null
        lastSeen: Date | null
        platforms: string[]
        visits: number
      }[]
    }

    const byDay: Record<
      string,
      {
        pages: Record<string, number>
        visitorMap: Record<string, VisitorBucket>
      }
    > = {}

    const ensureDay = (date: string) => {
      if (!byDay[date]) byDay[date] = { pages: {}, visitorMap: {} }
      return byDay[date]
    }

    const upsertVisitor = (
      date: string,
      key: string,
      info: {
        name: string
        email: string | null
        lastSeen: Date | null
        platform: string | null
        visits?: number
      },
    ) => {
      const bucket = ensureDay(date)
      const existing = bucket.visitorMap[key]
      const visitsDelta = info.visits ?? 1
      if (!existing) {
        bucket.visitorMap[key] = {
          name: info.name,
          email: info.email,
          lastSeen: info.lastSeen,
          platforms: new Set(info.platform ? [info.platform] : []),
          visits: visitsDelta,
        }
        return
      }
      // Newer lastSeen wins for name/email; platforms accumulate; visits sum
      if (
        info.lastSeen &&
        (!existing.lastSeen || info.lastSeen > existing.lastSeen)
      ) {
        existing.name = info.name
        existing.email = info.email ?? existing.email
        existing.lastSeen = info.lastSeen
      }
      if (info.platform) existing.platforms.add(info.platform)
      existing.visits += visitsDelta
    }

    // Seed each day in range so days with zero data still render
    dateRangeList.forEach((date) => ensureDay(date))

    // Legacy daily aggregates - no platform info available, leaves platforms empty
    Object.entries(dailyAggregates).forEach(([date, agg]) => {
      const bucket = ensureDay(date)
      Object.entries(agg.pages).forEach(([path, p]) => {
        bucket.pages[path] = (bucket.pages[path] || 0) + p.views
      })
      agg.visitors.forEach((v) => {
        const key = v.email || v.name
        upsertVisitor(date, key, {
          name: v.name,
          email: v.email,
          lastSeen: v.lastSeen,
          platform: null,
          visits: v.visits,
        })
      })
    })

    // Flat /api/track/pageview events - DO carry platform, this is where Android
    // and iOS app visits will surface from
    pageViews.forEach((pv) => {
      if (!pv.timestamp) return
      const dayKey = formatDayKey(pv.timestamp)
      const bucket = ensureDay(dayKey)
      const path = pv.path.split("?")[0] || "/"
      bucket.pages[path] = (bucket.pages[path] || 0) + 1
      const id = pv.userEmail || pv.userId
      if (id) {
        upsertVisitor(dayKey, id, {
          name: pv.userName || pv.userEmail || "Anonymous",
          email: pv.userEmail,
          lastSeen: pv.timestamp,
          platform: pv.platform,
        })
      }
    })

    // Plays and downloads also identify the visitor + platform. A user who
    // only listened to shiurim from the Android app should still show up
    // as an Android visitor for the day even without a /pageview event.
    const enrichFromEngagement = (events: EngagementEvent[]) => {
      events.forEach((e) => {
        if (!e.timestamp) return
        const id = e.userEmail || e.userId
        if (!id) return
        const dayKey = formatDayKey(e.timestamp)
        upsertVisitor(dayKey, id, {
          name: e.userName || e.userEmail || "Anonymous",
          email: e.userEmail,
          lastSeen: e.timestamp,
          platform: e.platform,
          // plays/downloads are engagement events, not pageviews —
          // don't inflate the visit count
          visits: 0,
        })
      })
    }
    enrichFromEngagement(plays)
    enrichFromEngagement(downloads)

    const days: Day[] = Object.entries(byDay)
      .map(([dayKey, b]) => {
        const totalViews = Object.values(b.pages).reduce((a, n) => a + n, 0)
        return {
          dayKey,
          dayLabel: formatDayLabel(dayKey),
          totalViews,
          pages: Object.entries(b.pages)
            .map(([path, views]) => ({ path, views }))
            .sort((a, b) => b.views - a.views),
          visitors: Object.entries(b.visitorMap)
            .map(([key, v]) => ({
              key,
              name: v.name,
              email: v.email,
              lastSeen: v.lastSeen,
              platforms: Array.from(v.platforms).sort(),
              visits: v.visits,
            }))
            .sort((a, b) => {
              const at = a.lastSeen?.getTime() ?? 0
              const bt = b.lastSeen?.getTime() ?? 0
              return bt - at
            }),
        }
      })
      .sort((a, b) => (a.dayKey < b.dayKey ? 1 : -1))

    return days
  }, [dateRangeList, dailyAggregates, pageViews, plays, downloads])

  const siteStats = useMemo(() => {
    const totalViews = dailyBreakdown.reduce((sum, d) => sum + d.totalViews, 0)
    const visitors = new Set<string>()
    dailyBreakdown.forEach((d) => {
      d.visitors.forEach((v) => visitors.add(v.email || v.name))
    })
    return {
      totalViews,
      uniqueVisitors: visitors.size,
    }
  }, [dailyBreakdown])



  const recentActivity = useMemo(() => {
    type Row = EngagementEvent & { kind: "play" | "download" }
    const all: Row[] = [
      ...plays.map((p) => ({ ...p, kind: "play" as const })),
      ...downloads.map((d) => ({ ...d, kind: "download" as const })),
    ]
    return all
      .filter((r) => r.timestamp)
      .sort((a, b) => b.timestamp!.getTime() - a.timestamp!.getTime())
      .slice(0, 25)
  }, [plays, downloads])

  const activityChartConfig: ChartConfig = {
    plays: { label: "Plays", color: "#0c1a35" },
    downloads: { label: "Downloads", color: "#c9a44e" },
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-bold text-navy mb-1">Analytics</h1>
        <p className="text-navy/70">
          Site activity, listener engagement, and email subscriptions
        </p>
      </div>

      <Tabs defaultValue="users-by-platform" className="space-y-6">
        <TabsList className="bg-white border border-gold/20">
          <TabsTrigger value="users-by-platform" className="data-[state=active]:bg-navy data-[state=active]:text-cream">
            Users by Platform
          </TabsTrigger>
          <TabsTrigger value="activity" className="data-[state=active]:bg-navy data-[state=active]:text-cream">
            Activity
          </TabsTrigger>
          <TabsTrigger value="subscriptions" className="data-[state=active]:bg-navy data-[state=active]:text-cream">
            Email Subscriptions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users-by-platform" className="space-y-6">
          <div className="flex justify-end">
            <Select value={range} onValueChange={(v) => setRange(v as Range)}>
              <SelectTrigger className="w-[180px] border-gold/30 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
                  <SelectItem key={r} value={r}>
                    {RANGE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-navy/50" />
            </div>
          ) : (
            <Card className="border-gold/20 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-navy flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-gold" />
                  Users by Platform
                  <span className="text-xs font-normal text-navy/50">
                    {usersByPlatform.length} platform
                    {usersByPlatform.length === 1 ? "" : "s"}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {usersByPlatform.length === 0 ? (
                  <EmptyState message="No platform-tagged user activity in this range yet." />
                ) : (
                  <div className="space-y-5">
                    {usersByPlatform.map((group) => (
                      <div key={group.platform}>
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className="h-3 w-3 rounded-sm flex-shrink-0"
                            style={{ backgroundColor: group.color }}
                          />
                          <h4 className="text-sm font-semibold text-navy">
                            {group.label}
                          </h4>
                          <span className="text-xs text-navy/50">
                            {group.users.length} user
                            {group.users.length === 1 ? "" : "s"}
                          </span>
                        </div>
                        <ul className="grid gap-2 sm:grid-cols-2">
                          {group.users.map((u) => (
                            <li
                              key={u.key}
                              className="flex items-center gap-2.5 p-2 rounded-md border border-navy/5 bg-cream/30"
                            >
                              <span className="flex-shrink-0 h-7 w-7 rounded-full bg-navy/5 flex items-center justify-center">
                                <UserIcon className="h-3.5 w-3.5 text-navy/60" />
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-navy truncate">
                                  {u.name}
                                </p>
                                {u.email && u.email !== u.name && (
                                  <p className="text-[11px] text-navy/50 truncate">
                                    {u.email}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col items-end text-[11px] text-navy/55 flex-shrink-0">
                                <span>{u.events} events</span>
                                <span>{formatTime(u.lastSeen)}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="activity" className="space-y-8">
          {/* Range selector for the Activity tab only */}
          <div className="flex justify-end">
            <Select value={range} onValueChange={(v) => setRange(v as Range)}>
              <SelectTrigger className="w-[180px] border-gold/30 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
                  <SelectItem key={r} value={r}>
                    {RANGE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-navy/50" />
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={<Play className="h-5 w-5" />}
              label="Total Plays"
              value={stats.totalPlays}
              accent="navy"
            />
            <StatCard
              icon={<Download className="h-5 w-5" />}
              label="Total Downloads"
              value={stats.totalDownloads}
              accent="gold"
            />
            <StatCard
              icon={<Users className="h-5 w-5" />}
              label="Unique Listeners"
              value={stats.uniqueListeners}
              accent="navy"
            />
            <StatCard
              icon={<Smartphone className="h-5 w-5" />}
              label="Top Platform"
              value={stats.topPlatform ? platformLabel(stats.topPlatform) : "—"}
              accent="gold"
              isText
            />
          </div>

          {/* Activity chart */}
          <Card className="border-gold/20 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-navy flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-gold" />
                Daily Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dailyData.every((d) => d.plays === 0 && d.downloads === 0) ? (
                <EmptyState message="No activity in this range yet." />
              ) : (
                <ChartContainer config={activityChartConfig} className="h-[280px] w-full">
                  <BarChart data={dailyData} margin={{ left: 8, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tickFormatter={(v) => formatDayLabel(v)}
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                      interval="preserveStartEnd"
                      minTickGap={24}
                    />
                    <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(label) => formatDayLabel(label as string)}
                        />
                      }
                    />
                    <Bar dataKey="plays" fill="var(--color-plays)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="downloads" fill="var(--color-downloads)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* Platform breakdown + Top shiurim */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-gold/20 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-navy flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-gold" />
                  Platform Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                {platformPieData.length === 0 ? (
                  <EmptyState message="No platform data yet." />
                ) : (
                  <div className="grid gap-6 md:grid-cols-2 items-center">
                    <ChartContainer config={{}} className="h-[220px] w-full">
                      <PieChart>
                        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                        <Pie
                          data={platformPieData}
                          dataKey="count"
                          nameKey="label"
                          innerRadius={50}
                          outerRadius={85}
                          strokeWidth={2}
                          stroke="#fff"
                        >
                          {platformPieData.map((entry) => (
                            <Cell key={entry.platform} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ChartContainer>
                    <div className="space-y-2">
                      {platformPieData.map((p) => {
                        const total = platformPieData.reduce((acc, x) => acc + x.count, 0)
                        const pct = total ? Math.round((p.count / total) * 100) : 0
                        return (
                          <div
                            key={p.platform}
                            className="flex items-center justify-between gap-3 text-sm"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="h-3 w-3 rounded-sm flex-shrink-0"
                                style={{ backgroundColor: p.color }}
                              />
                              <span className="text-navy truncate">{p.label}</span>
                            </div>
                            <div className="flex items-baseline gap-2 flex-shrink-0">
                              <span className="font-medium text-navy">{p.count}</span>
                              <span className="text-xs text-navy/50">{pct}%</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-gold/20 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-navy flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-gold" />
                  Top Shiurim
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topShiurim.length === 0 ? (
                  <EmptyState message="No shiur engagement yet." />
                ) : (
                  <ol className="space-y-3">
                    {topShiurim.map((s, i) => (
                      <li
                        key={s.shiurId}
                        className="flex items-start gap-3 pb-3 border-b border-navy/5 last:border-0 last:pb-0"
                      >
                        <span className="flex-shrink-0 h-7 w-7 rounded-full bg-navy/5 text-navy text-xs font-semibold flex items-center justify-center">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-navy truncate">{s.title}</p>
                          {s.rebbe && (
                            <p className="text-xs text-navy/50 truncate">{s.rebbe}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end text-xs text-navy/60 flex-shrink-0">
                          <span className="flex items-center gap-1">
                            <Play className="h-3 w-3" /> {s.plays}
                          </span>
                          <span className="flex items-center gap-1">
                            <Download className="h-3 w-3" /> {s.downloads}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top listeners + Recent activity */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-gold/20 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-navy flex items-center gap-2">
                  <UserIcon className="h-5 w-5 text-gold" />
                  Most Active Listeners
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topListeners.length === 0 ? (
                  <EmptyState message="No listener activity yet." />
                ) : (
                  <ol className="space-y-3">
                    {topListeners.map((l, i) => (
                      <li
                        key={(l.email || l.name) + i}
                        className="flex items-start gap-3 pb-3 border-b border-navy/5 last:border-0 last:pb-0"
                      >
                        <span className="flex-shrink-0 h-7 w-7 rounded-full bg-navy/5 text-navy text-xs font-semibold flex items-center justify-center">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-navy truncate">{l.name}</p>
                          {l.email && l.email !== l.name && (
                            <p className="text-xs text-navy/50 truncate">{l.email}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end text-xs text-navy/60 flex-shrink-0">
                          <span className="flex items-center gap-1">
                            <Play className="h-3 w-3" /> {l.plays}
                          </span>
                          <span className="flex items-center gap-1">
                            <Download className="h-3 w-3" /> {l.downloads}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>

            <Card className="border-gold/20 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="text-navy flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-gold" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentActivity.length === 0 ? (
                  <EmptyState message="No recent activity." />
                ) : (
                  <ul className="space-y-3 max-h-[420px] overflow-y-auto pr-2">
                    {recentActivity.map((row) => (
                      <li
                        key={row.kind + row.id}
                        className="flex items-start gap-3 pb-3 border-b border-navy/5 last:border-0 last:pb-0"
                      >
                        <div
                          className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center ${
                            row.kind === "play"
                              ? "bg-navy/10 text-navy"
                              : "bg-gold/15 text-gold"
                          }`}
                        >
                          {row.kind === "play" ? (
                            <Play className="h-3.5 w-3.5" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-navy truncate">
                              {userLabel(row)}
                            </p>
                            {row.platform && <PlatformBadge platform={row.platform} />}
                          </div>
                          <p className="text-xs text-navy/50 truncate">
                            {row.kind === "play" ? "Played" : "Downloaded"}{" "}
                            <span className="text-navy/70">
                              {shiurInfo[row.shiurId]?.title || row.shiurId || "shiur"}
                            </span>
                          </p>
                          <p className="text-[11px] text-navy/40 mt-0.5">
                            {formatTime(row.timestamp)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Site Activity */}
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <h2 className="font-serif text-2xl font-bold text-navy flex items-center gap-2">
                  <Eye className="h-6 w-6 text-gold" />
                  Site Activity
                </h2>
                <p className="text-sm text-navy/60 mt-1">
                  Page views and visitor activity across the site
                </p>
              </div>
            </div>

            {/* Site stat cards */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
              <StatCard
                icon={<Eye className="h-5 w-5" />}
                label="Page Views"
                value={siteStats.totalViews}
                accent="navy"
              />
              <StatCard
                icon={<Users className="h-5 w-5" />}
                label="Unique Visitors"
                value={siteStats.uniqueVisitors}
                accent="gold"
              />
              <StatCard
                icon={<Eye className="h-5 w-5" />}
                label="All-Time Views"
                value={pageViewTotals?.totalPageViews ?? 0}
                accent="navy"
              />
            </div>

            {/* Daily breakdown - one card per day showing who visited and which pages */}
            {dailyBreakdown.length === 0 ? (
              <Card className="border-gold/20 bg-white shadow-sm">
                <CardContent className="py-10">
                  <EmptyState message="No site activity in this range yet." />
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {dailyBreakdown.map((day) => (
                  <Card key={day.dayKey} className="border-gold/20 bg-white shadow-sm">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <CardTitle className="text-navy text-base flex items-center gap-2">
                          <span className="font-serif">{day.dayLabel}</span>
                          <span className="text-xs font-normal text-navy/50">
                            {day.dayKey}
                          </span>
                        </CardTitle>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="flex items-center gap-1.5 text-navy/70">
                            <Eye className="h-3.5 w-3.5 text-gold" />
                            <span className="font-semibold text-navy">{day.totalViews}</span>
                            {day.totalViews === 1 ? "view" : "views"}
                          </span>
                          <span className="flex items-center gap-1.5 text-navy/70">
                            <Users className="h-3.5 w-3.5 text-gold" />
                            <span className="font-semibold text-navy">{day.visitors.length}</span>
                            {day.visitors.length === 1 ? "visitor" : "visitors"}
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-6 md:grid-cols-2">
                      {/* Visitors that day */}
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-navy/50 mb-2">
                          Visitors
                        </p>
                        {day.visitors.length === 0 ? (
                          <p className="text-sm text-navy/40 italic">
                            No signed-in visitors recorded.
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {day.visitors.map((v) => (
                              <li key={v.key} className="flex items-center gap-2.5">
                                <span className="flex-shrink-0 h-7 w-7 rounded-full bg-navy/5 flex items-center justify-center">
                                  <UserIcon className="h-3.5 w-3.5 text-navy/60" />
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="text-sm font-medium text-navy truncate">
                                      {v.name}
                                    </p>
                                    {v.visits > 1 && (
                                      <span
                                        className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gold/15 text-navy border border-gold/30"
                                        title={`${v.visits} pageviews this day`}
                                      >
                                        ×{v.visits}
                                      </span>
                                    )}
                                    {v.platforms.map((p) => (
                                      <PlatformBadge key={p} platform={p} />
                                    ))}
                                  </div>
                                  {v.email && v.email !== v.name && (
                                    <p className="text-[11px] text-navy/50 truncate">{v.email}</p>
                                  )}
                                </div>
                                <span className="text-[11px] text-navy/40 flex-shrink-0">
                                  {formatTime(v.lastSeen)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Pages viewed that day */}
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-navy/50 mb-2">
                          Pages
                        </p>
                        {day.pages.length === 0 ? (
                          <p className="text-sm text-navy/40 italic">No page views recorded.</p>
                        ) : (
                          <ul className="space-y-1.5">
                            {day.pages.map((p) => (
                              <li
                                key={p.path}
                                className="flex items-center justify-between gap-3 text-sm"
                              >
                                <span className="font-mono text-navy/80 truncate">{p.path}</span>
                                <span className="font-semibold text-navy flex-shrink-0">
                                  {p.views.toLocaleString()}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

        </>
      )}
        </TabsContent>

        <TabsContent value="subscriptions">
          <EmailSubscriptionsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  accent,
  isText,
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  accent: "navy" | "gold"
  isText?: boolean
}) {
  return (
    <Card className="border-gold/20 bg-white shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-navy/60 uppercase tracking-wide">
            {label}
          </span>
          <span
            className={`h-8 w-8 rounded-lg flex items-center justify-center ${
              accent === "navy" ? "bg-navy/10 text-navy" : "bg-gold/15 text-gold"
            }`}
          >
            {icon}
          </span>
        </div>
        <p
          className={`font-serif font-bold text-navy ${isText ? "text-xl" : "text-3xl"}`}
        >
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
      </CardContent>
    </Card>
  )
}

function PlatformBadge({ platform }: { platform: string }) {
  const isAndroid = platform === "android"
  const isApple = platform === "ios" || platform === "ipados"
  return (
    <span
      className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium ${
        isAndroid
          ? "bg-green-100 text-green-700"
          : isApple
            ? "bg-blue-100 text-blue-700"
            : "bg-muted text-muted-foreground"
      }`}
    >
      {platformLabel(platform)}
    </span>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-12 text-center">
      <p className="text-sm text-navy/50">{message}</p>
    </div>
  )
}
