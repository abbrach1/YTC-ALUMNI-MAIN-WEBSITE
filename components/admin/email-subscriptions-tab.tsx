"use client"

import { useEffect, useMemo, useState } from "react"
import { collection, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import {
  ChevronDown,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  Tag,
  User as UserIcon,
  Users as UsersIcon,
} from "lucide-react"

interface SubscriptionRecord {
  userId: string
  email: string
  rebbeim: string[]
  tags: string[]
  updatedAt?: string | null
}

type GroupKind = "rebbe" | "tag"

interface SubscriberInfo {
  email: string
  userId: string
  updatedAt: Date | null
}

interface GroupItem {
  name: string
  subscribers: SubscriberInfo[]
}

function formatRelative(d: Date | null): string {
  if (!d) return "—"
  const ms = Date.now() - d.getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function EmailSubscriptionsTab() {
  const { toast } = useToast()
  const [subs, setSubs] = useState<SubscriptionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  const fetchSubs = async () => {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, "subscriptions"))
      const list: SubscriptionRecord[] = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>
        return {
          userId: typeof data.userId === "string" ? data.userId : d.id,
          email: (typeof data.email === "string" ? data.email : "").toLowerCase(),
          rebbeim: Array.isArray(data.rebbeim)
            ? (data.rebbeim as unknown[]).filter((x): x is string => typeof x === "string")
            : [],
          tags: Array.isArray(data.tags)
            ? (data.tags as unknown[]).filter((x): x is string => typeof x === "string")
            : [],
          updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null,
        }
      })
      setSubs(list)
    } catch (error: any) {
      console.error("Error loading subscriptions:", error)
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSubs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stats = useMemo(() => {
    let withAnything = 0
    const rebbeSet = new Set<string>()
    const tagSet = new Set<string>()
    let totalSubLines = 0
    subs.forEach((s) => {
      if (s.rebbeim.length + s.tags.length > 0) withAnything++
      s.rebbeim.forEach((r) => rebbeSet.add(r))
      s.tags.forEach((t) => tagSet.add(t))
      totalSubLines += s.rebbeim.length + s.tags.length
    })
    return {
      totalSubscribers: subs.length,
      withAnything,
      distinctRebbeim: rebbeSet.size,
      distinctTags: tagSet.size,
      avgPerSubscriber:
        withAnything === 0 ? 0 : Math.round((totalSubLines / withAnything) * 10) / 10,
    }
  }, [subs])

  const byRebbe = useMemo<GroupItem[]>(() => {
    const map: Record<string, SubscriberInfo[]> = {}
    subs.forEach((s) => {
      const ts = s.updatedAt ? new Date(s.updatedAt) : null
      const valid = ts && !isNaN(ts.getTime()) ? ts : null
      s.rebbeim.forEach((r) => {
        map[r] = map[r] || []
        map[r].push({ email: s.email, userId: s.userId, updatedAt: valid })
      })
    })
    return Object.entries(map)
      .map(([name, subscribers]) => ({
        name,
        subscribers: subscribers.sort((a, b) => a.email.localeCompare(b.email)),
      }))
      .sort((a, b) => b.subscribers.length - a.subscribers.length || a.name.localeCompare(b.name))
  }, [subs])

  const byTag = useMemo<GroupItem[]>(() => {
    const map: Record<string, SubscriberInfo[]> = {}
    subs.forEach((s) => {
      const ts = s.updatedAt ? new Date(s.updatedAt) : null
      const valid = ts && !isNaN(ts.getTime()) ? ts : null
      s.tags.forEach((t) => {
        map[t] = map[t] || []
        map[t].push({ email: s.email, userId: s.userId, updatedAt: valid })
      })
    })
    return Object.entries(map)
      .map(([name, subscribers]) => ({
        name,
        subscribers: subscribers.sort((a, b) => a.email.localeCompare(b.email)),
      }))
      .sort((a, b) => b.subscribers.length - a.subscribers.length || a.name.localeCompare(b.name))
  }, [subs])

  const filteredSubs = useMemo(() => {
    const q = search.trim().toLowerCase()
    const sorted = [...subs].sort((a, b) => {
      const at = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
      const bt = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
      return bt - at
    })
    if (!q) return sorted
    return sorted.filter(
      (s) =>
        s.email.includes(q) ||
        s.rebbeim.some((r) => r.toLowerCase().includes(q)) ||
        s.tags.some((t) => t.toLowerCase().includes(q)),
    )
  }, [subs, search])

  const toggleGroup = (kind: GroupKind, name: string) => {
    const key = `${kind}::${name}`
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const isOpen = (kind: GroupKind, name: string) => !!openGroups[`${kind}::${name}`]

  const renderGroupCard = (kind: GroupKind, items: GroupItem[]) => {
    const isRebbe = kind === "rebbe"
    return (
      <Card className="border-gold/20 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-navy flex items-center gap-2 text-lg">
            {isRebbe ? (
              <UserIcon className="h-5 w-5 text-gold" />
            ) : (
              <Tag className="h-5 w-5 text-gold" />
            )}
            {isRebbe ? "By Rebbe" : "By Topic"}
            <span className="text-xs text-navy/50 font-normal">
              {items.length}{" "}
              {items.length === 1
                ? isRebbe
                  ? "rebbe"
                  : "topic"
                : isRebbe
                  ? "rebbeim"
                  : "topics"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {items.length === 0 ? (
            <p className="text-sm text-navy/50 italic py-4 text-center">
              No {isRebbe ? "rebbeim" : "topics"} have any subscribers yet.
            </p>
          ) : (
            <ul className="divide-y divide-navy/5">
              {items.map((item) => {
                const open = isOpen(kind, item.name)
                return (
                  <li key={item.name} className="py-1">
                    <button
                      type="button"
                      onClick={() => toggleGroup(kind, item.name)}
                      className="w-full flex items-center justify-between gap-3 py-2 px-2 rounded-md hover:bg-gold/5 text-left"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ChevronDown
                          className={`h-4 w-4 text-navy/50 transition-transform flex-shrink-0 ${
                            open ? "rotate-0" : "-rotate-90"
                          }`}
                        />
                        <span className="text-sm font-medium text-navy truncate">
                          {item.name}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-navy bg-gold/15 border border-gold/30 px-2 py-0.5 rounded-full">
                        {item.subscribers.length}
                      </span>
                    </button>
                    {open && (
                      <ul className="pl-7 pr-2 pb-2 pt-1 space-y-1">
                        {item.subscribers.map((sub) => (
                          <li
                            key={sub.userId}
                            className="flex items-center justify-between gap-2 text-xs text-navy/80"
                          >
                            <span className="flex items-center gap-1.5 min-w-0">
                              <Mail className="h-3 w-3 text-navy/40 flex-shrink-0" />
                              <span className="truncate">{sub.email}</span>
                            </span>
                            <span className="text-navy/45 flex-shrink-0">
                              {formatRelative(sub.updatedAt)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-serif text-2xl font-bold text-navy">Email Subscriptions</h2>
          <p className="text-sm text-navy/60 mt-1">
            Who has signed up for new-shiur email notifications, grouped by rebbe and topic.
          </p>
        </div>
        <Button
          onClick={fetchSubs}
          variant="outline"
          disabled={loading}
          className="border-navy text-navy"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard label="Subscribers" value={stats.withAnything} />
        <StatCard label="Rebbeim followed" value={stats.distinctRebbeim} />
        <StatCard label="Topics followed" value={stats.distinctTags} />
        <StatCard label="Avg subs / person" value={stats.avgPerSubscriber} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-navy" />
        </div>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            {renderGroupCard("rebbe", byRebbe)}
            {renderGroupCard("tag", byTag)}
          </div>

          <Card className="border-gold/20 bg-white shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <CardTitle className="text-navy flex items-center gap-2 text-lg">
                  <UsersIcon className="h-5 w-5 text-gold" />
                  All Subscribers ({filteredSubs.length})
                </CardTitle>
                <div className="relative w-72 max-w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy/50" />
                  <Input
                    placeholder="Search email, rebbe, or topic"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 border-navy/20"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {filteredSubs.length === 0 ? (
                <p className="text-sm text-navy/50 italic py-8 text-center">
                  {search ? "No subscribers match your search." : "Nobody has subscribed yet."}
                </p>
              ) : (
                <ul className="divide-y divide-navy/5">
                  {filteredSubs.map((s) => {
                    const ts = s.updatedAt ? new Date(s.updatedAt) : null
                    const lastUpdated = ts && !isNaN(ts.getTime()) ? ts : null
                    return (
                      <li key={s.userId} className="py-3">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-navy truncate">{s.email}</p>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {s.rebbeim.map((r) => (
                                <Badge
                                  key={`r-${r}`}
                                  variant="outline"
                                  className="border-navy/30 text-navy"
                                >
                                  <UserIcon className="h-3 w-3 mr-1" />
                                  {r}
                                </Badge>
                              ))}
                              {s.tags.map((t) => (
                                <Badge
                                  key={`t-${t}`}
                                  variant="outline"
                                  className="border-gold/40 text-navy"
                                >
                                  <Tag className="h-3 w-3 mr-1" />
                                  {t}
                                </Badge>
                              ))}
                              {s.rebbeim.length + s.tags.length === 0 && (
                                <span className="text-xs text-navy/45 italic">
                                  No active subscriptions
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-xs text-navy/50 flex-shrink-0">
                            {formatRelative(lastUpdated)}
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="border-gold/20 bg-white shadow-sm">
      <CardContent className="p-5">
        <p className="text-xs font-medium text-navy/60 uppercase tracking-wide mb-2">
          {label}
        </p>
        <p className="font-serif font-bold text-navy text-3xl">
          {value.toLocaleString()}
        </p>
      </CardContent>
    </Card>
  )
}
