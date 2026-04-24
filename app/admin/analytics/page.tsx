"use client"

import { useState, useEffect } from "react"
import { collection, doc, getDoc, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Eye, TrendingUp, UserCheck, BarChart3 } from "lucide-react"

interface UserVisit {
  email: string
  name: string
  lastSeen: string
}

interface DailyStats {
  date: string
  views: number
  pages: { path: string; views: number }[]
  visitors: UserVisit[]
}

export default function AnalyticsPage() {
  const [totals, setTotals] = useState<{
    totalPageViews: number
    uniqueVisitors: number
    [key: string]: number
  } | null>(null)
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        // Fetch totals
        const totalsDoc = await getDoc(doc(db, "analytics", "totals"))
        if (totalsDoc.exists()) {
          setTotals(totalsDoc.data() as any)
        }

        // Fetch last 7 days
        const last7Days: DailyStats[] = []
        for (let i = 0; i < 7; i++) {
          const date = new Date()
          date.setDate(date.getDate() - i)
          const dateStr = date.toISOString().split("T")[0]

          const dayRef = collection(db, "analytics", "daily", dateStr)
          const dayDocs = await getDocs(dayRef)

          let dayViews = 0
          const pages: { path: string; views: number }[] = []
          let visitors: UserVisit[] = []

          dayDocs.forEach((docSnapshot) => {
            const data = docSnapshot.data()
            if (docSnapshot.id === "_visitors") {
              visitors = data.users || []
            } else {
              dayViews += data.views || 0
              pages.push({ path: data.path, views: data.views || 0 })
            }
          })

          if (dayViews > 0 || i < 3) {
            last7Days.push({
              date: dateStr,
              views: dayViews,
              pages: pages.sort((a, b) => b.views - a.views),
              visitors: visitors,
            })
          }
        }

        setDailyStats(last7Days)
      } catch (error) {
        console.error("Error fetching analytics:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
  }

  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  }

  const getPageName = (path: string) => {
    const names: { [key: string]: string } = {
      "/": "Home",
      "/shiurim": "Shiurim",
      "/events": "Events & Simchos",
      "/about": "About",
      "/login": "Login",
      "/register": "Register",
      "/upload-shiur": "Upload Shiur",
    }
    return names[path] || path
  }

  // Get top pages from totals
  const topPages = totals
    ? Object.entries(totals)
        .filter(([key]) => !["totalPageViews", "uniqueVisitors", "lastUpdated"].includes(key))
        .map(([key, value]) => ({
          path: key === "home" ? "/" : `/${key.replace(/_/g, "/")}`,
          views: value as number,
        }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 5)
    : []

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-navy">Site Analytics</h1>
        <p className="text-navy/60">Track visitor activity and page views</p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-gold/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-navy/70">Total Page Views</CardTitle>
            <Eye className="h-4 w-4 text-gold" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-navy">{totals?.totalPageViews || 0}</div>
            <p className="text-xs text-navy/60">All time</p>
          </CardContent>
        </Card>

        <Card className="border-gold/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-navy/70">Unique Visitors</CardTitle>
            <Users className="h-4 w-4 text-gold" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-navy">{totals?.uniqueVisitors || 0}</div>
            <p className="text-xs text-navy/60">All time (daily unique)</p>
          </CardContent>
        </Card>

        <Card className="border-gold/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-navy/70">Today's Views</CardTitle>
            <TrendingUp className="h-4 w-4 text-gold" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-navy">{dailyStats[0]?.views || 0}</div>
            <p className="text-xs text-navy/60">{formatDate(new Date().toISOString().split("T")[0])}</p>
          </CardContent>
        </Card>

        <Card className="border-gold/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-navy/70">Today's Users</CardTitle>
            <UserCheck className="h-4 w-4 text-gold" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-navy">{dailyStats[0]?.visitors?.length || 0}</div>
            <p className="text-xs text-navy/60">Logged in users</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Daily Activity - Views + Users Combined */}
        <Card className="border-gold/20 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-navy">Daily Activity</CardTitle>
            <CardDescription>Page views and logged-in users per day</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {dailyStats.length === 0 ? (
                <p className="text-navy/60 text-center py-4">No data yet</p>
              ) : (
                dailyStats.map((day) => (
                  <div key={day.date} className="border-b border-gold/10 pb-6 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-navy text-lg">{formatDate(day.date)}</span>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1 text-navy/70">
                          <Eye className="h-4 w-4 text-gold" />
                          {day.views} views
                        </span>
                        <span className="flex items-center gap-1 text-navy/70">
                          <UserCheck className="h-4 w-4 text-gold" />
                          {day.visitors?.length || 0} users
                        </span>
                      </div>
                    </div>

                    {/* Progress bar for views */}
                    <div className="h-2 bg-cream rounded-full overflow-hidden mb-4">
                      <div
                        className="h-full bg-gold rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (day.views / Math.max(...dailyStats.map((d) => d.views), 1)) * 100)}%`,
                        }}
                      />
                    </div>

                    {/* Users who visited */}
                    {day.visitors && day.visitors.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {day.visitors.map((visitor, idx) => (
                          <div
                            key={`${visitor.email}-${idx}`}
                            className="flex items-center gap-2 bg-cream/50 rounded-full px-3 py-1.5"
                          >
                            <div className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center">
                              <span className="text-xs font-medium text-navy">
                                {visitor.name?.charAt(0).toUpperCase() || "?"}
                              </span>
                            </div>
                            <div className="text-sm">
                              <span className="font-medium text-navy">{visitor.name}</span>
                              <span className="text-navy/50 ml-1 text-xs">({formatTime(visitor.lastSeen)})</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Pages */}
        <Card className="border-gold/20">
          <CardHeader>
            <CardTitle className="text-navy flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-gold" />
              Top Pages
            </CardTitle>
            <CardDescription>Most viewed pages (all time)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topPages.length === 0 ? (
                <p className="text-navy/60 text-center py-4">No data yet</p>
              ) : (
                topPages.map((page, index) => (
                  <div key={page.path} className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gold/10 text-gold font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-navy">{getPageName(page.path)}</div>
                      <div className="text-sm text-navy/60">{page.path}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-navy">{page.views}</div>
                      <div className="text-xs text-navy/60">views</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Page Breakdown for Today */}
        <Card className="border-gold/20">
          <CardHeader>
            <CardTitle className="text-navy flex items-center gap-2">
              <Eye className="h-5 w-5 text-gold" />
              Today's Pages
            </CardTitle>
            <CardDescription>Page views breakdown for today</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dailyStats[0]?.pages && dailyStats[0].pages.length > 0 ? (
                dailyStats[0].pages.map((page) => (
                  <div key={page.path} className="flex items-center justify-between">
                    <span className="text-navy">{getPageName(page.path)}</span>
                    <span className="font-medium text-navy">{page.views}</span>
                  </div>
                ))
              ) : (
                <p className="text-navy/60 text-center py-4">No page views today</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
