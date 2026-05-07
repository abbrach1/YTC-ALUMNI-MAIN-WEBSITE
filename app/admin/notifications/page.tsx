"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Bell, Send, Loader2, History } from "lucide-react"
import { collection, getDocs, query, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"

interface Rebbe {
  id: string
  name: string
}

interface NotificationRecord {
  id: string
  title: string
  body: string
  type: string
  topics: string[]
  platform: string
  sentAt: string
  status: string
}

export default function NotificationsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [rebbeim, setRebbeim] = useState<Rebbe[]>([])
  const [history, setHistory] = useState<NotificationRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  const [notificationType, setNotificationType] = useState<string>("announcement")
  const [selectedRebbe, setSelectedRebbe] = useState<string>("")
  const [customTopic, setCustomTopic] = useState<string>("")
  const [platform, setPlatform] = useState<"all" | "android" | "ios" | "web">("all")
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")

  const titleMaxLength = 50
  const bodyMaxLength = 200

  // Fetch rebbeim from Firebase
  useEffect(() => {
    const fetchRebbeim = async () => {
      try {
        const snapshot = await getDocs(collection(db, "rebbeim"))
        const rebbeimData: Rebbe[] = []
        snapshot.forEach((doc) => {
          const data = doc.data()
          rebbeimData.push({ id: doc.id, name: data.name || data.title || doc.id })
        })
        rebbeimData.sort((a, b) => a.name.localeCompare(b.name))
        setRebbeim(rebbeimData)
      } catch (error) {
        console.error("Error fetching rebbeim:", error)
      }
    }
    fetchRebbeim()
  }, [])

  // Fetch notification history
  const fetchHistory = async () => {
    setHistoryLoading(true)
    try {
      const snapshot = await getDocs(collection(db, "notificationHistory"))
      const items: NotificationRecord[] = []
      snapshot.forEach((doc) => {
        const data = doc.data()
        items.push({
          id: doc.id,
          title: data.title || "",
          body: data.body || "",
          type: data.type || "",
          topics: data.topics || [data.topic] || [],
          platform: data.platform || "all",
          sentAt: data.sentAt || "",
          status: data.status || "unknown",
        })
      })
      items.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
      setHistory(items)
    } catch (error) {
      console.error("Error fetching notification history:", error)
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [])

  // Sanitize rebbe name for FCM topic
  const sanitizeRabbeName = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]/g, "_")
  }

  // Get the topics that will be sent to based on current form state
  const getTopics = (): string[] => {
    switch (notificationType) {
      case "new_shiur":
        if (selectedRebbe) {
          const rebbe = rebbeim.find((r) => r.id === selectedRebbe)
          if (rebbe) {
            return ["new_shiurim", `rebbe_${sanitizeRabbeName(rebbe.name)}`]
          }
        }
        return ["new_shiurim"]
      case "simcha":
        return ["simchas"]
      case "announcement":
        return ["announcements"]
      case "custom":
        return customTopic.trim() ? [customTopic.trim()] : []
      default:
        return []
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "new_shiur": return "New Shiur"
      case "simcha": return "Simcha / Mazel Tov"
      case "announcement": return "Announcement"
      case "custom": return "Custom"
      default: return type
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const topics = getTopics()

    if (!title.trim() || !body.trim()) {
      toast({ title: "Title and message are required", variant: "destructive" })
      return
    }

    if (topics.length === 0) {
      toast({ title: "Please select a valid topic", variant: "destructive" })
      return
    }

    if (notificationType === "new_shiur" && !selectedRebbe) {
      toast({ title: "Please select a Rebbe", variant: "destructive" })
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          topics,
          type: notificationType,
          platform,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to send notification")
      }

      const audienceLabel =
        platform === "all" ? "all platforms" : `${platform} users only`
      toast({
        title: "Notification Sent",
        description: `Sent to ${topics.join(", ")} (${audienceLabel})`,
      })

      // Reset form
      setTitle("")
      setBody("")
      setSelectedRebbe("")
      setCustomTopic("")
      setPlatform("all")

      // Refresh history
      fetchHistory()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send notification",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const topics = getTopics()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-bold text-navy mb-1">Push Notifications</h1>
        <p className="text-navy/70">
          Send push notifications to subscribed users on Android, iOS, and web
        </p>
      </div>

      {/* Notification Composer */}
      <Card className="border-gold/20 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-navy flex items-center gap-2">
            <Bell className="h-5 w-5 text-gold" />
            Compose Notification
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Notification Type */}
            <div className="space-y-2">
              <Label>Notification Type</Label>
              <Select value={notificationType} onValueChange={(v) => {
                setNotificationType(v)
                setSelectedRebbe("")
                setCustomTopic("")
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new_shiur">New Shiur</SelectItem>
                  <SelectItem value="simcha">Simcha / Mazel Tov</SelectItem>
                  <SelectItem value="announcement">Announcement</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Audience / Platform filter */}
            <div className="space-y-2">
              <Label>Audience</Label>
              <Select
                value={platform}
                onValueChange={(v) => setPlatform(v as typeof platform)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms (default)</SelectItem>
                  <SelectItem value="android">Android Only</SelectItem>
                  <SelectItem value="ios">iOS Only</SelectItem>
                  <SelectItem value="web">Web Only</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-navy/50">
                {platform === "all"
                  ? "Delivers to every device subscribed to the topic, regardless of platform."
                  : `Only devices on ${platform} that are subscribed to the topic will receive this.`}
              </p>
            </div>

            {/* Rebbe selector for New Shiur */}
            {notificationType === "new_shiur" && (
              <div className="space-y-2">
                <Label>Select Rebbe *</Label>
                <Select value={selectedRebbe} onValueChange={setSelectedRebbe}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a Rebbe..." />
                  </SelectTrigger>
                  <SelectContent>
                    {rebbeim.map((rebbe) => (
                      <SelectItem key={rebbe.id} value={rebbe.id}>
                        {rebbe.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedRebbe && (
                  <p className="text-xs text-navy/50">
                    Will send to: <span className="font-mono">new_shiurim</span> + <span className="font-mono">rebbe_{sanitizeRabbeName(rebbeim.find(r => r.id === selectedRebbe)?.name || "")}</span>
                  </p>
                )}
              </div>
            )}

            {/* Custom topic input */}
            {notificationType === "custom" && (
              <div className="space-y-2">
                <Label>Custom Topic *</Label>
                <Input
                  placeholder="e.g., all_users, events"
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                />
                <p className="text-xs text-navy/50">
                  Available topics: all_users, announcements, new_shiurim, simchas, events, rebbe_{"<name>"}
                </p>
              </div>
            )}

            {/* Title */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Title *</Label>
                <span className={`text-xs ${title.length > titleMaxLength ? "text-red-600" : "text-navy/50"}`}>
                  {title.length}/{titleMaxLength}
                </span>
              </div>
              <Input
                placeholder="e.g., New Shiur Available"
                maxLength={titleMaxLength}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Body */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Message *</Label>
                <span className={`text-xs ${body.length > bodyMaxLength ? "text-red-600" : "text-navy/50"}`}>
                  {body.length}/{bodyMaxLength}
                </span>
              </div>
              <Textarea
                placeholder="e.g., Rabbi Cohen's latest shiur on Parshas Vayechi is now available"
                maxLength={bodyMaxLength}
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>

            {/* iOS Preview */}
            <div className="space-y-2">
              <Label className="text-navy/70 text-xs uppercase tracking-wide">iOS Preview</Label>
              <div className="bg-[#f2f2f7] rounded-2xl p-3">
                <div className="bg-white rounded-xl p-3 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-navy flex items-center justify-center flex-shrink-0">
                      <Bell className="h-4 w-4 text-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-[13px] text-black">
                          Toras Chaim Shiurim
                        </p>
                        <span className="text-[11px] text-gray-400">now</span>
                      </div>
                      <p className="font-semibold text-[13px] text-black mt-0.5">
                        {title || "Notification Title"}
                      </p>
                      <p className="text-[13px] text-gray-600 line-clamp-2">
                        {body || "Notification message will appear here..."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Topic info */}
            {topics.length > 0 && (
              <div className="bg-navy/5 rounded-lg px-4 py-3 space-y-1">
                <p className="text-sm text-navy/70">
                  Sending to:{" "}
                  {topics.map((t) => (
                    <span
                      key={t}
                      className="inline-block font-mono text-xs bg-navy/10 rounded px-1.5 py-0.5 mx-0.5"
                    >
                      {t}
                    </span>
                  ))}
                </p>
                <p className="text-sm text-navy/70">
                  Audience:{" "}
                  <span
                    className={`inline-block font-mono text-xs rounded px-1.5 py-0.5 ${
                      platform === "all"
                        ? "bg-navy/10 text-navy"
                        : "bg-gold/20 text-navy font-semibold"
                    }`}
                  >
                    {platform === "all" ? "all platforms" : `platform_${platform}`}
                  </span>
                </p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || !title.trim() || !body.trim() || topics.length === 0}
              className="w-full bg-navy text-cream hover:bg-navy/90"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Notification
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Notification History */}
      <Card className="border-gold/20 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-navy flex items-center gap-2">
            <History className="h-5 w-5 text-gold" />
            Notification History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-navy/50" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="mx-auto h-10 w-10 text-navy/20 mb-3" />
              <p className="text-navy/50 text-sm">No notifications sent yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gold/20">
                    <th className="text-left py-3 px-3 text-navy/70 font-medium">Date</th>
                    <th className="text-left py-3 px-3 text-navy/70 font-medium">Type</th>
                    <th className="text-left py-3 px-3 text-navy/70 font-medium">Audience</th>
                    <th className="text-left py-3 px-3 text-navy/70 font-medium">Topic(s)</th>
                    <th className="text-left py-3 px-3 text-navy/70 font-medium">Title</th>
                    <th className="text-left py-3 px-3 text-navy/70 font-medium">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((record) => (
                    <tr key={record.id} className="border-b border-navy/5 hover:bg-navy/[0.02]">
                      <td className="py-3 px-3 text-navy/60 whitespace-nowrap">
                        {new Date(record.sentAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-block text-xs px-2 py-0.5 rounded bg-navy/10 text-navy font-medium">
                          {getTypeLabel(record.type)}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block text-xs px-2 py-0.5 rounded font-medium ${
                            record.platform === "all" || !record.platform
                              ? "bg-navy/5 text-navy/60"
                              : "bg-gold/15 text-navy"
                          }`}
                        >
                          {record.platform === "all" || !record.platform
                            ? "All"
                            : record.platform.charAt(0).toUpperCase() +
                              record.platform.slice(1)}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1">
                          {record.topics.map((t) => (
                            <span key={t} className="inline-block font-mono text-xs bg-gold/10 text-gold rounded px-1.5 py-0.5">
                              {t}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-navy font-medium max-w-[160px] truncate">{record.title}</td>
                      <td className="py-3 px-3 text-navy/60 max-w-[200px] truncate">{record.body}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
