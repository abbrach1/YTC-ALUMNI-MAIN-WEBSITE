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
  android: "#22c55e",
  ios: "#3b82f6",
  ipados: "#60a5fa",
  "web-desktop": "#0c1a35",
  "web-mobile": "#6b7280",
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

        // Convert legacy analytics/daily/{date}/{pageKey} docs into PageViewEvent shape
        // so the dashboard's existing display logic just works.
        const legacyPageViews: PageViewEvent[] = []
        dailySnaps.forEach((snap, idx) => {
          if (!snap) return
          const date = dateList[idx]
          snap.docs.forEach((d) => {
            const data = d.data() as Record<string, unknown>
            // _visitors doc holds an array of users seen that day - expand each
            if (d.id === "_visitors") {
              const users = (data.users as Array<{ email?: string; name?: string; lastSeen?: string }>) || []
              users.forEach((u, i) => {
                const ts = u.lastSeen ? new Date(u.lastSeen) : new Date(date)
                legacyPageViews.push({
                  id: `${date}_visitor_${i}`,
                  path: "(site)",
                  userId: null,
                  userEmail: u.email || null,
                  userName: u.name || null,
                  platform: null,
                  referrer: null,
                  timestamp: isNaN(ts.getTime()) ? new Date(date) : ts,
                })
              })
              return
            }
            // Page-view counter doc - expand into N events for the day so per-day
            // counts and top-pages aggregates work without changing display code.
            const path = (data.path as string) || "/"
            const views = (data.views as number) || 0
            const lastVisit = data.lastVisit as string | undefined
            const ts = lastVisit ? new Date(lastVisit) : new Date(date)
            for (let i = 0; i < views; i++) {
              legacyPageViews.push({
                id: `${date}_${d.id}_${i}`,
                path,
                userId: null,
                userEmail: null,
                userName: null,
                platform: null,
                referrer: null,
                timestamp: isNaN(ts.getTime()) ? new Date(date) : ts,
              })
            }
          })
        })

        // Merge: native /api/track/pageview events + legacy daily counters
        const mergedPageViews = [...pageViewsData, ...legacyPageViews]

        if (cancelled) return
        setPlays(playsData)
        setDownloads(downloadsData)
        setPageViews(mergedPageViews)
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

  const siteStats = useMemo(() => {
    // "(site)" entries are visitor-only records from the legacy daily _visitors doc -
    // they don't represent a page view. Real page views have a real path.
    const realPageViews = pageViews.filter((pv) => pv.path !== "(site)")
    const visitors = new Set<string>()
    pageViews.forEach((pv) => {
      const id = pv.userId || pv.userEmail
      if (id) visitors.add(id)
    })
    return {
      totalViews: realPageViews.length,
      uniqueVisitors: visitors.size,
    }
  }, [pageViews])

  const topPages = useMemo(() => {
    const counts: Record<string, { views: number; visitors: Set<string> }> = {}
    pageViews.forEach((pv) => {
      // Skip the legacy visitor-roll placeholder
      if (pv.path === "(site)") return
      // Strip query strings for grouping but keep the path
      const path = pv.path.split("?")[0] || "/"
      if (!counts[path]) counts[path] = { views: 0, visitors: new Set() }
      counts[path].views += 1
      const id = pv.userId || pv.userEmail
      if (id) counts[path].visitors.add(id)
    })
    return Object.entries(counts)
      .map(([path, c]) => ({
        path,
        views: c.views,
        uniqueVisitors: c.visitors.size,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10)
  }, [pageViews])

  const recentVisitors = useMemo(() => {
    // Prefer entries that have a user attached (the legacy _visitors records,
    // and any future API events with auth). Anonymous page-counter expansions
    // are useful for totals but not for a "who visited recently" list.
    return pageViews
      .filter((pv) => pv.timestamp && (pv.userEmail || pv.userName || pv.userId))
      .sort((a, b) => b.timestamp!.getTime() - a.timestamp!.getTime())
      .slice(0, 25)
  }, [pageViews])

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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-3xl font-bold text-navy mb-1">Usage Analytics</h1>
          <p className="text-navy/70">
            Plays, downloads, and listener activity across web and mobile
          </p>
        </div>
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
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
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
              <StatCard
                icon={<Users className="h-5 w-5" />}
                label="All-Time Visitors"
                value={pageViewTotals?.uniqueVisitors ?? 0}
                accent="gold"
              />
            </div>

            {/* Top pages + recent visitors */}
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-gold/20 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="text-navy text-base">Top Pages</CardTitle>
                </CardHeader>
                <CardContent>
                  {topPages.length === 0 ? (
                    <EmptyState message="No page views in this range yet." />
                  ) : (
                    <ul className="divide-y divide-navy/5">
                      {topPages.map((p, i) => (
                        <li key={p.path} className="py-2.5 flex items-center gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-navy/10 text-navy text-xs font-semibold flex items-center justify-center">
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-mono text-navy truncate">{p.path}</p>
                            <p className="text-xs text-navy/50">
                              {p.uniqueVisitors} {p.uniqueVisitors === 1 ? "visitor" : "visitors"}
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-navy">
                            {p.views.toLocaleString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card className="border-gold/20 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="text-navy text-base">Recent Visitors</CardTitle>
                </CardHeader>
                <CardContent>
                  {recentVisitors.length === 0 ? (
                    <EmptyState message="No recent visitors yet." />
                  ) : (
                    <ul className="divide-y divide-navy/5 max-h-[400px] overflow-y-auto">
                      {recentVisitors.map((pv) => (
                        <li key={pv.id} className="py-2.5 flex items-center gap-3">
                          <span className="flex-shrink-0 h-8 w-8 rounded-full bg-navy/5 flex items-center justify-center">
                            <UserIcon className="h-4 w-4 text-navy/60" />
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-navy truncate">
                                {pv.userName || pv.userEmail || "Anonymous"}
                              </p>
                              {pv.platform && <PlatformBadge platform={pv.platform} />}
                            </div>
                            <p className="text-xs font-mono text-navy/60 truncate">
                              {pv.path === "(site)" ? "site visit" : pv.path}
                            </p>
                          </div>
                          <span className="text-xs text-navy/50 flex-shrink-0">
                            {formatTime(pv.timestamp)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
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
