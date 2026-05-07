"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { Activity, Download, Eye, RefreshCw, Send, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"

type EventRow = {
  id: string
  shiurId?: string
  path?: string
  userId?: string | null
  userEmail?: string | null
  userName?: string | null
  platform?: string | null
  userAgent?: string | null
  source?: string | null
  timestamp?: string | null
  referrer?: string | null
}

type DebugResponse = {
  ok: boolean
  counts: { plays: number; downloads: number; pageViews: number }
  plays: EventRow[] | { error: string }
  downloads: EventRow[] | { error: string }
  pageViews: EventRow[] | { error: string }
}

const fetcher = async (url: string): Promise<DebugResponse> => {
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

const PLATFORM_FILTERS: { label: string; value: string | null; emphasize?: boolean }[] = [
  { label: "All", value: null },
  { label: "Android", value: "android", emphasize: true },
  { label: "iOS", value: "ios" },
  { label: "iPadOS", value: "ipados" },
  { label: "Web (mobile)", value: "web-mobile" },
  { label: "Web (desktop)", value: "web-desktop" },
  { label: "Unknown", value: "unknown" },
]

export default function TrackingDebugPage() {
  const [platformFilter, setPlatformFilter] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [testing, setTesting] = useState(false)
  const { toast } = useToast()

  const url = `/api/track/debug?limit=50${platformFilter ? `&platform=${platformFilter}` : ""}`

  const { data, error, isLoading, mutate } = useSWR<DebugResponse>(url, fetcher, {
    refreshInterval: autoRefresh ? 5000 : 0,
    revalidateOnFocus: true,
  })

  const sendTestPing = useCallback(async () => {
    setTesting(true)
    try {
      const res = await fetch("/api/track/pageview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "/_debug-ping",
          platform: "android",
          userAgent: "AdminDebugPanel/1.0 (synthetic-android)",
          userName: "Admin Debug Panel",
        }),
      })
      const text = await res.text()
      if (res.ok) {
        toast({
          title: "Test ping sent",
          description:
            "Synthetic Android pageview written. Refresh below to see it in pageViews.",
        })
        // Bump the auto-refresh immediately
        await mutate()
      } else {
        toast({
          title: "Test ping failed",
          description: `Status ${res.status}: ${text.slice(0, 200)}`,
          variant: "destructive",
        })
      }
    } catch (err: any) {
      toast({
        title: "Test ping threw",
        description: err?.message || "Unknown network error",
        variant: "destructive",
      })
    } finally {
      setTesting(false)
    }
  }, [mutate, toast])

  const lastUpdated = useMemo(() => new Date().toLocaleTimeString(), [data])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-navy mb-1">
          Tracking Debug Console
        </h1>
        <p className="text-navy/70">
          Real-time view of incoming play, download, and pageview events. Use this to
          confirm Android (or any client) is successfully writing to the analytics
          collections before the daily rollup runs.
        </p>
      </div>

      {/* Controls */}
      <Card className="border-gold/20 bg-white shadow-sm">
        <CardContent className="py-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-wide text-navy/50 mr-1">
              Platform:
            </span>
            {PLATFORM_FILTERS.map((f) => {
              const active = (platformFilter ?? null) === f.value
              return (
                <button
                  key={f.label}
                  onClick={() => setPlatformFilter(f.value)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition ${
                    active
                      ? "bg-navy text-cream border-navy"
                      : f.emphasize
                        ? "bg-gold/10 text-navy border-gold/40 hover:bg-gold/20"
                        : "bg-white text-navy/70 border-navy/15 hover:bg-navy/5"
                  }`}
                >
                  {f.label}
                </button>
              )
            })}
          </div>

          <div className="flex-1" />

          <label className="flex items-center gap-1.5 text-xs text-navy/70">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            Auto-refresh every 5s
          </label>

          <Button
            size="sm"
            variant="outline"
            onClick={() => mutate()}
            disabled={isLoading}
            className="border-navy/20 text-navy"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={sendTestPing}
            disabled={testing}
            className="bg-gold hover:bg-gold/90 text-navy"
          >
            <Send className="h-3.5 w-3.5 mr-1.5" />
            {testing ? "Sending..." : "Send test Android ping"}
          </Button>
        </CardContent>
      </Card>

      {/* Counts */}
      <div className="grid gap-3 sm:grid-cols-3">
        <CountCard
          icon={<Activity className="h-4 w-4" />}
          label="Plays"
          count={data?.counts.plays ?? 0}
          loading={isLoading && !data}
        />
        <CountCard
          icon={<Download className="h-4 w-4" />}
          label="Downloads"
          count={data?.counts.downloads ?? 0}
          loading={isLoading && !data}
        />
        <CountCard
          icon={<Eye className="h-4 w-4" />}
          label="Pageviews"
          count={data?.counts.pageViews ?? 0}
          loading={isLoading && !data}
        />
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-4 text-sm text-destructive">
            Failed to fetch debug data: {String(error)}
          </CardContent>
        </Card>
      )}

      <div className="text-xs text-navy/50">
        {data ? `Last fetched: ${lastUpdated}` : isLoading ? "Loading..." : ""}
        {platformFilter && (
          <>
            {" · "}
            Filtered to <span className="font-mono">{platformFilter}</span>
          </>
        )}
      </div>

      {/* Tabs of latest events */}
      <Tabs defaultValue="pageViews">
        <TabsList>
          <TabsTrigger value="pageViews">
            <Eye className="h-4 w-4 mr-1.5" /> Pageviews
          </TabsTrigger>
          <TabsTrigger value="plays">
            <Activity className="h-4 w-4 mr-1.5" /> Plays
          </TabsTrigger>
          <TabsTrigger value="downloads">
            <Download className="h-4 w-4 mr-1.5" /> Downloads
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pageViews" className="mt-4">
          <EventTable events={data?.pageViews} columns={["path", "platform", "user", "ua", "time"]} />
        </TabsContent>
        <TabsContent value="plays" className="mt-4">
          <EventTable events={data?.plays} columns={["shiurId", "platform", "user", "ua", "time"]} />
        </TabsContent>
        <TabsContent value="downloads" className="mt-4">
          <EventTable
            events={data?.downloads}
            columns={["shiurId", "platform", "user", "ua", "time"]}
          />
        </TabsContent>
      </Tabs>

      {/* Help text */}
      <Card className="border-gold/20 bg-cream/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-navy flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-gold" />
            What to check when Android events aren&apos;t showing
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-navy/80 space-y-2">
          <p>
            <strong>1. Filter by &quot;Android&quot; above.</strong> If counts go to 0, no Android
            request has reached the server yet. Network, DNS, or auth is failing on the
            device side.
          </p>
          <p>
            <strong>2. Click &quot;Send test Android ping&quot;.</strong> A synthetic event
            should appear in the Pageviews tab within seconds. If it doesn&apos;t, the
            server-side write itself is broken (check Vercel logs for{" "}
            <span className="font-mono">[track]</span> lines).
          </p>
          <p>
            <strong>3. Check Vercel logs</strong> for{" "}
            <span className="font-mono">event=play</span>,{" "}
            <span className="font-mono">platform=android</span>, and{" "}
            <span className="font-mono">detail=token_invalid</span> markers. Every incoming
            request now logs a one-line summary, so absence of any{" "}
            <span className="font-mono">platform=android</span> line means the request never
            arrived at all.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function CountCard({
  icon,
  label,
  count,
  loading,
}: {
  icon: React.ReactNode
  label: string
  count: number
  loading: boolean
}) {
  return (
    <Card className="border-gold/20 bg-white shadow-sm">
      <CardContent className="py-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-navy/60 mb-1">
          <span className="text-gold">{icon}</span>
          {label}
        </div>
        <div className="font-serif text-2xl font-bold text-navy">
          {loading ? "…" : count.toLocaleString()}
        </div>
      </CardContent>
    </Card>
  )
}

function PlatformBadge({ platform }: { platform: string | null | undefined }) {
  if (!platform) return <span className="text-xs text-navy/40">—</span>
  const styles: Record<string, string> = {
    android: "bg-emerald-100 text-emerald-800 border-emerald-200",
    ios: "bg-sky-100 text-sky-800 border-sky-200",
    ipados: "bg-sky-100 text-sky-800 border-sky-200",
    "web-mobile": "bg-navy/10 text-navy border-navy/20",
    "web-desktop": "bg-navy/10 text-navy border-navy/20",
    unknown: "bg-amber-100 text-amber-800 border-amber-200",
  }
  return (
    <span
      className={`inline-block text-[10px] font-mono px-1.5 py-0.5 rounded border ${
        styles[platform] || "bg-navy/5 text-navy/70 border-navy/15"
      }`}
    >
      {platform}
    </span>
  )
}

function EventTable({
  events,
  columns,
}: {
  events: EventRow[] | { error: string } | undefined
  columns: string[]
}) {
  if (!events) {
    return (
      <Card className="border-gold/20 bg-white shadow-sm">
        <CardContent className="py-10 text-center text-navy/50 text-sm">
          Loading…
        </CardContent>
      </Card>
    )
  }
  if (!Array.isArray(events)) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="py-6 text-sm text-destructive">
          Error: {events.error}
        </CardContent>
      </Card>
    )
  }
  if (events.length === 0) {
    return (
      <Card className="border-gold/20 bg-white shadow-sm">
        <CardContent className="py-10 text-center text-navy/50 text-sm">
          No events match the current filter.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-gold/20 bg-white shadow-sm">
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gold/20 text-left">
              {columns.map((c) => (
                <th key={c} className="py-2.5 px-3 text-navy/60 font-medium text-xs uppercase tracking-wide">
                  {c === "ua" ? "User-Agent" : c === "shiurId" ? "Shiur ID" : c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-b border-navy/5">
                {columns.map((col) => (
                  <td key={col} className="py-2 px-3 align-top">
                    {col === "platform" ? (
                      <PlatformBadge platform={e.platform} />
                    ) : col === "user" ? (
                      <div>
                        <div className="text-navy">
                          {e.userName || e.userEmail || (
                            <span className="text-navy/40 italic">anon</span>
                          )}
                        </div>
                        {e.userEmail && e.userName && e.userEmail !== e.userName && (
                          <div className="text-xs text-navy/50">{e.userEmail}</div>
                        )}
                      </div>
                    ) : col === "ua" ? (
                      <span
                        className="font-mono text-xs text-navy/60 truncate block max-w-[280px]"
                        title={e.userAgent || ""}
                      >
                        {e.userAgent || "—"}
                      </span>
                    ) : col === "time" ? (
                      <span className="text-xs text-navy/60 whitespace-nowrap">
                        {e.timestamp ? formatTime(e.timestamp) : "—"}
                      </span>
                    ) : col === "shiurId" ? (
                      <span className="font-mono text-xs text-navy">{e.shiurId || "—"}</span>
                    ) : col === "path" ? (
                      <span className="font-mono text-xs text-navy">{e.path || "—"}</span>
                    ) : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

function formatTime(iso: string) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const now = Date.now()
  const diff = (now - d.getTime()) / 1000
  if (diff < 60) return `${Math.max(1, Math.floor(diff))}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleString()
}
