"use client"

import type React from "react"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Navbar } from "@/components/navbar"
import { AuthGuard } from "@/components/auth-guard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar, ChevronRight, ChevronDown, ChevronUp, ExternalLink, PartyPopper, Megaphone, Play, Download, X, Loader2, FolderOpen } from "lucide-react"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/lib/auth-context"
import { trackPlay, trackDownload } from "@/lib/track-engagement"
import { useToast } from "@/hooks/use-toast"

interface UpcomingShiur {
  title: string
  rebbe: string
  date: string
  time: string
  description?: string
  zoomLink?: string // Made optional
  enabled?: boolean
  liveEmbedUrl?: string
  isLive?: boolean
}

interface CarouselImage {
  id: string
  url: string
  caption?: string
  order: number
}

interface Event {
  id: string
  eventName: string
  personFamily: string
  type: string
  date: string
  location: string
  imageUrl?: string
  description?: string
}

interface Announcement {
  id: string
  title: string
  content: string
  type: "mazel_tov" | "announcement"
  date: string
  enabled: boolean
}

interface AlumniPhoto {
  id: string
  url: string
  caption: string
  name?: string
  year?: string
  order: number
}

interface Shiur {
  id: string
  title: string
  rebbe: string
  date: string
  tags: string[]
  audioUrl?: string
  pdfUrl?: string
}

