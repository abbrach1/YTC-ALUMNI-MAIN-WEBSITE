"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { doc, getDoc, setDoc, collection, getDocs, query, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { ChevronUp, ChevronDown, X, Plus, Search, Sparkles } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { computeTimerFields, formatExpiryCountdown } from "@/lib/expiry"

const MAX_FEATURED_SHIURIM = 5

interface Shiur {
  id: string
  title: string
  rebbe: string
  date: string
  tags?: string[]
  series?: string
}

const ALL = "__all__"

export default function SettingsPage() {
  const [formData, setFormData] = useState({
    rebbe: "",
    title: "",
    date: "",
    time: "",
    zoomLink: "",
    description: "",
  })
  const [featuredShiur, setFeaturedShiur] = useState<{ enabled: boolean; shiurIds: string[] }>({
    enabled: false,
    shiurIds: [],
  })
  const [systemAnnouncement, setSystemAnnouncement] = useState({
    enabled: false,
    title: "",
    message: "",
    linkUrl: "",
    linkText: "",
    hideAfterDays: "" as string,
    timerStartAt: null as string | null,
  })
  const [systemLoading, setSystemLoading] = useState(false)
  const [officePins, setOfficePins] = useState<{ name: string; pin: string }[]>([])
  const [newPinName, setNewPinName] = useState("")
  const [newPin, setNewPin] = useState("")
  const [shiurim, setShiurim] = useState<Shiur[]>([])
  const [loading, setLoading] = useState(false)
  const [featuredLoading, setFeaturedLoading] = useState(false)
  const [pinLoading, setPinLoading] = useState(false)
  const [pickerSearch, setPickerSearch] = useState("")
  const [pickerRebbe, setPickerRebbe] = useState(ALL)
  const [pickerTag, setPickerTag] = useState(ALL)
  const [pickerSeries, setPickerSeries] = useState(ALL)
  const { toast } = useToast()

  const rebbeOptions = Array.from(new Set(shiurim.map((s) => s.rebbe).filter(Boolean))).sort()
  const tagOptions = Array.from(new Set(shiurim.flatMap((s) => s.tags || []).filter(Boolean))).sort()
  const seriesOptions = Array.from(new Set(shiurim.map((s) => s.series).filter((x): x is string => !!x))).sort()

  const filteredCandidates = shiurim.filter((s) => {
    if (featuredShiur.shiurIds.includes(s.id)) return false
    if (pickerRebbe !== ALL && s.rebbe !== pickerRebbe) return false
    if (pickerTag !== ALL && !(s.tags || []).includes(pickerTag)) return false
    if (pickerSeries !== ALL && (s.series || "") !== pickerSeries) return false
    if (pickerSearch.trim()) {
      const q = pickerSearch.trim().toLowerCase()
      if (!s.title.toLowerCase().includes(q) && !s.rebbe.toLowerCase().includes(q)) return false
    }
    return true
  })

  const filtersActive =
    pickerSearch.trim() !== "" || pickerRebbe !== ALL || pickerTag !== ALL || pickerSeries !== ALL

  const clearFilters = () => {
    setPickerSearch("")
    setPickerRebbe(ALL)
    setPickerTag(ALL)
    setPickerSeries(ALL)
  }

  const addFeatured = (id: string) => {
    if (featuredShiur.shiurIds.includes(id)) return
    if (featuredShiur.shiurIds.length >= MAX_FEATURED_SHIURIM) return
    setFeaturedShiur({ ...featuredShiur, shiurIds: [...featuredShiur.shiurIds, id] })
  }

  useEffect(() => {
    fetchUpcomingShiur()
    fetchFeaturedShiur()
    fetchShiurim()
    fetchOfficePin()
    fetchSystemAnnouncement()
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
      })
    }
  }

  const fetchFeaturedShiur = async () => {
    const docRef = doc(db, "settings", "featuredShiur")
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) {
      const data = docSnap.data()
      // Legacy single shiurId migrates to a one-item array
      const shiurIds: string[] = Array.isArray(data.shiurIds)
        ? data.shiurIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
        : data.shiurId
        ? [data.shiurId]
        : []
      setFeaturedShiur({
        enabled: data.enabled || false,
        shiurIds,
      })
    }
  }

  const fetchSystemAnnouncement = async () => {
    const docSnap = await getDoc(doc(db, "settings", "systemAnnouncement"))
    if (docSnap.exists()) {
      const data = docSnap.data()
      setSystemAnnouncement({
        enabled: !!data.enabled,
        title: data.title || "",
        message: data.message || "",
        linkUrl: data.linkUrl || "",
        linkText: data.linkText || "",
        hideAfterDays: data.hideAfterDays ? String(data.hideAfterDays) : "",
        timerStartAt: data.timerStartAt || null,
      })
    }
  }

  const handleSystemAnnouncementSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSystemLoading(true)
    try {
      const parsedDays = systemAnnouncement.hideAfterDays ? Number(systemAnnouncement.hideAfterDays) : null
      const timer = computeTimerFields(parsedDays, {
        hideAfterDays: systemAnnouncement.hideAfterDays ? Number(systemAnnouncement.hideAfterDays) : null,
        timerStartAt: systemAnnouncement.timerStartAt,
      })
      await setDoc(doc(db, "settings", "systemAnnouncement"), {
        enabled: systemAnnouncement.enabled,
        title: systemAnnouncement.title.trim(),
        message: systemAnnouncement.message.trim(),
        linkUrl: systemAnnouncement.linkUrl.trim(),
        linkText: systemAnnouncement.linkText.trim(),
        hideAfterDays: timer.hideAfterDays,
        timerStartAt: timer.timerStartAt,
      })
      setSystemAnnouncement((s) => ({
        ...s,
        timerStartAt: timer.timerStartAt,
        hideAfterDays: timer.hideAfterDays ? String(timer.hideAfterDays) : "",
      }))
      toast({ title: "System announcement saved" })
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setSystemLoading(false)
    }
  }

  const fetchOfficePin = async () => {
    const docRef = doc(db, "settings", "officePins")
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) {
      setOfficePins(docSnap.data().pins || [])
    }
  }

  const fetchShiurim = async () => {
    const shiurimRef = collection(db, "shiurim")
    const q = query(shiurimRef, orderBy("date", "desc"))
    const querySnapshot = await getDocs(q)
    const shiurimData: Shiur[] = []
    querySnapshot.forEach((doc) => {
      const data = doc.data()
      shiurimData.push({
        id: doc.id,
        title: data.title,
        rebbe: data.rebbe,
        date: data.date,
        tags: Array.isArray(data.tags) ? data.tags : [],
        series: data.series || undefined,
      })
    })
    setShiurim(shiurimData)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await setDoc(doc(db, "settings", "upcomingShiur"), formData)
      toast({ title: "Settings updated successfully" })
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleFeaturedSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFeaturedLoading(true)

    try {
      await setDoc(doc(db, "settings", "featuredShiur"), featuredShiur)
      toast({ title: "Featured shiur updated successfully" })
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setFeaturedLoading(false)
    }
  }

  const handleAddPin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate 4-digit PIN
    if (!/^\d{4}$/.test(newPin)) {
      toast({ 
        title: "Invalid PIN", 
        description: "PIN must be exactly 4 digits", 
        variant: "destructive" 
      })
      return
    }

    if (!newPinName.trim()) {
      toast({ 
        title: "Name required", 
        description: "Please enter a name for this PIN", 
        variant: "destructive" 
      })
      return
    }

    // Check for duplicate PINs
    if (officePins.some(p => p.pin === newPin)) {
      toast({ 
        title: "Duplicate PIN", 
        description: "This PIN already exists", 
        variant: "destructive" 
      })
      return
    }

    setPinLoading(true)

    try {
      const updatedPins = [...officePins, { name: newPinName.trim(), pin: newPin }]
      await setDoc(doc(db, "settings", "officePins"), { pins: updatedPins })
      setOfficePins(updatedPins)
      setNewPinName("")
      setNewPin("")
      toast({ title: "Office PIN added successfully" })
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setPinLoading(false)
    }
  }

  const handleDeletePin = async (pinToDelete: string) => {
    setPinLoading(true)
    try {
      const updatedPins = officePins.filter(p => p.pin !== pinToDelete)
      await setDoc(doc(db, "settings", "officePins"), { pins: updatedPins })
      setOfficePins(updatedPins)
      toast({ title: "PIN deleted successfully" })
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setPinLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-navy mb-2">Settings</h1>
        <p className="text-navy/70">Manage site-wide settings and upcoming shiur</p>
      </div>

      <Card className="border-gold/20 bg-white shadow-lg">
        <CardHeader>
          <CardTitle className="text-navy">Upcoming Shiur (Home Page)</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Shiur Title *</Label>
              <Input
                id="title"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rebbe">Rebbe *</Label>
                <Input
                  id="rebbe"
                  required
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
                <Label htmlFor="zoomLink">Zoom Link *</Label>
                <Input
                  id="zoomLink"
                  type="url"
                  required
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

            <Button type="submit" disabled={loading} className="w-full bg-navy text-cream hover:bg-navy/90">
              {loading ? "Saving..." : "Save Settings"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-gold/20 bg-white shadow-lg">
        <CardHeader>
          <CardTitle className="text-navy">Featured Shiurim (Home Page)</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleFeaturedSubmit} className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="featured-enabled">Enable Featured Shiurim</Label>
                <p className="text-sm text-muted-foreground">
                  Pick up to {MAX_FEATURED_SHIURIM} shiurim to display prominently on the home page
                </p>
              </div>
              <Switch
                id="featured-enabled"
                checked={featuredShiur.enabled}
                onCheckedChange={(checked) => setFeaturedShiur({ ...featuredShiur, enabled: checked })}
              />
            </div>

            {featuredShiur.enabled && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Featured Shiurim (in display order)</Label>
                  <span className="text-xs text-navy/50">
                    {featuredShiur.shiurIds.length} / {MAX_FEATURED_SHIURIM}
                  </span>
                </div>

                {featuredShiur.shiurIds.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No shiurim selected. Pick one below to feature it on the home page.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {featuredShiur.shiurIds.map((id, idx) => {
                      const shiur = shiurim.find((s) => s.id === id)
                      const isFirst = idx === 0
                      const isLast = idx === featuredShiur.shiurIds.length - 1
                      return (
                        <div
                          key={id}
                          className="flex items-center justify-between p-3 bg-cream/50 rounded-lg border border-navy/10"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-navy truncate">
                              {idx + 1}. {shiur ? shiur.title : "(shiur no longer exists)"}
                            </p>
                            {shiur && (
                              <p className="text-xs text-navy/60 truncate">
                                {shiur.rebbe} · {new Date(shiur.date).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={isFirst}
                              onClick={() => {
                                const next = [...featuredShiur.shiurIds]
                                ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
                                setFeaturedShiur({ ...featuredShiur, shiurIds: next })
                              }}
                              aria-label="Move up"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={isLast}
                              onClick={() => {
                                const next = [...featuredShiur.shiurIds]
                                ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
                                setFeaturedShiur({ ...featuredShiur, shiurIds: next })
                              }}
                              aria-label="Move down"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setFeaturedShiur({
                                  ...featuredShiur,
                                  shiurIds: featuredShiur.shiurIds.filter((x) => x !== id),
                                })
                              }}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              aria-label="Remove"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {featuredShiur.shiurIds.length < MAX_FEATURED_SHIURIM ? (
                  <div className="space-y-3 pt-3 border-t border-navy/10">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-sm">Add more shiurim</Label>
                      {filtersActive && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={clearFilters}
                          className="h-7 text-xs"
                        >
                          Clear filters
                        </Button>
                      )}
                    </div>

                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy/40 pointer-events-none" />
                      <Input
                        placeholder="Search by title or rebbe..."
                        value={pickerSearch}
                        onChange={(e) => setPickerSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>

                    <div className="grid gap-2 sm:grid-cols-3">
                      <Select value={pickerRebbe} onValueChange={setPickerRebbe}>
                        <SelectTrigger>
                          <SelectValue placeholder="Rebbe" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ALL}>All rebbeim</SelectItem>
                          {rebbeOptions.map((r) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={pickerTag} onValueChange={setPickerTag}>
                        <SelectTrigger>
                          <SelectValue placeholder="Tag" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ALL}>All tags</SelectItem>
                          {tagOptions.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={pickerSeries} onValueChange={setPickerSeries}>
                        <SelectTrigger>
                          <SelectValue placeholder="Series" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ALL}>All series</SelectItem>
                          {seriesOptions.map((sr) => (
                            <SelectItem key={sr} value={sr}>{sr}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <ScrollArea className="h-64 rounded-md border border-navy/10 bg-cream/30">
                      {filteredCandidates.length === 0 ? (
                        <div className="p-6 text-center text-sm text-navy/50">
                          {filtersActive
                            ? "No shiurim match these filters."
                            : "No more shiurim available to add."}
                        </div>
                      ) : (
                        <ul className="divide-y divide-navy/5">
                          {filteredCandidates.map((s) => (
                            <li
                              key={s.id}
                              className="flex items-center justify-between p-3 hover:bg-cream/60"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-navy truncate">{s.title}</p>
                                <p className="text-xs text-navy/60 truncate">
                                  {s.rebbe}
                                  {s.date && ` · ${new Date(s.date).toLocaleDateString()}`}
                                  {s.series && ` · ${s.series}`}
                                </p>
                                {s.tags && s.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {s.tags.map((t) => (
                                      <span
                                        key={t}
                                        className="text-[10px] px-1.5 py-0.5 bg-gold/10 text-navy rounded"
                                      >
                                        {t}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => addFeatured(s.id)}
                                className="ml-2 shrink-0 border-gold/30"
                                aria-label={`Add ${s.title}`}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </ScrollArea>

                    <p className="text-xs text-navy/50">
                      Showing {filteredCandidates.length} of{" "}
                      {shiurim.length - featuredShiur.shiurIds.length} available shiurim.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-navy/50">
                    Maximum of {MAX_FEATURED_SHIURIM} featured shiurim reached. Remove one to add another.
                  </p>
                )}
              </div>
            )}

            <Button type="submit" disabled={featuredLoading} className="w-full bg-navy text-cream hover:bg-navy/90">
              {featuredLoading ? "Saving..." : "Save Featured Shiurim"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-gold/20 bg-white shadow-lg">
        <CardHeader>
          <CardTitle className="text-navy flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-gold" />
            System Announcement (Home Page Banner)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Show a prominent banner at the top of the home page (above Mazel Tovs & Announcements).
            Use for new features, site updates, etc.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSystemAnnouncementSubmit} className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="sysann-enabled">Show banner on home page</Label>
                <p className="text-sm text-muted-foreground">Toggle visibility without losing content</p>
              </div>
              <Switch
                id="sysann-enabled"
                checked={systemAnnouncement.enabled}
                onCheckedChange={(checked) => setSystemAnnouncement({ ...systemAnnouncement, enabled: checked })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sysann-title">Title (optional)</Label>
              <Input
                id="sysann-title"
                placeholder="e.g., What's New"
                value={systemAnnouncement.title}
                onChange={(e) => setSystemAnnouncement({ ...systemAnnouncement, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sysann-message">Message *</Label>
              <Textarea
                id="sysann-message"
                rows={3}
                placeholder="e.g., You can now upload shiurim in bulk — check out the new Upload page."
                value={systemAnnouncement.message}
                onChange={(e) => setSystemAnnouncement({ ...systemAnnouncement, message: e.target.value })}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sysann-link">Link URL (optional)</Label>
                <Input
                  id="sysann-link"
                  type="url"
                  placeholder="https://..."
                  value={systemAnnouncement.linkUrl}
                  onChange={(e) => setSystemAnnouncement({ ...systemAnnouncement, linkUrl: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sysann-link-text">Link Button Text</Label>
                <Input
                  id="sysann-link-text"
                  placeholder="Learn more"
                  value={systemAnnouncement.linkText}
                  onChange={(e) => setSystemAnnouncement({ ...systemAnnouncement, linkText: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sysann-hideAfter">Auto-hide after (days, optional)</Label>
              <Input
                id="sysann-hideAfter"
                type="number"
                min={1}
                placeholder="Leave blank to never auto-hide"
                value={systemAnnouncement.hideAfterDays}
                onChange={(e) => setSystemAnnouncement({ ...systemAnnouncement, hideAfterDays: e.target.value })}
              />
              {(() => {
                const countdown = formatExpiryCountdown({
                  hideAfterDays: systemAnnouncement.hideAfterDays ? Number(systemAnnouncement.hideAfterDays) : null,
                  timerStartAt: systemAnnouncement.timerStartAt,
                })
                return countdown ? (
                  <p className="text-xs text-navy/60">
                    Banner {countdown}.
                    {systemAnnouncement.timerStartAt
                      ? ` Timer started ${new Date(systemAnnouncement.timerStartAt).toLocaleDateString()}.`
                      : ""}
                  </p>
                ) : (
                  <p className="text-xs text-navy/50">Banner stays until you turn it off or clear it.</p>
                )
              })()}
            </div>

            <Button type="submit" disabled={systemLoading} className="w-full bg-navy text-cream hover:bg-navy/90">
              {systemLoading ? "Saving..." : "Save System Announcement"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-gold/20 bg-white shadow-lg">
        <CardHeader>
          <CardTitle className="text-navy">Office Portal Access</CardTitle>
          <p className="text-sm text-muted-foreground">
            Manage multiple PINs for different office staff members to access the /office portal
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleAddPin} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pin-name">Name/Label</Label>
                <Input
                  id="pin-name"
                  type="text"
                  placeholder="e.g., Sarah - Secretary"
                  value={newPinName}
                  onChange={(e) => setNewPinName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-pin">4-Digit PIN</Label>
                <Input
                  id="new-pin"
                  type="text"
                  maxLength={4}
                  pattern="\d{4}"
                  placeholder="Enter 4-digit PIN"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                />
              </div>
            </div>

            <Button type="submit" disabled={pinLoading} className="w-full bg-navy text-cream hover:bg-navy/90">
              {pinLoading ? "Adding..." : "Add Office PIN"}
            </Button>
          </form>

          {officePins.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-navy/10">
              <h4 className="font-semibold text-navy">Active PINs ({officePins.length})</h4>
              {officePins.map((pinData) => (
                <div
                  key={pinData.pin}
                  className="flex items-center justify-between p-3 bg-cream/50 rounded-lg border border-navy/10"
                >
                  <div>
                    <p className="font-medium text-navy">{pinData.name}</p>
                    <p className="text-sm text-navy/50">PIN: {"•".repeat(4)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeletePin(pinData.pin)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
