"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { AuthGuard } from "@/components/auth-guard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar, Play, ExternalLink, ArrowLeft, Download, Loader2 } from "lucide-react"
import Link from "next/link"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/lib/auth-context"
import { trackPlay, trackDownload } from "@/lib/track-engagement"
import { useToast } from "@/hooks/use-toast"

interface Shiur {
  id: string
  title: string
  rebbe: string
  date: string
  tags: string[]
  audioUrl?: string
  pdfUrl?: string
  description?: string
}

interface ShiurCollection {
  id: string
  name: string
  description: string
  shiurIds: string[]
}

export default function CollectionPage() {
  const params = useParams()
  const [collection, setCollection] = useState<ShiurCollection | null>(null)
  const [shiurim, setShiurim] = useState<Shiur[]>([])
  const [loading, setLoading] = useState(true)
  const [playingShiur, setPlayingShiur] = useState<string | null>(null)
  const [downloadingShiur, setDownloadingShiur] = useState<string | null>(null)
  const { toast } = useToast()
  const { user } = useAuth()

  useEffect(() => {
    if (collection) {
      document.title = `${collection.name} - Shiurim | YTC Alumni`
    }
  }, [collection])

  useEffect(() => {
    const fetchCollection = async () => {
      if (!params.id) return

      try {
        const collectionDoc = await getDoc(doc(db, "shiurCollections", params.id as string))
        if (collectionDoc.exists()) {
          const collectionData = { id: collectionDoc.id, ...collectionDoc.data() } as ShiurCollection
          setCollection(collectionData)

          // Fetch all shiurim in the collection
          const shiurimData: Shiur[] = []
          for (const shiurId of collectionData.shiurIds) {
            const shiurDoc = await getDoc(doc(db, "shiurim", shiurId))
            if (shiurDoc.exists()) {
              shiurimData.push({ id: shiurDoc.id, ...shiurDoc.data() } as Shiur)
            }
          }
          // Sort by date descending
          shiurimData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          setShiurim(shiurimData)
        }
      } catch (error) {
        console.error("Error fetching collection:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchCollection()
  }, [params.id])

  const isGoogleDriveUrl = (url: string): boolean => {
    return url?.includes("drive.google.com") || false
  }

  const handlePlay = async (shiur: Shiur) => {
    setPlayingShiur(shiur.id)
    await trackPlay(shiur.id, user)

    if (isGoogleDriveUrl(shiur.audioUrl || "")) {
      window.open(shiur.audioUrl, "_blank")
    }
    setPlayingShiur(null)
  }

  const handleDownload = async (shiur: Shiur) => {
    if (!shiur.audioUrl) return

    setDownloadingShiur(shiur.id)
    try {
      await trackDownload(shiur.id, user)

      if (isGoogleDriveUrl(shiur.audioUrl)) {
        const match = shiur.audioUrl.match(/\/d\/([a-zA-Z0-9_-]+)/)
        if (match) {
          window.open(`https://drive.google.com/uc?export=download&id=${match[1]}`, "_blank")
        }
      } else {
        window.open(shiur.audioUrl, "_blank")
      }
    } catch (error) {
      console.error("Error downloading:", error)
      toast({ title: "Error downloading shiur", variant: "destructive" })
    } finally {
      setDownloadingShiur(null)
    }
  }

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-cream">
          <Navbar />
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-navy" />
          </div>
        </div>
      </AuthGuard>
    )
  }

  if (!collection) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-cream">
          <Navbar />
          <div className="mx-auto max-w-7xl px-4 py-16 text-center">
            <h1 className="font-serif text-3xl font-bold text-navy mb-4">Collection Not Found</h1>
            <Button asChild className="bg-navy text-cream hover:bg-navy/90">
              <Link href="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Link>
            </Button>
          </div>
        </div>
      </AuthGuard>
    )
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-cream">
        <Navbar />

        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-8">
            <Button variant="ghost" asChild className="mb-4 text-navy hover:text-navy/80">
              <Link href="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Link>
            </Button>

            <div className="text-center">
              <div className="mx-auto mb-4 h-1 w-24 bg-gold" />
              <h1 className="font-serif text-4xl font-bold text-navy mb-2">{collection.name}</h1>
              {collection.description && (
                <p className="text-navy/70 text-lg max-w-2xl mx-auto">{collection.description}</p>
              )}
              <p className="text-navy/50 mt-2">{shiurim.length} shiurim</p>
            </div>
          </div>

          <div className="grid gap-6">
            {shiurim.map((shiur) => (
              <Card key={shiur.id} className="border-gold/20 bg-white shadow-lg">
                <CardHeader className="border-b border-gold/20 bg-navy/5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <CardTitle className="font-serif text-xl text-navy">{shiur.title}</CardTitle>
                      <p className="text-base font-medium text-navy/80 mt-1">
                        By{" "}
                        <Link
                          href={`/shiurim?rebbe=${encodeURIComponent(shiur.rebbe)}`}
                          className="text-gold-dark font-semibold hover:text-gold hover:underline transition-colors"
                        >
                          {shiur.rebbe}
                        </Link>
                      </p>
                    </div>
                    {shiur.tags && shiur.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {shiur.tags.map((tag) => (
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
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-navy mb-4">
                    <Calendar className="h-4 w-4 text-gold" />
                    <span className="text-sm">
                      {new Date(shiur.date).toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                  </div>

                  {shiur.description && (
                    <p className="text-navy/70 mb-4">{shiur.description}</p>
                  )}

                  <div className="flex flex-wrap gap-3">
                    {shiur.audioUrl && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-gold/30 text-navy hover:bg-gold/10"
                          onClick={() => handlePlay(shiur)}
                          disabled={playingShiur === shiur.id}
                        >
                          {playingShiur === shiur.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4 mr-2" />
                          )}
                          Play
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-gold/30 text-navy hover:bg-gold/10"
                          onClick={() => handleDownload(shiur)}
                          disabled={downloadingShiur === shiur.id}
                        >
                          {downloadingShiur === shiur.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4 mr-2" />
                          )}
                          Download
                        </Button>
                      </>
                    )}
                    {shiur.pdfUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-gold/30 text-navy hover:bg-gold/10"
                        asChild
                      >
                        <a href={shiur.pdfUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Mareh Mekomos
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Button asChild className="bg-navy text-cream hover:bg-navy/90">
              <Link href="/shiurim">
                Browse All Shiurim
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}