export default function HomePage() {
  const [mostRecentShiur, setMostRecentShiur] = useState<Shiur | null>(null)
  const [currentImage, setCurrentImage] = useState(0)
  const [carouselImages, setCarouselImages] = useState<CarouselImage[]>([])
  const [upcomingSimchos, setUpcomingSimchos] = useState<Event[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [alumniPhotos, setAlumniPhotos] = useState<AlumniPhoto[]>([])
  const [expandedPhoto, setExpandedPhoto] = useState<AlumniPhoto | null>(null)
  const [downloadingShiur, setDownloadingShiur] = useState(false)
  const [announcementsExpanded, setAnnouncementsExpanded] = useState(false)
  const [featuredShiur, setFeaturedShiur] = useState<Shiur | null>(null)
  const [activeCollection, setActiveCollection] = useState<{ id: string; name: string; description: string } | null>(null)
  const [playedShiurim, setPlayedShiurim] = useState<Set<string>>(new Set())
  const { user } = useAuth()

  const incrementPlayCount = async (shiurId: string) => {
    if (playedShiurim.has(shiurId)) return
    setPlayedShiurim(prev => new Set(prev).add(shiurId))
    await trackPlay(shiurId, user)
  }

  const incrementDownloadCount = async (shiurId: string) => {
    await trackDownload(shiurId, user)
  }
  const { toast } = useToast()

  useEffect(() => {
    const fetchMostRecentShiur = async () => {
      const shiurimRef = collection(db, "shiurim")
      const q = query(shiurimRef, orderBy("date", "desc"), limit(1))
      const querySnapshot = await getDocs(q)

      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0]
        setMostRecentShiur({ id: doc.id, ...doc.data() } as Shiur)
      }
    }
    fetchMostRecentShiur()
  }, [])

  useEffect(() => {
    const fetchFeaturedShiur = async () => {
      const { doc: docRef, getDoc } = await import("firebase/firestore")
      const settingsDoc = await getDoc(docRef(db, "settings", "featuredShiur"))
      if (settingsDoc.exists()) {
        const data = settingsDoc.data()
        if (data.enabled && data.shiurId) {
          // Fetch the actual shiur
          const shiurDoc = await getDoc(docRef(db, "shiurim", data.shiurId))
          if (shiurDoc.exists()) {
            setFeaturedShiur({ id: shiurDoc.id, ...shiurDoc.data() } as Shiur)
          }
        }
      }
    }
    fetchFeaturedShiur()
  }, [])

  useEffect(() => {
    const fetchActiveCollection = async () => {
      const collectionsRef = collection(db, "shiurCollections")
      const querySnapshot = await getDocs(collectionsRef)
      
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data()
        if (data.isActive) {
          setActiveCollection({ 
            id: docSnap.id, 
            name: data.name, 
            description: data.description 
          })
        }
      })
    }
    fetchActiveCollection()
  }, [])

  useEffect(() => {
    const fetchCarouselImages = async () => {
      const querySnapshot = await getDocs(collection(db, "carouselImages"))
      const images: CarouselImage[] = []
      querySnapshot.forEach((doc) => {
        images.push({ id: doc.id, ...doc.data() } as CarouselImage)
      })
      images.sort((a, b) => a.order - b.order)
      setCarouselImages(images)
    }
    fetchCarouselImages()
  }, [])

  useEffect(() => {
    const fetchUpcomingSimchos = async () => {
      const eventsRef = collection(db, "events")
      const q = query(eventsRef, orderBy("date", "asc"))
      const querySnapshot = await getDocs(q)
      const eventsData: Event[] = []

      const today = new Date().toISOString().split("T")[0]
      querySnapshot.forEach((doc) => {
        const data = doc.data()
        if (data.date >= today) {
          eventsData.push({ id: doc.id, ...data } as Event)
        }
      })

      setUpcomingSimchos(eventsData.slice(0, 3))
    }
    fetchUpcomingSimchos()
  }, [])

  useEffect(() => {
    const fetchAnnouncements = async () => {
      const querySnapshot = await getDocs(collection(db, "announcements"))
      const items: Announcement[] = []
      querySnapshot.forEach((doc) => {
        const data = doc.data() as Announcement
        if (data.enabled !== false) {
          items.push({ id: doc.id, ...data })
        }
      })
      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setAnnouncements(items)
    }
    fetchAnnouncements()
  }, [])

  useEffect(() => {
    const fetchAlumniPhotos = async () => {
      const querySnapshot = await getDocs(collection(db, "alumniPhotos"))
      const photos: AlumniPhoto[] = []
      querySnapshot.forEach((doc) => {
        photos.push({ id: doc.id, ...doc.data() } as AlumniPhoto)
      })
      photos.sort((a, b) => a.order - b.order)
      setAlumniPhotos(photos)
    }
    fetchAlumniPhotos()
  }, [])

  useEffect(() => {
    if (carouselImages.length === 0) return
    const timer = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % carouselImages.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [carouselImages.length])

  const nextImage = () => {
    setCurrentImage((prev) => (prev + 1) % carouselImages.length)
  }

  const prevImage = () => {
    setCurrentImage((prev) => (prev - 1 + carouselImages.length) % carouselImages.length)
  }

  const handleReminderSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    // Implementation for handling reminder signup
  }

  const convertToEmbedUrl = (url: string): string => {
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

  const getGoogleDriveDirectUrl = (url: string): string => {
    if (!url) return url
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
    if (match) {
      return `/api/proxy-audio?id=${match[1]}`
    }
    return url
  }

  const isGoogleDriveUrl = (url: string): boolean => {
    return url?.includes("drive.google.com") || false
  }

  const getGoogleDriveDownloadUrl = (url: string): string => {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
    if (match) {
      return `https://drive.google.com/uc?export=download&id=${match[1]}`
    }
    return url
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-cream">
        <Navbar />

        {/* Refuah Sheleima Banner */}
        <div className="bg-navy/90 text-cream py-3 px-4 text-center">
          <p className="text-base font-medium">
            This website is dedicated לזכות ולרפואה שלמה ר׳ פנחס בן יוכבד
          </p>
        </div>

        <section className="relative h-[600px] overflow-hidden">
          <div className="relative h-full">
            {carouselImages.length > 0 ? (
              carouselImages.map((image, index) => (
                <div
                  key={image.id}
                  className={`absolute inset-0 transition-opacity duration-1000 ${
                    index === currentImage ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <img
                    src={image.url || "/placeholder.svg"}
                    alt={image.caption || `Yeshiva image ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-br from-navy via-navy/80 to-transparent" />
                  <div className="absolute inset-0 bg-navy/20" />
                </div>
              ))
            ) : (
              <div className="absolute inset-0 bg-navy overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-navy-dark via-navy to-navy-light" />
                {/* Decorative geometric patterns */}
                <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-gold/5 to-transparent" />
                <div className="absolute bottom-0 left-0 w-full h-1/3 bg-gradient-to-t from-navy-dark/50 to-transparent" />
                {/* Subtle decorative lines */}
                <div className="absolute top-20 right-20 w-64 h-64 border border-gold/10 rounded-full" />
                <div className="absolute top-32 right-32 w-48 h-48 border border-gold/5 rounded-full" />
                <div className="absolute bottom-20 left-20 w-32 h-32 border border-cream/5 rounded-full" />
                {/* Accent corner elements */}
                <div className="absolute top-0 left-0 w-32 h-32 border-l-2 border-t-2 border-gold/20" />
                <div className="absolute bottom-0 right-0 w-32 h-32 border-r-2 border-b-2 border-gold/20" />
                {/* Subtle texture overlay */}
                <div
                  className="absolute inset-0 opacity-30"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 25% 25%, rgba(212,175,55,0.03) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(255,253,245,0.02) 0%, transparent 50%)",
                  }}
                />
              </div>
            )}

            <div className="absolute inset-0 flex flex-col items-start justify-center px-8 sm:px-12 lg:px-24 max-w-7xl mx-auto">
              <div className="max-w-3xl">
                <Image
                  src="/yeshiva-logo.png"
                  alt="Yeshiva Toras Chaim"
                  width={160}
                  height={160}
                  className="mb-6 drop-shadow-lg"
                />
                <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-cream mb-4 leading-tight text-shadow">
                  Yeshiva Toras Chaim
                  <span className="block text-gold-light mt-2 text-3xl sm:text-4xl lg:text-5xl">Alumni Network</span>
                </h1>

                <Button
                  size="lg"
                  className="bg-gold text-navy hover:bg-gold-dark font-semibold text-base px-8 py-6 shadow-xl hover:shadow-2xl transition-all hover:scale-105"
                  onClick={() => {
                    document.getElementById("recent-shiur")?.scrollIntoView({ behavior: "smooth" })
                  }}
                >
                  View Most Recent Shiur
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>

            {carouselImages.length > 0 && carouselImages[currentImage]?.caption && (
              <div className="absolute bottom-8 left-8 bg-navy/90 backdrop-blur-sm px-6 py-3 rounded border border-gold/30">
                <p className="text-cream text-sm font-medium">{carouselImages[currentImage].caption}</p>
              </div>
            )}
          </div>
        </section>

        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 space-y-24">
          {announcements.length > 0 && (
            <section>
              <div className="mb-12">
                <div className="flex items-center gap-6 mb-3">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold to-transparent" />
                  <h2 className="font-serif text-3xl sm:text-4xl font-bold text-navy">Mazel Tovs & Announcements</h2>
                  <div className="h-px flex-1 bg-gradient-to-l from-transparent via-gold to-transparent" />
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {(announcementsExpanded ? announcements : announcements.slice(0, 6)).map((item, index) => (
                  <Card
                    key={item.id}
                    className={`border-gold/30 bg-white shadow-md hover:shadow-xl transition-all duration-300 group overflow-hidden ${
                      item.type === "mazel_tov" ? "hover:border-gold" : ""
                    }`}
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div
                      className={`h-1 w-full ${item.type === "mazel_tov" ? "bg-gradient-to-r from-gold via-gold-light to-gold" : "bg-gradient-to-r from-navy via-navy-light to-navy"}`}
                    />
                    <CardHeader className="pb-3">
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-lg ${item.type === "mazel_tov" ? "bg-gold/10" : "bg-navy/10"}`}>
                          {item.type === "mazel_tov" ? (
                            <PartyPopper className="h-6 w-6 text-gold" />
                          ) : (
                            <Megaphone className="h-6 w-6 text-navy" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="font-serif text-xl text-navy group-hover:text-navy-light transition-colors">
                            {item.title}
                          </CardTitle>
                          <CardDescription className="text-navy/50 text-xs mt-1">
                            {new Date(item.date).toLocaleDateString("en-US", {
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-navy/80 text-base leading-relaxed">{item.content}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              {announcements.length > 6 && (
                <div className="flex justify-center mt-8">
                  <Button
                    variant="outline"
                    onClick={() => setAnnouncementsExpanded(!announcementsExpanded)}
                    className="border-gold/30 text-navy hover:bg-gold/10"
                  >
                    {announcementsExpanded ? (
                      <>
                        <ChevronUp className="h-4 w-4 mr-2" />
                        Show Less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4 mr-2" />
                        Show All
                      </>
                    )}
                  </Button>
                </div>
              )}
            </section>
          )}

          {activeCollection && (
            <section className="mb-16">
              <Card className="border-gold/30 bg-gradient-to-r from-navy to-navy-light shadow-xl overflow-hidden">
                <CardContent className="p-6 sm:p-8">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-gold/20 rounded-lg">
                        <FolderOpen className="h-8 w-8 text-gold" />
                      </div>
                      <div>
                        <h3 className="font-serif text-2xl font-bold text-cream">{activeCollection.name}</h3>
                        {activeCollection.description && (
                          <p className="text-cream/70 mt-1">{activeCollection.description}</p>
                        )}
                      </div>
                    </div>
                    <Button asChild className="bg-gold text-navy hover:bg-gold-dark font-semibold">
                      <Link href={`/collection/${activeCollection.id}`}>
                        View Collection
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </section>
          )}

          {featuredShiur && (
            <section className="mb-16">
              <div className="mb-8 text-center">
                <div className="mx-auto mb-4 h-1 w-24 bg-gold" />
                <h2 className="font-serif text-3xl font-bold text-navy">Featured Shiur</h2>
              </div>

              <Card className="border-gold/20 bg-white shadow-xl">
                <CardHeader className="border-b border-gold/20 bg-navy/5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <CardTitle className="font-serif text-2xl text-navy">{featuredShiur.title}</CardTitle>
                      <p className="text-lg font-medium text-navy/80 mt-1">
                        By{" "}
                        <Link 
                          href={`/shiurim?rebbe=${encodeURIComponent(featuredShiur.rebbe)}`}
                          className="text-gold-dark font-semibold hover:text-gold hover:underline transition-colors"
                        >
                          {featuredShiur.rebbe}
                        </Link>
                      </p>
                    </div>
                    {featuredShiur.tags && featuredShiur.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {featuredShiur.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-3 py-1 bg-gold/10 text-navy text-sm rounded-full border border-gold/20"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="mb-6 flex flex-wrap gap-6">
                    <div className="flex items-center gap-2 text-navy">
                      <Calendar className="h-5 w-5 text-gold" />
                      <span className="text-sm">
                        {new Date(featuredShiur.date).toLocaleDateString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>

                  {featuredShiur.audioUrl && (
                    <div className="mb-6">
                      {isGoogleDriveUrl(featuredShiur.audioUrl) ? (
                        <div className="bg-navy/5 rounded-lg p-4 border border-gold/20">
                          <div className="flex items-center justify-between flex-wrap gap-4">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 bg-gold/20 rounded-full flex items-center justify-center">
                                <Play className="h-5 w-5 text-navy" />
                              </div>
                              <span className="text-sm text-navy font-medium">Listen to this shiur</span>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-gold/30 text-navy hover:bg-gold/10 bg-transparent"
                                onClick={() => {
                                  incrementPlayCount(featuredShiur.id)
                                  window.open(featuredShiur.audioUrl, "_blank")
                                }}
                              >
                                <Play className="h-4 w-4 mr-2" />
                                Play on Google Drive
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <audio 
                          controls 
                          className="w-full" 
                          src={featuredShiur.audioUrl}
                          onPlay={() => incrementPlayCount(featuredShiur.id)}
                        >
                          Your browser does not support the audio element.
                        </audio>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-4">
                    {featuredShiur.pdfUrl && (
                      <Button
                        variant="outline"
                        className="border-gold/30 text-navy hover:bg-gold/10 bg-transparent"
                        asChild
                      >
                        <a href={featuredShiur.pdfUrl} target="_blank" rel="noopener noreferrer">
                          View Mareh Mekomos
                          <ExternalLink className="ml-2 h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <Button className="bg-navy text-cream hover:bg-navy/90" asChild>
                      <a href="/shiurim">
                        Browse All Shiurim
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </section>
          )}

          {mostRecentShiur && (
            <section id="recent-shiur" className="mb-16">
              <div className="mb-8 text-center">
                <div className="mx-auto mb-4 h-1 w-24 bg-gold" />
                <h2 className="font-serif text-3xl font-bold text-navy">Most Recent Shiur</h2>
              </div>

              <Card className="border-gold/20 bg-white shadow-xl">
                <CardHeader className="border-b border-gold/20 bg-navy/5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <CardTitle className="font-serif text-2xl text-navy">{mostRecentShiur.title}</CardTitle>
                      <p className="text-lg font-medium text-navy/80 mt-1">
                        By{" "}
                        <Link 
                          href={`/shiurim?rebbe=${encodeURIComponent(mostRecentShiur.rebbe)}`}
                          className="text-gold-dark font-semibold hover:text-gold hover:underline transition-colors"
                        >
                          {mostRecentShiur.rebbe}
                        </Link>
                      </p>
                    </div>
                    {mostRecentShiur.tags && mostRecentShiur.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {mostRecentShiur.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-3 py-1 bg-gold/10 text-navy text-sm rounded-full border border-gold/20"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="mb-6 flex flex-wrap gap-6">
                    <div className="flex items-center gap-2 text-navy">
                      <Calendar className="h-5 w-5 text-gold" />
                      <span className="text-sm">
                        {new Date(mostRecentShiur.date).toLocaleDateString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Audio Player */}
                  {mostRecentShiur.audioUrl && (
                    <div className="mb-6">
                      {isGoogleDriveUrl(mostRecentShiur.audioUrl) ? (
                        <div className="bg-navy/5 rounded-lg p-4 border border-gold/20">
                          <div className="flex items-center justify-between flex-wrap gap-4">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 bg-gold/20 rounded-full flex items-center justify-center">
                                <Play className="h-5 w-5 text-navy" />
                              </div>
                              <span className="text-sm text-navy font-medium">Listen to this shiur</span>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-gold/30 text-navy hover:bg-gold/10 bg-transparent"
                                onClick={() => {
                                  incrementPlayCount(mostRecentShiur.id)
                                  window.open(mostRecentShiur.audioUrl, "_blank")
                                }}
                              >
                                <Play className="h-4 w-4 mr-2" />
                                Play on Google Drive
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-gold/30 text-navy hover:bg-gold/10 bg-transparent"
                                disabled={downloadingShiur}
                                onClick={async () => {
                                  setDownloadingShiur(true)
                                  await incrementDownloadCount(mostRecentShiur.id)
                                  try {
                                    const downloadUrl = getGoogleDriveDownloadUrl(mostRecentShiur.audioUrl!)
                                    const response = await fetch(downloadUrl)
                                    const blob = await response.blob()
                                    const blobUrl = URL.createObjectURL(blob)
                                    const link = document.createElement("a")
                                    link.href = blobUrl
                                    link.download = `${mostRecentShiur.title}.mp3`
                                    document.body.appendChild(link)
                                    link.click()
                                    document.body.removeChild(link)
                                    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
                                  } catch (error) {
                                    window.open(getGoogleDriveDownloadUrl(mostRecentShiur.audioUrl!), "_blank")
                                  } finally {
                                    setDownloadingShiur(false)
                                  }
                                }}
                              >
                                {downloadingShiur ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Download className="h-4 w-4 mr-2" />
                                )}
                                {downloadingShiur ? "Downloading..." : "Download"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <audio 
                          controls 
                          className="w-full" 
                          src={mostRecentShiur.audioUrl}
                          onPlay={() => incrementPlayCount(mostRecentShiur.id)}
                        >
                          Your browser does not support the audio element.
                        </audio>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-4">
                    {mostRecentShiur.pdfUrl && (
                      <Button
                        variant="outline"
                        className="border-gold/30 text-navy hover:bg-gold/10 bg-transparent"
                        asChild
                      >
                        <a href={mostRecentShiur.pdfUrl} target="_blank" rel="noopener noreferrer">
                          View Mareh Mekomos
                          <ExternalLink className="ml-2 h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <Button className="bg-navy text-cream hover:bg-navy/90" asChild>
                      <a href="/shiurim">
                        Browse All Shiurim
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </section>
          )}

          {alumniPhotos.length > 0 && (
            <section>
              <div className="mb-12">
                <div className="flex items-center gap-6 mb-3">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold to-transparent" />
                  <h2 className="font-serif text-3xl sm:text-4xl font-bold text-navy">Alumni Spotlight</h2>
                  <div className="h-px flex-1 bg-gradient-to-l from-transparent via-gold to-transparent" />
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {alumniPhotos.map((photo, index) => (
                  <Card
                    key={photo.id}
                    className="border-gold/30 bg-white shadow-md hover:shadow-2xl transition-all duration-500 overflow-hidden group cursor-pointer"
                    style={{
                      animationDelay: `${index * 75}ms`,
                      transform: index % 2 === 0 ? "translateY(-8px)" : "translateY(8px)",
                    }}
                    onClick={() => setExpandedPhoto(photo)}
                  >
                    <div className="aspect-square overflow-hidden bg-navy/5">
                      <img
                        src={photo.url || "/placeholder.svg"}
                        alt={photo.caption || "Alumni photo"}
                        className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                    </div>
                    <CardContent className="p-5 bg-gradient-to-b from-white to-cream/30">
                      {photo.name && (
                        <p className="font-serif font-bold text-lg text-navy group-hover:text-navy-light transition-colors">
                          {photo.name}
                        </p>
                      )}
                      {photo.year && (
                        <p className="text-sm text-gold font-semibold tracking-wide">Class of {photo.year}</p>
                      )}
                      {photo.caption && <p className="text-sm text-navy/60 mt-2 leading-snug">{photo.caption}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Expanded Photo Dialog */}
              <Dialog open={!!expandedPhoto} onOpenChange={(open) => !open && setExpandedPhoto(null)}>
                <DialogContent className="max-w-3xl p-0 overflow-hidden bg-white">
                  {expandedPhoto && (
                    <>
                      <div className="relative">
                        <img
                          src={expandedPhoto.url || "/placeholder.svg"}
                          alt={expandedPhoto.caption || "Alumni photo"}
                          className="w-full max-h-[70vh] object-contain bg-navy/5"
                        />
                      </div>
                      <div className="p-6">
                        {expandedPhoto.name && (
                          <h3 className="font-serif font-bold text-2xl text-navy">{expandedPhoto.name}</h3>
                        )}
                        {expandedPhoto.year && (
                          <p className="text-gold font-semibold mt-1">Class of {expandedPhoto.year}</p>
                        )}
                        {expandedPhoto.caption && (
                          <p className="text-navy/70 mt-3 text-base leading-relaxed">{expandedPhoto.caption}</p>
                        )}
                      </div>
                    </>
                  )}
                </DialogContent>
              </Dialog>
            </section>
          )}
        </div>
      </div>
    </AuthGuard>
  )
}
