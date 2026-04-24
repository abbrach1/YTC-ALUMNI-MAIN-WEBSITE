"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { Video, ExternalLink, Trash2, Send, Users, Mail } from "lucide-react"

function convertToEmbedUrl(url: string): string {
  if (!url) return url

  // Handle youtube.com/watch?v=VIDEO_ID format
  const watchMatch = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/)
  if (watchMatch) {
    return `https://www.youtube.com/embed/${watchMatch[1]}`
  }

  // Handle youtu.be/VIDEO_ID format
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/)
  if (shortMatch) {
    return `https://www.youtube.com/embed/${shortMatch[1]}`
  }

  // Handle youtube.com/live/VIDEO_ID format
  const liveMatch = url.match(/youtube\.com\/live\/([a-zA-Z0-9_-]+)/)
  if (liveMatch) {
    return `https://www.youtube.com/embed/${liveMatch[1]}`
  }

  // Already an embed URL or other format, return as-is
  return url
}

export default function UpcomingShiurPage() {
  const [formData, setFormData] = useState({
    rebbe: "",
    title: "",
    date: "",
    time: "",
    zoomLink: "",
    description: "",
    liveEmbedUrl: "",
  })
  const [isEnabled, setIsEnabled] = useState(true)
  const [isLive, setIsLive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [hasExisting, setHasExisting] = useState(false)
  const [subscriberCount, setSubscriberCount] = useState(0)
  const [sendingReminders, setSendingReminders] = useState(false)
  const [showEmailDialog, setShowEmailDialog] = useState(false)
  const [emailSubject, setEmailSubject] = useState("")
  const [emailMessage, setEmailMessage] = useState("")
  const [emailButtonText, setEmailButtonText] = useState("Join via Zoom")
  const { toast } = useToast()

  useEffect(() => {
    fetchUpcomingShiur()
    fetchSubscriberCount()
  }, [])

  const fetchUpcomingShiur = async () => {
    const docRef = doc(db, "settings", "upcomingShiur")
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) {
      const data = docSnap.data()
      setFormData({
        rebbe: data.rebbe || "",
        title: data.title || "",
        date: data.date || "",
        time: data.time || "",
        zoomLink: data.zoomLink || "",
        description: data.description || "",
        liveEmbedUrl: data.liveEmbedUrl || "",
      })
      setIsEnabled(data.enabled !== false)
      setIsLive(data.isLive || false)
      setHasExisting(true)
    }
  }

  const fetchSubscriberCount = async () => {
    const snapshot = await getDocs(collection(db, "shiurSubscribers"))
    setSubscriberCount(snapshot.size)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setLoading(true)

    try {
      await setDoc(doc(db, "settings", "upcomingShiur"), {
        ...formData,
        liveEmbedUrl: convertToEmbedUrl(formData.liveEmbedUrl),
        enabled: isEnabled,
        isLive: isLive,
        updatedAt: new Date().toISOString(),
      })
      setHasExisting(true)
      toast({ title: "Upcoming shiur updated successfully" })
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleSendReminders = async () => {
    setSendingReminders(true)
    try {
      const response = await fetch("/api/send-shiur-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customSubject: emailSubject,
          customMessage: emailMessage,
          customButtonText: emailButtonText,
        }),
      })
      const data = await response.json()

      if (response.ok) {
        toast({ title: `Reminders sent to ${data.sentTo} subscribers` })
        setShowEmailDialog(false)
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setSendingReminders(false)
    }
  }

  const handleClear = async () => {
    if (!confirm("Are you sure you want to remove the upcoming shiur from the home page?")) return

    setLoading(true)
    try {
      await deleteDoc(doc(db, "settings", "upcomingShiur"))
      setFormData({
        rebbe: "",
        title: "",
        date: "",
        time: "",
        zoomLink: "",
        description: "",
        liveEmbedUrl: "",
      })
      setHasExisting(false)
      setIsLive(false)
      toast({ title: "Upcoming shiur removed from home page" })
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const openEmailDialog = () => {
    setEmailSubject(`${formData.title} - Starting Soon!`)
    setEmailMessage(`The shiur "${formData.title}" by ${formData.rebbe} is starting soon! Join us at ${formData.time}.`)
    setEmailButtonText(formData.zoomLink ? "Join via Zoom" : "View Details")
    setShowEmailDialog(true)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-navy mb-2">Upcoming Shiur</h1>
        <p className="text-navy/70">Manage the featured shiur displayed on the home page</p>
      </div>

      <Card className="border-gold/20 bg-white shadow-lg">
        <CardHeader>
          <CardTitle className="text-navy flex items-center gap-2">
            <Users className="h-5 w-5 text-gold" />
            Email Subscribers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-navy">{subscriberCount}</p>
              <p className="text-navy/60 text-sm">people signed up for reminders</p>
            </div>
            <Button
              onClick={openEmailDialog}
              disabled={subscriberCount === 0 || !hasExisting}
              className="bg-gold text-navy hover:bg-gold/90"
            >
              <Mail className="mr-2 h-4 w-4" />
              Compose Reminder
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="text-navy">Customize Reminder Email</DialogTitle>
            <DialogDescription>Customize the email before sending to {subscriberCount} subscribers</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-navy/70">Quick Presets</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEmailSubject(`${formData.title} - Starting NOW!`)
                    setEmailMessage(`The shiur is starting RIGHT NOW! Join immediately.`)
                  }}
                  className="border-red-300 text-red-600 hover:bg-red-50"
                >
                  Starting Now
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEmailSubject(`${formData.title} - Starting in 15 Minutes!`)
                    setEmailMessage(
                      `The shiur "${formData.title}" by ${formData.rebbe} is starting in 15 minutes! Get ready to join.`,
                    )
                  }}
                  className="border-orange-300 text-orange-600 hover:bg-orange-50"
                >
                  15 Minutes
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEmailSubject(`${formData.title} - Starting in 1 Hour`)
                    setEmailMessage(
                      `Reminder: The shiur "${formData.title}" by ${formData.rebbe} begins in 1 hour at ${formData.time}.`,
                    )
                  }}
                  className="border-yellow-400 text-yellow-700 hover:bg-yellow-50"
                >
                  1 Hour
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEmailSubject(`Reminder: ${formData.title} - Tomorrow`)
                    setEmailMessage(
                      `Don't forget! The shiur "${formData.title}" by ${formData.rebbe} is tomorrow, ${formData.date} at ${formData.time}.`,
                    )
                  }}
                  className="border-blue-300 text-blue-600 hover:bg-blue-50"
                >
                  Tomorrow
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="emailSubject">Email Subject</Label>
              <Input
                id="emailSubject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Enter email subject..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emailMessage">Email Message</Label>
              <Textarea
                id="emailMessage"
                rows={4}
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                placeholder="Enter your custom message..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emailButtonText">Button Text</Label>
              <Input
                id="emailButtonText"
                value={emailButtonText}
                onChange={(e) => setEmailButtonText(e.target.value)}
                placeholder="e.g., Join via Zoom"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-navy/70">Preview</Label>
              <div className="border border-gold/20 rounded-lg p-4 bg-cream/50">
                <p className="text-sm font-medium text-navy mb-2">Subject: {emailSubject}</p>
                <div className="bg-white rounded p-3 border border-gold/10">
                  <h3 className="font-serif text-lg font-bold text-navy mb-1">{formData.title}</h3>
                  <p className="text-navy/70 text-sm mb-2">By {formData.rebbe}</p>
                  <p className="text-navy/80 text-sm mb-3">{emailMessage}</p>
                  <p className="text-sm text-navy/60 mb-2">
                    {formData.date} at {formData.time}
                  </p>
                  {formData.zoomLink && (
                    <span className="inline-block bg-navy text-cream px-4 py-2 rounded text-sm font-medium">
                      {emailButtonText}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowEmailDialog(false)} className="border-navy/20">
              Cancel
            </Button>
            <Button
              onClick={handleSendReminders}
              disabled={sendingReminders || !emailSubject || !emailMessage}
              className="bg-navy text-cream hover:bg-navy/90"
            >
              {sendingReminders ? "Sending..." : `Send to ${subscriberCount} Subscribers`}
              <Send className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {hasExisting && formData.title && (
        <Card className="border-gold/20 bg-gold/5 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-navy flex items-center gap-2">
                <Video className="h-5 w-5 text-gold" />
                Current Home Page Preview
              </CardTitle>
              <div className="flex gap-2">
                {isLive && (
                  <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 font-semibold animate-pulse">
                    LIVE
                  </span>
                )}
                <span
                  className={`text-xs px-2 py-1 rounded ${isEnabled ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                >
                  {isEnabled ? "Visible" : "Hidden"}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-white rounded-lg p-4 border border-gold/20">
              {isLive && formData.liveEmbedUrl && (
                <div className="mb-4 aspect-video rounded-lg overflow-hidden bg-black">
                  <iframe
                    src={convertToEmbedUrl(formData.liveEmbedUrl)}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}
              <h3 className="font-serif text-xl font-bold text-navy">{formData.title}</h3>
              <p className="text-navy/70">By {formData.rebbe}</p>
              <p className="text-sm text-navy/60 mt-2">
                {formData.date} at {formData.time}
              </p>
              {formData.description && <p className="text-navy/80 mt-2 text-sm">{formData.description}</p>}
              {formData.zoomLink && (
                <a
                  href={formData.zoomLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-gold hover:underline mt-2"
                >
                  <ExternalLink className="h-3 w-3" />
                  Zoom Link
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-gold/20 bg-white shadow-lg">
        <CardHeader>
          <CardTitle className="text-navy">Shiur Details</CardTitle>
          <CardDescription>
            This shiur will be prominently displayed on the home page for all alumni to see
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center justify-between p-4 bg-navy/5 rounded-lg">
                <div>
                  <Label htmlFor="enabled" className="text-navy font-medium">
                    Show on Home Page
                  </Label>
                  <p className="text-sm text-navy/60">Toggle visibility</p>
                </div>
                <Switch id="enabled" checked={isEnabled} onCheckedChange={setIsEnabled} />
              </div>

              <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
                <div>
                  <Label htmlFor="isLive" className="text-navy font-medium flex items-center gap-2">
                    <Video className="h-4 w-4 text-red-600" />
                    Live Mode
                  </Label>
                  <p className="text-sm text-navy/60">Show embedded live stream</p>
                </div>
                <Switch id="isLive" checked={isLive} onCheckedChange={setIsLive} />
              </div>
            </div>

            {isLive && (
              <div className="space-y-2 p-4 bg-red-50 rounded-lg border border-red-200">
                <Label htmlFor="liveEmbedUrl" className="text-navy font-medium">
                  Live Stream URL
                </Label>
                <Input
                  id="liveEmbedUrl"
                  placeholder="e.g., https://www.youtube.com/watch?v=VIDEO_ID"
                  value={formData.liveEmbedUrl}
                  onChange={(e) => setFormData({ ...formData, liveEmbedUrl: e.target.value })}
                />
                <p className="text-sm text-navy/60">
                  Paste any YouTube URL (watch, live, or short link) - it will be automatically converted to embed
                  format. For other services like Vimeo, use their embed URL directly.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="title">Shiur Title *</Label>
              <Input
                id="title"
                required
                placeholder="e.g., Weekly Parsha Shiur"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rebbe">Maggid Shiur *</Label>
                <Input
                  id="rebbe"
                  required
                  placeholder="e.g., Rabbi Moshe Cohen"
                  value={formData.rebbe}
                  onChange={(e) => setFormData({ ...formData, rebbe: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="time">Time *</Label>
                <Input
                  id="time"
                  required
                  placeholder="e.g., 8:00 PM EST"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  required
                  placeholder="e.g., Sunday, January 15, 2025"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="zoomLink">Zoom Link (Optional)</Label>
                <Input
                  id="zoomLink"
                  type="url"
                  placeholder="https://zoom.us/j/..."
                  value={formData.zoomLink}
                  onChange={(e) => setFormData({ ...formData, zoomLink: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                rows={3}
                placeholder="Brief description of the shiur topic..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={loading} className="flex-1 bg-navy text-cream hover:bg-navy/90">
                {loading ? "Saving..." : hasExisting ? "Update Shiur" : "Add Shiur"}
              </Button>

              {hasExisting && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClear}
                  disabled={loading}
                  className="border-red-300 text-red-600 hover:bg-red-50 bg-transparent"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
