"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { uploadToB2 } from "@/lib/b2-upload"
import { useToast } from "@/hooks/use-toast"
import { computeTimerFields, formatExpiryCountdown } from "@/lib/expiry"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Event {
  id: string
  eventName: string
  personFamily: string
  type: string
  date: string
  location: string
  imageUrl?: string
  description?: string
  hideAfterDays?: number | null
  timerStartAt?: string | null
}

interface SimchaSubmission {
  id: string
  fullName: string
  simchaType: string
  date: string
  connection?: string
  message?: string
  imageUrl?: string
  submittedBy: string
  status: string
}

export default function AdminEventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [submissions, setSubmissions] = useState<SimchaSubmission[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [formData, setFormData] = useState({
    eventName: "",
    personFamily: "",
    type: "",
    date: "",
    location: "",
    description: "",
    hideAfterDays: "" as string,
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const { toast } = useToast()

  useEffect(() => {
    fetchEvents()
    fetchSubmissions()
  }, [])

  const fetchEvents = async () => {
    const querySnapshot = await getDocs(collection(db, "events"))
    const eventsData: Event[] = []
    querySnapshot.forEach((doc) => {
      eventsData.push({ id: doc.id, ...doc.data() } as Event)
    })
    setEvents(eventsData)
  }

  const fetchSubmissions = async () => {
    const q = query(collection(db, "simchaSubmissions"), where("status", "==", "new"))
    const querySnapshot = await getDocs(q)
    const submissionsData: SimchaSubmission[] = []
    querySnapshot.forEach((doc) => {
      submissionsData.push({ id: doc.id, ...doc.data() } as SimchaSubmission)
    })
    setSubmissions(submissionsData)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setUploading(true)
    setUploadProgress(0)

    try {
      let imageUrl = editingEvent?.imageUrl || ""

      if (imageFile) {
        imageUrl = await uploadToB2(imageFile, "events/images", (progress) => {
          setUploadProgress(progress)
        })
      }

      const parsedDays = formData.hideAfterDays ? Number(formData.hideAfterDays) : null
      const timer = computeTimerFields(parsedDays, editingEvent)

      const eventData = {
        eventName: formData.eventName,
        personFamily: formData.personFamily,
        type: formData.type,
        date: formData.date,
        location: formData.location,
        description: formData.description,
        imageUrl,
        hideAfterDays: timer.hideAfterDays,
        timerStartAt: timer.timerStartAt,
      }

      if (editingEvent) {
        await updateDoc(doc(db, "events", editingEvent.id), eventData)
        toast({ title: "Event updated successfully" })
      } else {
        await addDoc(collection(db, "events"), eventData)
        toast({ title: "Event added successfully" })
      }

      setIsDialogOpen(false)
      resetForm()
      fetchEvents()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  const handleApproveSubmission = async (submission: SimchaSubmission) => {
    try {
      // Create event from submission
      await addDoc(collection(db, "events"), {
        eventName: `${submission.simchaType} - ${submission.fullName}`,
        personFamily: submission.fullName,
        type: submission.simchaType,
        date: submission.date,
        location: "TBD",
        description: submission.message,
        imageUrl: submission.imageUrl,
      })

      // Mark submission as approved
      await updateDoc(doc(db, "simchaSubmissions", submission.id), {
        status: "approved",
      })

      toast({ title: "Simcha approved and added to events" })
      fetchSubmissions()
      fetchEvents()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const handleMarkProcessed = async (id: string) => {
    try {
      await updateDoc(doc(db, "simchaSubmissions", id), {
        status: "processed",
      })
      toast({ title: "Submission marked as processed" })
      fetchSubmissions()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const handleEdit = (event: Event) => {
    setEditingEvent(event)
    setFormData({
      eventName: event.eventName,
      personFamily: event.personFamily,
      type: event.type,
      date: event.date,
      location: event.location,
      description: event.description || "",
      hideAfterDays: event.hideAfterDays ? String(event.hideAfterDays) : "",
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this event?")) return

    try {
      await deleteDoc(doc(db, "events", id))
      toast({ title: "Event deleted successfully" })
      fetchEvents()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const resetForm = () => {
    setEditingEvent(null)
    setFormData({ eventName: "", personFamily: "", type: "", date: "", location: "", description: "", hideAfterDays: "" })
    setImageFile(null)
    setUploadProgress(0)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-navy mb-2">Events & Simchos</h1>
          <p className="text-navy/70">Manage events and review simcha submissions</p>
        </div>
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (!open) resetForm()
          }}
        >
          <DialogTrigger asChild>
            <Button className="bg-navy text-cream hover:bg-navy/90">
              <Plus className="mr-2 h-4 w-4" />
              Add Event
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl text-navy">
                {editingEvent ? "Edit Event" : "Add New Event"}
              </DialogTitle>
              <DialogDescription>
                {editingEvent ? "Update the event details" : "Add a new upcoming event or simcha"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="eventName">Event Name *</Label>
                  <Input
                    id="eventName"
                    required
                    value={formData.eventName}
                    onChange={(e) => setFormData({ ...formData, eventName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="personFamily">Person/Family *</Label>
                  <Input
                    id="personFamily"
                    required
                    value={formData.personFamily}
                    onChange={(e) => setFormData({ ...formData, personFamily: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Type *</Label>
                  <Input
                    id="type"
                    required
                    placeholder="e.g., Wedding, Bar Mitzvah"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location *</Label>
                <Input
                  id="location"
                  required
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hideAfterDays">Auto-hide after (days, optional)</Label>
                <Input
                  id="hideAfterDays"
                  type="number"
                  min={1}
                  placeholder="Leave blank to never auto-hide"
                  value={formData.hideAfterDays}
                  onChange={(e) => setFormData({ ...formData, hideAfterDays: e.target.value })}
                />
                <p className="text-xs text-navy/60">
                  Event will be hidden from the site after this many days.
                  {editingEvent?.timerStartAt && formData.hideAfterDays
                    ? ` Timer started ${new Date(editingEvent.timerStartAt).toLocaleDateString()}.`
                    : ""}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="image">Event Image</Label>
                <Input
                  id="image"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                />
                {uploading && uploadProgress > 0 && (
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
              <Button type="submit" disabled={uploading} className="w-full bg-navy text-cream">
                {uploading ? `Uploading... ${Math.round(uploadProgress)}%` : editingEvent ? "Update Event" : "Add Event"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="events" className="space-y-6">
        <TabsList>
          <TabsTrigger value="events">Events ({events.length})</TabsTrigger>
          <TabsTrigger value="submissions">Pending Submissions ({submissions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="events">
          <Card className="border-gold/20 bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="text-navy">All Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start justify-between border-b border-gold/20 pb-4 last:border-0"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-navy">{event.eventName}</h3>
                        {(() => {
                          const countdown = formatExpiryCountdown(event)
                          if (!countdown) return null
                          const isGone = countdown.startsWith("expired")
                          return (
                            <span
                              className={`text-xs px-2 py-0.5 rounded ${
                                isGone ? "bg-red-100 text-red-700" : "bg-navy/10 text-navy/70"
                              }`}
                            >
                              {countdown}
                            </span>
                          )
                        })()}
                      </div>
                      <p className="text-sm text-navy/70">
                        {event.personFamily} • {event.type}
                      </p>
                      <p className="text-xs text-navy/50 mt-1">
                        {event.date} • {event.location}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(event)}
                        className="border-gold text-navy"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(event.id)}
                        className="border-destructive text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {events.length === 0 && <p className="text-center text-navy/50 py-8">No events yet.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="submissions">
          <Card className="border-gold/20 bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="text-navy">Pending Simcha Submissions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {submissions.map((submission) => (
                  <Card key={submission.id} className="border-gold/20">
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div>
                          <h3 className="font-semibold text-navy">{submission.simchaType}</h3>
                          <p className="text-navy/70">{submission.fullName}</p>
                        </div>
                        <div className="text-sm text-navy/60">
                          <p>Date: {submission.date}</p>
                          {submission.connection && <p>Connection: {submission.connection}</p>}
                          {submission.message && <p>Message: {submission.message}</p>}
                          <p>Submitted by: {submission.submittedBy}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={() => handleApproveSubmission(submission)} className="bg-navy text-cream">
                            Approve & Add to Events
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => handleMarkProcessed(submission.id)}
                            className="border-gold text-navy"
                          >
                            Mark as Processed
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {submissions.length === 0 && <p className="text-center text-navy/50 py-8">No pending submissions.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
