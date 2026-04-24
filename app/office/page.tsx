"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { collection, addDoc, doc, getDoc, getDocs, setDoc, deleteDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { uploadToB2 } from "@/lib/b2-upload"
import { useToast } from "@/hooks/use-toast"
import { CalendarDays, PartyPopper, Lock, Megaphone, Plus, Pencil, Trash2 } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export default function OfficePortalPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [pinInput, setPinInput] = useState("")
  const [pinError, setPinError] = useState("")
  const [loading, setLoading] = useState(false)
  
  const [eventForm, setEventForm] = useState({
    eventName: "",
    personFamily: "",
    type: "Wedding",
    date: "",
    location: "",
    description: "",
  })
  const [simchaForm, setSimchaForm] = useState({
    fullName: "",
    simchaType: "Bar Mitzvah",
    date: "",
    connection: "",
    message: "",
  })
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<any>(null)
  const [announcementForm, setAnnouncementForm] = useState({
    title: "",
    content: "",
    type: "announcement" as "mazel_tov" | "announcement",
    date: new Date().toISOString().split("T")[0],
    enabled: true,
  })
  
  const [eventImageFile, setEventImageFile] = useState<File | null>(null)
  const [simchaImageFile, setSimchaImageFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  
  const { toast } = useToast()

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPinError("")
    setLoading(true)

    try {
      const docRef = doc(db, "settings", "officePins")
      const docSnap = await getDoc(docRef)
      
      if (!docSnap.exists()) {
        setPinError("Office portal is not configured. Please contact admin.")
        setLoading(false)
        return
      }

      const pins = docSnap.data().pins || []

      if (pins.some((p: { name: string; pin: string }) => p.pin === pinInput)) {
        setIsAuthenticated(true)
        sessionStorage.setItem("office-auth", "true")
        toast({ title: "Access granted" })
      } else {
        setPinError("Incorrect PIN. Please try again.")
      }
    } catch (error: any) {
      setPinError("Error verifying PIN. Please try again.")
    } finally {
      setLoading(false)
      setPinInput("")
    }
  }

  useEffect(() => {
    // Check if already authenticated in this session
    const auth = sessionStorage.getItem("office-auth")
    if (auth === "true") {
      setIsAuthenticated(true)
    }
  }, [])

  const handleEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setUploadProgress(0)

    try {
      let imageUrl = ""

      if (eventImageFile) {
        imageUrl = await uploadToB2(eventImageFile, "events/images", (progress) => {
          setUploadProgress(progress)
        })
      }

      await addDoc(collection(db, "events"), {
        ...eventForm,
        imageUrl,
        submittedBy: "office",
        createdAt: new Date().toISOString(),
      })

      toast({ title: "Event submitted successfully!" })
      
      // Reset form
      setEventForm({
        eventName: "",
        personFamily: "",
        type: "Wedding",
        date: "",
        location: "",
        description: "",
      })
      setEventImageFile(null)
      setUploadProgress(0)
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const handleSimchaSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setUploadProgress(0)

    try {
      let imageUrl = ""

      if (simchaImageFile) {
        imageUrl = await uploadToB2(simchaImageFile, "simchas/images", (progress) => {
          setUploadProgress(progress)
        })
      }

      await addDoc(collection(db, "simchaSubmissions"), {
        ...simchaForm,
        imageUrl,
        submittedBy: "office",
        status: "approved",
        createdAt: new Date().toISOString(),
      })

      toast({ title: "Mazel Tov! Simcha submitted successfully!" })
      
      // Reset form
      setSimchaForm({
        fullName: "",
        simchaType: "Bar Mitzvah",
        date: "",
        connection: "",
        message: "",
      })
      setSimchaImageFile(null)
      setUploadProgress(0)
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const fetchAnnouncements = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "announcements"))
      const items: any[] = []
      querySnapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() })
      })
      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setAnnouncements(items)
    } catch (error) {
      console.error("Error fetching announcements:", error)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetchAnnouncements()
    }
  }, [isAuthenticated])

  const openAddAnnouncementDialog = () => {
    setEditingAnnouncement(null)
    setAnnouncementForm({
      title: "",
      content: "",
      type: "announcement",
      date: new Date().toISOString().split("T")[0],
      enabled: true,
    })
    setShowAnnouncementDialog(true)
  }

  const openEditAnnouncementDialog = (item: any) => {
    setEditingAnnouncement(item)
    setAnnouncementForm({
      title: item.title,
      content: item.content,
      type: item.type,
      date: item.date,
      enabled: item.enabled,
    })
    setShowAnnouncementDialog(true)
  }

  const handleAnnouncementSave = async () => {
    if (!announcementForm.title || !announcementForm.content) {
      toast({ title: "Please fill in all required fields", variant: "destructive" })
      return
    }

    setSubmitting(true)
    try {
      const id = editingAnnouncement?.id || `announcement_${Date.now()}`
      await setDoc(doc(db, "announcements", id), {
        ...announcementForm,
        updatedAt: new Date().toISOString(),
      })
      toast({ title: editingAnnouncement ? "Announcement updated" : "Announcement added" })
      setShowAnnouncementDialog(false)
      fetchAnnouncements()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const handleAnnouncementDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this announcement?")) return

    try {
      await deleteDoc(doc(db, "announcements", id))
      toast({ title: "Announcement deleted" })
      fetchAnnouncements()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const toggleAnnouncementEnabled = async (item: any) => {
    try {
      await setDoc(doc(db, "announcements", item.id), {
        ...item,
        enabled: !item.enabled,
        updatedAt: new Date().toISOString(),
      })
      fetchAnnouncements()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    sessionStorage.removeItem("office-auth")
    toast({ title: "Logged out successfully" })
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-gold/20 bg-white shadow-lg">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-navy/10 rounded-full flex items-center justify-center">
                <Lock className="w-8 h-8 text-navy" />
              </div>
            </div>
            <CardTitle className="text-2xl font-serif text-navy">Office Portal</CardTitle>
            <p className="text-navy/70 text-sm">Enter your 4-digit PIN to access</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pin">PIN</Label>
                <Input
                  id="pin"
                  type="password"
                  maxLength={4}
                  pattern="\d{4}"
                  placeholder="••••"
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value.replace(/\D/g, ""))
                    setPinError("")
                  }}
                  className="text-center text-2xl tracking-widest"
                  autoFocus
                />
                {pinError && <p className="text-sm text-red-600">{pinError}</p>}
              </div>

              <Button type="submit" disabled={loading || pinInput.length !== 4} className="w-full bg-navy text-cream">
                {loading ? "Verifying..." : "Access Portal"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold text-navy mb-2">Office Portal</h1>
            <p className="text-navy/70">Submit events and simchas to the website</p>
          </div>
          <Button variant="outline" onClick={handleLogout} className="border-navy text-navy">
            Logout
          </Button>
        </div>

        <Tabs defaultValue="announcements" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="announcements" className="flex items-center gap-2">
              <Megaphone className="w-4 h-4" />
              Announcements
            </TabsTrigger>
            <TabsTrigger value="events" className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4" />
              Events/Simchas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="announcements">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-serif text-2xl font-bold text-navy mb-1">Mazel Tovs & Announcements</h2>
                  <p className="text-navy/70">Manage announcements displayed on the home page</p>
                </div>
                <Button onClick={openAddAnnouncementDialog} className="bg-gold text-navy hover:bg-gold/90">
                  <Plus className="mr-2 h-4 w-4" />
                  Add New
                </Button>
              </div>

              {announcements.length === 0 ? (
                <Card className="border-gold/20">
                  <CardContent className="py-12 text-center">
                    <Megaphone className="mx-auto h-12 w-12 text-navy/30 mb-4" />
                    <p className="text-navy/70">No announcements yet</p>
                    <Button onClick={openAddAnnouncementDialog} className="mt-4 bg-gold text-navy hover:bg-gold/90">
                      Add Your First Announcement
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {announcements.map((item) => (
                    <Card key={item.id} className={`border-gold/20 ${!item.enabled ? "opacity-60" : ""}`}>
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            {item.type === "mazel_tov" ? (
                              <PartyPopper className="h-5 w-5 text-gold flex-shrink-0 mt-1" />
                            ) : (
                              <Megaphone className="h-5 w-5 text-navy flex-shrink-0 mt-1" />
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-serif font-semibold text-navy">{item.title}</h3>
                                <span
                                  className={`text-xs px-2 py-0.5 rounded ${
                                    item.type === "mazel_tov" ? "bg-gold/20 text-gold" : "bg-navy/10 text-navy"
                                  }`}
                                >
                                  {item.type === "mazel_tov" ? "Mazel Tov" : "Announcement"}
                                </span>
                                {!item.enabled && (
                                  <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">Hidden</span>
                                )}
                              </div>
                              <p className="text-sm text-navy/60 mt-0.5">
                                {new Date(item.date).toLocaleDateString("en-US", {
                                  month: "long",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </p>
                              <p className="text-navy/80 mt-2 text-sm">{item.content}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch checked={item.enabled} onCheckedChange={() => toggleAnnouncementEnabled(item)} />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditAnnouncementDialog(item)}
                              className="text-navy/60 hover:text-navy"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleAnnouncementDelete(item.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              <Dialog open={showAnnouncementDialog} onOpenChange={setShowAnnouncementDialog}>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle className="text-navy">
                      {editingAnnouncement ? "Edit Announcement" : "Add Announcement"}
                    </DialogTitle>
                    <DialogDescription>
                      {editingAnnouncement ? "Update the announcement details" : "Create a new announcement for the home page"}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="type">Type</Label>
                      <Select
                        value={announcementForm.type}
                        onValueChange={(value: "mazel_tov" | "announcement") =>
                          setAnnouncementForm({ ...announcementForm, type: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mazel_tov">
                            <span className="flex items-center gap-2">
                              <PartyPopper className="h-4 w-4 text-gold" />
                              Mazel Tov
                            </span>
                          </SelectItem>
                          <SelectItem value="announcement">
                            <span className="flex items-center gap-2">
                              <Megaphone className="h-4 w-4 text-navy" />
                              Announcement
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="title">Title *</Label>
                      <Input
                        id="title"
                        placeholder={
                          announcementForm.type === "mazel_tov"
                            ? "e.g., Mazel Tov to the Cohen Family!"
                            : "e.g., New Shiur Series Starting"
                        }
                        value={announcementForm.title}
                        onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="content">Content *</Label>
                      <Textarea
                        id="content"
                        rows={4}
                        placeholder={
                          announcementForm.type === "mazel_tov"
                            ? "e.g., Mazel Tov to Rabbi & Mrs. Cohen on the birth of their son!"
                            : "e.g., We're excited to announce a new weekly shiur series..."
                        }
                        value={announcementForm.content}
                        onChange={(e) => setAnnouncementForm({ ...announcementForm, content: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="date">Date</Label>
                      <Input
                        id="date"
                        type="date"
                        value={announcementForm.date}
                        onChange={(e) => setAnnouncementForm({ ...announcementForm, date: e.target.value })}
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-navy/5 rounded-lg">
                      <div>
                        <Label htmlFor="enabled" className="text-navy font-medium">
                          Show on Home Page
                        </Label>
                        <p className="text-sm text-navy/60">Toggle visibility</p>
                      </div>
                      <Switch
                        id="enabled"
                        checked={announcementForm.enabled}
                        onCheckedChange={(checked) => setAnnouncementForm({ ...announcementForm, enabled: checked })}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setShowAnnouncementDialog(false)} className="border-navy/20">
                      Cancel
                    </Button>
                    <Button onClick={handleAnnouncementSave} disabled={submitting} className="bg-navy text-cream hover:bg-navy/90">
                      {editingAnnouncement ? "Save Changes" : "Add Announcement"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </TabsContent>

          <TabsContent value="events">
            <Card className="border-gold/20 bg-white shadow-lg">
              <CardHeader>
                <CardTitle className="text-navy">Submit Event or Simcha</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Submit upcoming events and mazel tovs to display on the website
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleEventSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="eventName">Event Name *</Label>
                    <Input
                      id="eventName"
                      required
                      placeholder="e.g., Wedding, Bar Mitzvah, etc."
                      value={eventForm.eventName}
                      onChange={(e) => setEventForm({ ...eventForm, eventName: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="personFamily">Person/Family Name *</Label>
                    <Input
                      id="personFamily"
                      required
                      placeholder="e.g., Cohen Family"
                      value={eventForm.personFamily}
                      onChange={(e) => setEventForm({ ...eventForm, personFamily: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="eventType">Event Type *</Label>
                      <Select
                        value={eventForm.type}
                        onValueChange={(value) => setEventForm({ ...eventForm, type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Wedding">Wedding</SelectItem>
                          <SelectItem value="Bar Mitzvah">Bar Mitzvah</SelectItem>
                          <SelectItem value="Bat Mitzvah">Bat Mitzvah</SelectItem>
                          <SelectItem value="Engagement">Engagement</SelectItem>
                          <SelectItem value="Birth">Birth</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="eventDate">Date *</Label>
                      <Input
                        id="eventDate"
                        type="date"
                        required
                        value={eventForm.date}
                        onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="eventLocation">Location *</Label>
                    <Input
                      id="eventLocation"
                      required
                      placeholder="e.g., Main Hall, Shul Name"
                      value={eventForm.location}
                      onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="eventDescription">Description (Optional)</Label>
                    <Textarea
                      id="eventDescription"
                      rows={3}
                      placeholder="Additional details about the event..."
                      value={eventForm.description}
                      onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="eventImage">Event Image (Optional)</Label>
                    <Input
                      id="eventImage"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setEventImageFile(e.target.files?.[0] || null)}
                    />
                    {submitting && uploadProgress > 0 && (
                      <div>
                        <div className="h-2 bg-navy/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gold transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                        <p className="text-sm text-navy/60 mt-1">Uploading... {Math.round(uploadProgress)}%</p>
                      </div>
                    )}
                  </div>

                  <Button type="submit" disabled={submitting} className="w-full bg-navy text-cream">
                    {submitting ? "Submitting..." : "Submit Event"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>


        </Tabs>
      </div>
    </div>
  )
}
