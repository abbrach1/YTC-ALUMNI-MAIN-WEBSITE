"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Navbar } from "@/components/navbar"
import { AuthGuard } from "@/components/auth-guard"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Calendar, MapPin, Clock, Send, Upload, X } from "lucide-react"
import { collection, getDocs, addDoc, query, orderBy } from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { db, storage } from "@/lib/firebase"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { getUserFriendlyError } from "@/lib/utils"
import { Dialog, DialogContent } from "@/components/ui/dialog"

interface Event {
  id: string
  eventName: string
  personFamily: string
  type: string
  date: string
  location: string
  time?: string
  imageUrl?: string
  description?: string
}

export default function EventsContent() {
  const [events, setEvents] = useState<Event[]>([])
  const [formData, setFormData] = useState({
    fullName: "",
    simchaType: "",
    date: "",
    connection: "",
    message: "",
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxImage, setLightboxImage] = useState<string>("")
  const [lightboxTitle, setLightboxTitle] = useState<string>("")
  const { user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    const fetchEvents = async () => {
      const eventsRef = collection(db, "events")
      const q = query(eventsRef, orderBy("date", "asc"))
      const querySnapshot = await getDocs(q)
      const eventsData: Event[] = []

      querySnapshot.forEach((doc) => {
        const data = doc.data()
        eventsData.push({ id: doc.id, ...data } as Event)
      })

      setEvents(eventsData)
    }
    fetchEvents()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setUploading(true)

    try {
      let imageUrl = ""

      if (imageFile) {
        const storageRef = ref(storage, `simcha-images/${Date.now()}-${imageFile.name}`)
        await uploadBytes(storageRef, imageFile)
        imageUrl = await getDownloadURL(storageRef)
      }

      await addDoc(collection(db, "simchaSubmissions"), {
        fullName: formData.fullName,
        simchaType: formData.simchaType,
        date: formData.date,
        connection: formData.connection,
        message: formData.message,
        imageUrl,
        submittedBy: user?.email,
        submittedAt: new Date().toISOString(),
        status: "new",
      })

      await fetch("/api/send-simcha-submission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: formData.fullName,
          simchaType: formData.simchaType,
          date: formData.date,
          connection: formData.connection,
          message: formData.message,
          submittedBy: user?.email,
        }),
      })

      toast({
        title: "Simcha Submitted",
        description: "Thank you! Your simcha has been submitted for review.",
      })

      setFormData({
        fullName: "",
        simchaType: "",
        date: "",
        connection: "",
        message: "",
      })
      setImageFile(null)
    } catch (error: any) {
      toast({
        title: "Unable to submit",
        description: getUserFriendlyError(error),
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return {
      day: date.getDate(),
      month: date.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
      year: date.getFullYear(),
      full: date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
    }
  }

  const upcomingEvents = events.filter((e) => new Date(e.date) >= new Date())
  const pastEvents = events.filter((e) => new Date(e.date) < new Date())

  const openLightbox = (imageUrl: string, title: string) => {
    setLightboxImage(imageUrl)
    setLightboxTitle(title)
    setLightboxOpen(true)
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-cream">
        <Navbar />

        {/* Header */}
        <section className="bg-navy py-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold text-cream">Yeshiva Simchos</h1>
          </div>
        </section>

        <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          {/* Upcoming Simchos */}
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-navy mb-5">Upcoming</h2>

            {upcomingEvents.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {upcomingEvents.map((event) => {
                  const dateInfo = formatDate(event.date)
                  return (
                    <Card
                      key={event.id}
                      className="group border-0 bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                    >
                      {/* Image or Gradient Header */}
                      {event.imageUrl ? (
                        <div 
                          className="h-40 overflow-hidden cursor-pointer relative group/image"
                          onClick={() => openLightbox(event.imageUrl!, event.eventName)}
                        >
                          <img
                            src={event.imageUrl || "/placeholder.svg"}
                            alt={event.eventName}
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/20 transition-colors flex items-center justify-center">
                            <span className="text-white text-sm font-medium opacity-0 group-hover/image:opacity-100 transition-opacity">
                              Click to expand
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="h-3 bg-gradient-to-r from-navy to-gold" />
                      )}

                      <CardContent className="p-5">
                        <div className="flex gap-4">
                          {/* Date Badge */}
                          <div className="flex-shrink-0">
                            <div className="w-14 bg-navy text-cream rounded-lg py-2 text-center">
                              <span className="block text-xs font-medium opacity-80">{dateInfo.month}</span>
                              <span className="block text-2xl font-bold">{dateInfo.day}</span>
                            </div>
                          </div>

                          {/* Event Details */}
                          <div className="flex-1 min-w-0">
                            <span className="inline-block px-2 py-0.5 bg-gold/10 text-gold text-xs font-medium rounded mb-1.5">
                              {event.type}
                            </span>
                            <h3 className="font-semibold text-navy text-lg leading-tight mb-1">{event.eventName}</h3>
                            <p className="text-navy/60 text-sm">{event.personFamily}</p>
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-navy/10 space-y-2">
                          <div className="flex items-center gap-2 text-sm text-navy/70">
                            <MapPin className="h-4 w-4 text-gold flex-shrink-0" />
                            <span className="truncate">{event.location}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-navy/70">
                            <Calendar className="h-4 w-4 text-gold flex-shrink-0" />
                            <time dateTime={event.date}>{dateInfo.full}</time>
                          </div>
                          {event.time && (
                            <div className="flex items-center gap-2 text-sm text-navy/70">
                              <Clock className="h-4 w-4 text-gold flex-shrink-0" />
                              <span>{event.time}</span>
                            </div>
                          )}
                        </div>

                        {event.description && (
                          <p className="mt-3 text-sm text-navy/60 line-clamp-2">{event.description}</p>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            ) : (
              <p className="text-navy/50 py-8">No upcoming simchos at the moment.</p>
            )}
          </section>

          {/* Past Simchos */}
          {pastEvents.length > 0 && (
            <section className="mb-12">
              <h2 className="text-lg font-semibold text-navy/70 mb-4">Past</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {pastEvents.slice(0, 8).map((event) => {
                  const dateInfo = formatDate(event.date)
                  return (
                    <div key={event.id} className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm">
                      <div className="flex-shrink-0 w-11 bg-navy/10 text-navy rounded py-1.5 text-center">
                        <span className="block text-[10px] font-medium opacity-70">{dateInfo.month}</span>
                        <span className="block text-base font-bold">{dateInfo.day}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-navy text-sm truncate">{event.eventName}</h3>
                        <p className="text-navy/50 text-xs truncate">{event.personFamily}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Submit Simcha Form */}
          <section>
            <div className="bg-white rounded-lg border border-navy/10 p-6 lg:p-8">
              <h2 className="text-xl font-semibold text-navy mb-6">Share Your Simcha</h2>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-navy text-sm font-medium">
                      Full Name
                    </Label>
                    <Input
                      id="fullName"
                      required
                      placeholder="Enter full name"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="border-navy/20 focus:border-gold focus:ring-gold/20 h-12 bg-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="simchaType" className="text-navy text-sm font-medium">
                      Type of Simcha
                    </Label>
                    <Input
                      id="simchaType"
                      required
                      placeholder="Wedding, Bar Mitzvah, etc."
                      value={formData.simchaType}
                      onChange={(e) => setFormData({ ...formData, simchaType: e.target.value })}
                      className="border-navy/20 focus:border-gold focus:ring-gold/20 h-12 bg-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="date" className="text-navy text-sm font-medium">
                      Date
                    </Label>
                    <Input
                      id="date"
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="border-navy/20 focus:border-gold focus:ring-gold/20 h-12 bg-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="connection" className="text-navy text-sm font-medium">
                      Connection to Yeshiva
                    </Label>
                    <Input
                      id="connection"
                      placeholder="Alumnus, Parent, etc."
                      value={formData.connection}
                      onChange={(e) => setFormData({ ...formData, connection: e.target.value })}
                      className="border-navy/20 focus:border-gold focus:ring-gold/20 h-12 bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message" className="text-navy text-sm font-medium">
                    Additional Details <span className="text-navy/40 font-normal">(Optional)</span>
                  </Label>
                  <Textarea
                    id="message"
                    rows={4}
                    placeholder="Share any additional details about your simcha..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="border-navy/20 focus:border-gold focus:ring-gold/20 resize-none bg-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="image" className="text-navy text-sm font-medium">
                    Upload Picture <span className="text-navy/40 font-normal">(Optional)</span>
                  </Label>
                  <label
                    htmlFor="image"
                    className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-navy/20 rounded-xl p-8 text-center hover:border-gold/50 hover:bg-gold/5 transition-all cursor-pointer bg-white"
                  >
                    <Input
                      id="image"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    {imageFile ? (
                      <div className="text-navy">
                        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gold/10 flex items-center justify-center">
                          <Upload className="h-6 w-6 text-gold" />
                        </div>
                        <p className="font-medium">{imageFile.name}</p>
                        <p className="text-xs text-navy/50 mt-1">Click to change image</p>
                      </div>
                    ) : (
                      <>
                        <div className="w-12 h-12 rounded-full bg-navy/5 flex items-center justify-center">
                          <Upload className="h-6 w-6 text-navy/40" />
                        </div>
                        <div>
                          <p className="text-navy font-medium">Click to upload</p>
                          <p className="text-sm text-navy/50 mt-1">JPG, PNG up to 10MB</p>
                        </div>
                      </>
                    )}
                  </label>
                </div>

                <Button
                  type="submit"
                  disabled={uploading}
                  className="w-full h-12 bg-navy text-cream hover:bg-navy/90 font-medium text-base"
                >
                  {uploading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-cream/30 border-t-cream rounded-full animate-spin" />
                      Submitting...
                    </span>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Submit Simcha
                    </>
                  )}
                </Button>
              </form>
            </div>
          </section>
        </main>

        {/* Image Lightbox */}
        <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
          <DialogContent className="max-w-5xl p-0 border-0 bg-transparent">
            <div className="relative">
              <button
                onClick={() => setLightboxOpen(false)}
                className="absolute -top-12 right-0 p-2 rounded-full bg-white/90 hover:bg-white transition-colors z-50"
              >
                <X className="h-5 w-5 text-navy" />
              </button>
              <div className="bg-white rounded-lg overflow-hidden">
                <img
                  src={lightboxImage}
                  alt={lightboxTitle}
                  className="w-full h-auto max-h-[85vh] object-contain"
                />
                {lightboxTitle && (
                  <div className="p-4 bg-navy/5 border-t border-navy/10">
                    <p className="text-navy font-medium text-center">{lightboxTitle}</p>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AuthGuard>
  )
}
