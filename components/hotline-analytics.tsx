"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs, orderBy } from "firebase/firestore"

interface HotlineAnalytic {
  caller: string
  callId: string
  shiurTitle?: string
  action: string
  browseType?: string
  timestamp: any
}

export function HotlineAnalytics() {
  const [analytics, setAnalytics] = useState<HotlineAnalytic[]>([])
  const [stats, setStats] = useState({
    totalCalls: 0,
    uniqueCallers: 0,
    latestListened: 0,
    rebbeListened: 0,
    categoryListened: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    try {
      const analyticsQuery = query(
        collection(db, "hotlineAnalytics"),
        orderBy("timestamp", "desc")
      )
      const querySnapshot = await getDocs(analyticsQuery)
      const data: HotlineAnalytic[] = []
      
      querySnapshot.forEach((doc) => {
        data.push(doc.data() as HotlineAnalytic)
      })

      setAnalytics(data)

      // Calculate stats
      const uniqueCallers = new Set(data.map((a) => a.caller)).size
      const totalCalls = data.filter((a) => a.action === "call_received").length
      const latestListened = data.filter((a) => a.action === "listened_latest").length
      const rebbeListened = data.filter((a) => a.action === "listened_rebbe").length
      const categoryListened = data.filter((a) => a.action === "listened_category").length

      setStats({
        totalCalls,
        uniqueCallers,
        latestListened,
        rebbeListened,
        categoryListened,
      })

      setLoading(false)
    } catch (error) {
      console.error("Error fetching analytics:", error)
      setLoading(false)
    }
  }

  if (loading) {
    return <div>Loading analytics...</div>
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCalls}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Unique Callers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.uniqueCallers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Latest Listened</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.latestListened}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">By Rebbe</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.rebbeListened}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">By Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.categoryListened}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Call Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Caller</th>
                  <th className="text-left py-2">Call ID</th>
                  <th className="text-left py-2">Shiur/Action</th>
                  <th className="text-left py-2">Type</th>
                  <th className="text-left py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {analytics.slice(0, 50).map((analytic, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="py-2">{analytic.caller}</td>
                    <td className="py-2 font-mono text-xs">{analytic.callId?.slice(-8)}</td>
                    <td className="py-2">{analytic.shiurTitle || analytic.action}</td>
                    <td className="py-2">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                        {analytic.browseType || "direct"}
                      </span>
                    </td>
                    <td className="py-2 text-xs text-gray-500">
                      {analytic.timestamp?.toDate?.()?.toLocaleString() || "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
