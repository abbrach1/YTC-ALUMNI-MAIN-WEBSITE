"use client"

import type React from "react"

import { useEffect, useState, useRef } from "react"
import { Navbar } from "@/components/navbar"
import { AuthGuard } from "@/components/auth-guard"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import {
  Play,
  Pause,
  FileText,
  Search,
  Download,
  Bookmark,
  BookmarkCheck,
  Volume2,
  VolumeX,
  Headphones,
  ExternalLink,
  X,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
  CheckCircle2,
  SkipBack,
  SkipForward,
  Gauge,
  Layers,
  Loader2,
  ArrowUpDown,
} from "lucide-react"
import { collection, getDocs, query, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/lib/auth-context"
import { trackPlay, trackDownload } from "@/lib/track-engagement"
import { useSearchParams, useRouter } from "next/navigation"
import {
  getSavedShiurimLocal,
  toggleSavedShiurHybrid,
  syncSavedShiurimOnLoad,
} from "@/lib/firebase-saved-shiurim"
import {
  getPlaybackPositionLocal,
  savePlaybackPositionHybrid,
  clearPlaybackPositionHybrid,
  syncPlaybackPositionsOnLoad,
} from "@/lib/firebase-playback-positions"

interface Shiur {
  id: string
  title: string
  rebbe: string
  date: string
  tags: string[]
  audioUrl?: string
  pdfUrl?: string
  description?: string
  playCount?: number
  downloadCount?: number
  series?: string
}

const getGoogleDriveFileId = (url: string): string | null => {
  if (!url.includes("drive.google.com")) return null
  const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  return fileIdMatch?.[1] || idMatch?.[1] || null
}

const getGoogleDriveDirectUrl = (url: string): string => {
  if (!url.includes("drive.google.com")) return url
  return `/api/proxy-audio?url=${encodeURIComponent(url)}`
}

// Legacy localStorage-only functions (kept for backward compatibility)
const getPlaybackPosition = (shiurId: string): number => {
  return getPlaybackPositionLocal(shiurId)
}

const getSavedShiurim = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem("saved-shiurim") || "[]")
  } catch (e) {
    return []
  }
}

const toggleSavedShiur = (shiurId: string): string[] => {
  try {
    const saved = getSavedShiurim()
    const index = saved.indexOf(shiurId)
    if (index > -1) {
      saved.splice(index, 1)
    } else {
      saved.push(shiurId)
    }
    localStorage.setItem("saved-shiurim", JSON.stringify(saved))
    return saved
  } catch (e) {
    return []
  }
}

const getDownloadedShiurim = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem("downloaded-shiurim") || "[]")
  } catch (e) {
    return []
  }
}

const markAsDownloaded = (shiurId: string): string[] => {
  try {
    const downloaded = getDownloadedShiurim()
    if (!downloaded.includes(shiurId)) {
      downloaded.push(shiurId)
      localStorage.setItem("downloaded-shiurim", JSON.stringify(downloaded))
    }
    return downloaded
  } catch (e) {
    return []
  }
}



function GoogleDriveAudioPlayer({
  fileId,
  title,
  rebbe,
  shiurId,
  onPlay,
}: {
  fileId: string
  title: string
  rebbe: string
  shiurId: string
  onPlay: () => void
}) {
  const [isPlaying, setIsPlaying] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const hasTracked = useRef(false)

  const handleLoad = () => {
    setIsPlaying(true)
    if (!hasTracked.current) {
      hasTracked.current = true
      onPlay()
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/10">
          <Headphones className="h-5 w-5 text-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm truncate">{title}</p>
          <p className="text-xs text-muted-foreground">{rebbe}</p>
        </div>
        {isPlaying && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            Playing
          </div>
        )}
      </div>
      <div className="bg-card p-3">
        <iframe
          ref={iframeRef}
          src={`https://drive.google.com/file/d/${fileId}/preview`}
          width="100%"
          height="60"
          allow="autoplay"
          className="block rounded-lg"
          onLoad={handleLoad}
        />
      </div>
      <div className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-2">
        <p className="text-xs text-muted-foreground">Position saved automatically</p>
        <a
          href={`https://drive.google.com/file/d/${fileId}/view`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-gold hover:text-gold/80 transition-colors font-medium"
        >
          Open in Drive
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  )
}

export default function ShiurimContent() {
  const [shiurim, setShiurim] = useState<Shiur[]>([])
  const [filteredShiurim, setFilteredShiurim] = useState<Shiur[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedRebbeim, setSelectedRebbeim] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedSeries, setSelectedSeries] = useState<string[]>([])
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null)
  const [rebbeim, setRebbeim] = useState<string[]>([])
  const [allTags, setAllTags] = useState<string[]>([])
  const [allSeries, setAllSeries] = useState<string[]>([])
  const [savedPositions, setSavedPositions] = useState<Record<string, number>>({})
  const [savedShiurim, setSavedShiurim] = useState<string[]>([])
  const [downloadedShiurim, setDownloadedShiurim] = useState<string[]>([])
  const [rebbeimExpanded, setRebbeimExpanded] = useState(true)
  const [tagsExpanded, setTagsExpanded] = useState(true)
  const [seriesExpanded, setSeriesExpanded] = useState(true)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [showSavedOnly, setShowSavedOnly] = useState(false)
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "year-newest" | "year-oldest">("newest")
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const rebbeParam = searchParams.get("rebbe")
    if (rebbeParam) {
      setSelectedRebbeim([rebbeParam])
    }
    const seriesParam = searchParams.get("series")
    if (seriesParam) {
      setSelectedSeries([seriesParam])
    }
  }, [searchParams])

  // Auto-play shiur from URL param
  useEffect(() => {
    const playParam = searchParams.get("play")
    if (playParam && shiurim.length > 0 && !currentlyPlaying) {
      const shiur = shiurim.find((s) => s.id === playParam)
      if (shiur && shiur.audioUrl) {
        setCurrentlyPlaying(shiur.id)
        handlePlay(shiur.id)
      }
    }
  }, [searchParams, shiurim])

  useEffect(() => {
    const fetchShiurim = async () => {
      const shiurimRef = collection(db, "shiurim")
      const q = query(shiurimRef, orderBy("date", "desc"))
      const querySnapshot = await getDocs(q)
      const shiurimData: Shiur[] = []
      const rebbeimSet = new Set<string>()
      const tagsSet = new Set<string>()
      const seriesSet = new Set<string>()

      querySnapshot.forEach((doc) => {
        const data = doc.data()
        shiurimData.push({ id: doc.id, ...data } as Shiur)
        if (data.rebbe && data.rebbe.trim() !== "") {
          rebbeimSet.add(data.rebbe)
        }
        data.tags?.forEach((tag: string) => {
          if (tag && tag.trim() !== "") {
            tagsSet.add(tag)
          }
        })
        if (data.series && data.series.trim() !== "") {
          seriesSet.add(data.series)
        }
      })

      setShiurim(shiurimData)
      setFilteredShiurim(shiurimData)
      setRebbeim(Array.from(rebbeimSet).sort())
      setAllTags(Array.from(tagsSet).sort())
      setAllSeries(Array.from(seriesSet).sort())

      try {
        // Load saved shiurim with Firebase sync
        if (user?.uid) {
          console.log("[v0] User authenticated, syncing data from Firebase")
          const syncedSaved = await syncSavedShiurimOnLoad(user.uid)
          setSavedShiurim(syncedSaved)
          
          // Sync playback positions with Firebase
          const syncedPositions = await syncPlaybackPositionsOnLoad(user.uid)
          setSavedPositions(syncedPositions)
        } else {
          console.log("[v0] User not authenticated, loading from localStorage")
          setSavedShiurim(getSavedShiurimLocal())
          const positions = JSON.parse(localStorage.getItem("shiur-positions") || "{}")
          setSavedPositions(positions)
        }
        
        setDownloadedShiurim(getDownloadedShiurim())
      } catch (e) {
        console.error("[v0] Error loading data:", e)
      }
    }
    fetchShiurim()
  }, [user?.uid])

  useEffect(() => {
    let filtered = shiurim

    if (showSavedOnly) {
      filtered = filtered.filter((shiur) => savedShiurim.includes(shiur.id))
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (shiur) =>
          shiur.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          shiur.rebbe?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          shiur.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          shiur.series?.toLowerCase().includes(searchTerm.toLowerCase()), // Added series to search
      )
    }

    if (selectedRebbeim.length > 0) {
      filtered = filtered.filter((shiur) => selectedRebbeim.includes(shiur.rebbe))
    }

    if (selectedTags.length > 0) {
      filtered = filtered.filter((shiur) => shiur.tags?.some((tag) => selectedTags.includes(tag)))
    }

    if (selectedSeries.length > 0) {
      filtered = filtered.filter((shiur) => shiur.series && selectedSeries.includes(shiur.series))
    }

    // Sort results
    filtered = [...filtered].sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0
      const dateB = b.date ? new Date(b.date).getTime() : 0
      const yearA = a.date ? new Date(a.date).getFullYear() : 0
      const yearB = b.date ? new Date(b.date).getFullYear() : 0

      switch (sortBy) {
        case "oldest":
          return dateA - dateB
        case "year-newest":
          return yearB !== yearA ? yearB - yearA : dateB - dateA
        case "year-oldest":
          return yearA !== yearB ? yearA - yearB : dateA - dateB
        case "newest":
        default:
          return dateB - dateA
      }
    })

    setFilteredShiurim(filtered)
  }, [searchTerm, selectedRebbeim, selectedTags, selectedSeries, shiurim, showSavedOnly, savedShiurim, sortBy])

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleTimeUpdate = (shiurId: string) => {
    if (audioRef.current) {
      const currentTime = audioRef.current.currentTime
      if (Math.floor(currentTime) % 5 === 0) {
        // Hybrid sync: Update localStorage immediately + Firebase in background
        savePlaybackPositionHybrid(shiurId, currentTime, user?.uid || null)
        setSavedPositions((prev) => ({ ...prev, [shiurId]: currentTime }))
      }
    }
  }

  const handleAudioLoaded = (shiurId: string) => {
    if (audioRef.current) {
      const savedTime = getPlaybackPosition(shiurId)
      if (savedTime > 0) {
        audioRef.current.currentTime = savedTime
        setCurrentTime(savedTime) // Update persistent player state
      }
    }
  }

  const handleAudioEnded = (shiurId: string) => {
    // Hybrid sync: Clear from localStorage + Firebase
    clearPlaybackPositionHybrid(shiurId, user?.uid || null)
    setSavedPositions((prev) => {
      const newPositions = { ...prev }
      delete newPositions[shiurId]
      return newPositions
    })
    // Stop persistent player instead of just setting currentlyPlaying to null
    closePlayer()
  }

  const handleToggleSave = async (shiurId: string) => {
    // Hybrid approach: Update UI immediately, sync to Firebase
    const newSaved = await toggleSavedShiurHybrid(
      shiurId,
      (updated) => setSavedShiurim(updated),
      user?.uid || null
    )
    setSavedShiurim(newSaved)
  }

  const handleDownload = async (shiurId: string, audioUrl: string, title: string) => {
    setDownloadingId(shiurId)
    await trackDownload(shiurId, user)
    const newDownloaded = markAsDownloaded(shiurId)
    setDownloadedShiurim(newDownloaded)

    try {
      const fileId = getGoogleDriveFileId(audioUrl)
      const downloadUrl = fileId ? `https://drive.google.com/uc?export=download&id=${fileId}` : audioUrl

      const response = await fetch(downloadUrl)
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)

      const link = document.createElement("a")
      link.href = blobUrl
      link.download = `${title}.mp3`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Clean up blob URL after download starts
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
    } catch (error) {
      const fileId = getGoogleDriveFileId(audioUrl)
      const downloadUrl = fileId ? `https://drive.google.com/uc?export=download&id=${fileId}` : audioUrl
      window.open(downloadUrl, "_blank")
    } finally {
      setDownloadingId(null)
    }
  }

  const handlePlay = async (shiurId: string) => {
    await trackPlay(shiurId, user)
  }

  const toggleSeries = (series: string) => {
    setSelectedSeries((prev) => (prev.includes(series) ? prev.filter((s) => s !== series) : [...prev, series]))
  }

  const toggleRebbe = (rebbe: string) => {
    setSelectedRebbeim((prev) => (prev.includes(rebbe) ? prev.filter((r) => r !== rebbe) : [...prev, rebbe]))
  }

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  const clearAllFilters = () => {
    setSearchTerm("")
    setSelectedRebbeim([])
    setSelectedTags([])
    // Clear selected series
    setSelectedSeries([])
    setShowSavedOnly(false)
  }

  const activeFilterCount =
    selectedRebbeim.length + selectedTags.length + selectedSeries.length + (showSavedOnly ? 1 : 0)

  const handleSeriesClick = (series: string, e: React.MouseEvent) => {
    e.stopPropagation()
    router.push(`/shiurim?series=${encodeURIComponent(series)}`)
    setSelectedSeries([series])
  }

  const handleRebbeClick = (rebbe: string, e: React.MouseEvent) => {
    e.stopPropagation()
    router.push(`/shiurim?rebbe=${encodeURIComponent(rebbe)}`)
    setSelectedRebbeim([rebbe])
  }

  const FilterSidebar = ({ className = "" }: { className?: string }) => {
    const [localSearch, setLocalSearch] = useState(searchTerm)
    const localSearchRef = useRef<HTMLInputElement>(null)
    
    useEffect(() => {
      const timer = setTimeout(() => {
        setSearchTerm(localSearch)
      }, 300)
      return () => clearTimeout(timer)
    }, [localSearch])
    
    useEffect(() => {
      setLocalSearch(searchTerm)
    }, [searchTerm])
    
    return (
    <div className={`space-y-6 ${className}`}>
      {/* Search */}
      <div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={localSearchRef}
            placeholder="Search..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-10 bg-card border-border"
          />
        </div>
      </div>

      {/* Saved Filter */}
      <div className="flex items-center space-x-3 pb-4 border-b border-border">
        <Checkbox
          id="saved-only"
          checked={showSavedOnly}
          onCheckedChange={(checked) => setShowSavedOnly(checked === true)}
        />
        <label htmlFor="saved-only" className="text-sm font-medium cursor-pointer flex items-center gap-2">
          <BookmarkCheck className="h-4 w-4 text-gold" />
          Saved Only
        </label>
      </div>

      {allSeries.length > 0 && (
        <div>
          <button
            onClick={() => setSeriesExpanded(!seriesExpanded)}
            className="flex items-center justify-between w-full text-left font-semibold text-foreground mb-3"
          >
            <span className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Series
            </span>
            {seriesExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {seriesExpanded && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {allSeries.map((series) => (
                <div key={series} className="flex items-center space-x-3">
                  <Checkbox
                    id={`series-${series}`}
                    checked={selectedSeries.includes(series)}
                    onCheckedChange={() => toggleSeries(series)}
                  />
                  <label htmlFor={`series-${series}`} className="text-sm cursor-pointer truncate font-hebrew">
                    {series}
                  </label>
                </div>
              ))}
              {allSeries.length === 0 && <p className="text-sm text-muted-foreground">No series found</p>}
            </div>
          )}
        </div>
      )}

      {/* Rebbeim Filter */}
      <div>
        <button
          onClick={() => setRebbeimExpanded(!rebbeimExpanded)}
          className="flex items-center justify-between w-full text-left font-semibold text-foreground mb-3"
        >
          <span className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Rebbe
          </span>
          {rebbeimExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {rebbeimExpanded && (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {rebbeim.map((rebbe) => (
              <div key={rebbe} className="flex items-center space-x-3">
                <Checkbox
                  id={`rebbe-${rebbe}`}
                  checked={selectedRebbeim.includes(rebbe)}
                  onCheckedChange={() => toggleRebbe(rebbe)}
                />
                <label htmlFor={`rebbe-${rebbe}`} className="text-sm cursor-pointer truncate">
                  {rebbe}
                </label>
              </div>
            ))}
            {rebbeim.length === 0 && <p className="text-sm text-muted-foreground">No rebbeim found</p>}
          </div>
        )}
      </div>

      {/* Sort By */}
      <div className="mb-4 pb-4 border-b border-border">
        <label className="flex items-center gap-2 font-semibold text-foreground mb-3">
          <ArrowUpDown className="h-4 w-4" />
          Sort By
        </label>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="w-full p-2 rounded-lg border border-border bg-background text-sm"
        >
          <option value="newest">Date (Newest First)</option>
          <option value="oldest">Date (Oldest First)</option>
          <option value="year-newest">Year (Newest First)</option>
          <option value="year-oldest">Year (Oldest First)</option>
        </select>
      </div>

      {/* Tags Filter */}
      <div>
        <button
          onClick={() => setTagsExpanded(!tagsExpanded)}
          className="flex items-center justify-between w-full text-left font-semibold text-foreground mb-3"
        >
          <span>Topics</span>
          {tagsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {tagsExpanded && (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {allTags.map((tag) => (
              <div key={tag} className="flex items-center space-x-3">
                <Checkbox
                  id={`tag-${tag}`}
                  checked={selectedTags.includes(tag)}
                  onCheckedChange={() => toggleTag(tag)}
                />
                <label htmlFor={`tag-${tag}`} className="text-sm cursor-pointer truncate">
                  {tag}
                </label>
              </div>
            ))}
            {allTags.length === 0 && <p className="text-sm text-muted-foreground">No topics found</p>}
          </div>
        )}
      </div>

      {/* Clear Filters */}
      {activeFilterCount > 0 && (
        <Button variant="outline" onClick={clearAllFilters} className="w-full bg-transparent">
          Clear All Filters
        </Button>
      )}
    </div>
  )}

  const currentShiur = shiurim.find((s) => s.id === currentlyPlaying)
  const isGoogleDrive = currentShiur?.audioUrl ? getGoogleDriveFileId(currentShiur.audioUrl) !== null : false

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0]
      setCurrentTime(value[0])
    }
  }

  const handleVolumeChange = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.volume = value[0]
      setVolume(value[0])
    }
  }

  const skipBackward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 15)
    }
  }

  const skipForward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 15)
    }
  }

  const closePlayer = () => {
    if (audioRef.current) {
      audioRef.current.pause()
    }
    setCurrentlyPlaying(null)
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
  }

  const formatPlayerTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

  const handleSpeedChange = (speed: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed
    }
    setPlaybackSpeed(speed)
    setShowSpeedMenu(false)
  }

  const toggleMute = () => {
    if (audioRef.current) {
      if (volume > 0) {
        audioRef.current.volume = 0
        setVolume(0)
      } else {
        audioRef.current.volume = 1
        setVolume(1)
      }
    }
  }

  return (
    <AuthGuard>
      <div className={`min-h-screen bg-background ${currentlyPlaying ? "pb-32" : ""}`}>
        <Navbar />

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <header className="text-center mb-10">
            <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-3">Shiurim Archive</h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Browse and listen to Torah shiurim from our Rebbeim
            </p>
          </header>

          <div className="lg:hidden mb-4">
            <Button
              variant="outline"
              onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
              className="w-full justify-between"
            >
              <span className="flex items-center gap-2">
                Filter Shiurim
                {activeFilterCount > 0 && <Badge className="bg-gold text-navy">{activeFilterCount}</Badge>}
              </span>
              {mobileFiltersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            {mobileFiltersOpen && (
              <Card className="mt-3 p-4">
                <FilterSidebar />
              </Card>
            )}
          </div>

          {/* Active Filters Display */}
          {activeFilterCount > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {selectedRebbeim.map((rebbe) => (
                <Badge key={rebbe} variant="secondary" className="gap-1 bg-navy/10 text-navy">
                  <User className="h-3 w-3" />
                  {rebbe}
                  <button onClick={() => toggleRebbe(rebbe)} className="ml-1 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {selectedTags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1 bg-gold/10 text-gold-dark">
                  {tag}
                  <button onClick={() => toggleTag(tag)} className="ml-1 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {selectedSeries.map((series) => (
                <Badge key={series} variant="secondary" className="gap-1 bg-navy/20 text-navy font-hebrew">
                  <Layers className="h-3 w-3" />
                  {series}
                  <button onClick={() => toggleSeries(series)} className="ml-1 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {showSavedOnly && (
                <Badge variant="secondary" className="gap-1 bg-gold/10 text-gold-dark">
                  <BookmarkCheck className="h-3 w-3" />
                  Saved Only
                  <button onClick={() => setShowSavedOnly(false)} className="ml-1 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
          )}

          <div className="flex gap-8">
            {/* Sidebar - Desktop */}
            <aside className="hidden lg:block w-64 flex-shrink-0">
              <div className="sticky top-24 bg-card rounded-xl border border-border p-5 max-h-[calc(100vh-7rem)] overflow-y-auto">
                <FilterSidebar />
              </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredShiurim.map((shiur) => {
                  const isGoogleDrive = shiur.audioUrl ? getGoogleDriveFileId(shiur.audioUrl) !== null : false
                  const fileId = isGoogleDrive && shiur.audioUrl ? getGoogleDriveFileId(shiur.audioUrl) : null
                  const savedPosition = savedPositions[shiur.id]
                  const isSaved = savedShiurim.includes(shiur.id)
                  const isDownloaded = downloadedShiurim.includes(shiur.id)

                  return (
                    <Card
                      key={shiur.id}
                      className="group overflow-hidden border-border hover:shadow-lg transition-all duration-300"
                    >
                      <div className="h-1 bg-navy" />
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <h3 className="font-semibold text-foreground text-lg leading-snug line-clamp-2 flex-1 font-hebrew">
                            {shiur.title}
                          </h3>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 flex-shrink-0"
                            onClick={() => handleToggleSave(shiur.id)}
                          >
                            {isSaved ? (
                              <BookmarkCheck className="h-4 w-4 text-gold" />
                            ) : (
                              <Bookmark className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>

                        {shiur.rebbe && (
                          <button
                            onClick={(e) => handleRebbeClick(shiur.rebbe, e)}
                            className="text-base font-medium text-gold hover:text-gold/80 hover:underline transition-colors mb-2 block font-hebrew"
                          >
                            by {shiur.rebbe}
                          </button>
                        )}

                        {shiur.series && (
                          <button
                            onClick={(e) => handleSeriesClick(shiur.series!, e)}
                            className="inline-flex items-center gap-1.5 text-sm text-navy bg-navy/10 px-3 py-1.5 rounded-full mb-2 hover:bg-navy/20 transition-colors font-hebrew"
                          >
                            <Layers className="h-3 w-3" />
                            {shiur.series}
                          </button>
                        )}

                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                          <Clock className="h-3 w-3" />
                          {new Date(shiur.date).toLocaleDateString()}
                          {savedPosition && savedPosition > 0 && (
                            <span className="text-gold">Paused at {formatTime(savedPosition)}</span>
                          )}
                        </div>

                        {shiur.tags && shiur.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-4">
                            {shiur.tags.slice(0, 3).map((tag) => (
                              <Badge
                                key={tag}
                                variant="secondary"
                                className="text-xs bg-muted hover:bg-muted/80 cursor-pointer"
                                onClick={() => toggleTag(tag)}
                              >
                                {tag}
                              </Badge>
                            ))}
                            {shiur.tags.length > 3 && (
                              <Badge variant="secondary" className="text-xs bg-muted">
                                +{shiur.tags.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}

                        {/* Downloaded indicator */}
                        {isDownloaded && (
                          <div className="flex items-center gap-1 text-xs text-green-600 mb-3">
                            <CheckCircle2 className="h-3 w-3" />
                            Downloaded
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                          {shiur.audioUrl && (
                            <>
                              <Button
                                size="sm"
                                className="flex-1 bg-navy text-cream hover:bg-navy/90"
                                onClick={() => {
                                  setCurrentlyPlaying(shiur.id)
                                  handlePlay(shiur.id)
                                }}
                              >
                                <Play className="h-4 w-4 mr-1" />
                                Play
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={downloadingId === shiur.id}
                                onClick={() => handleDownload(shiur.id, shiur.audioUrl!, shiur.title)}
                              >
                                {downloadingId === shiur.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Download className="h-4 w-4" />
                                )}
                              </Button>
                            </>
                          )}
                          {shiur.pdfUrl && (
                            <Button size="sm" variant="outline" asChild>
                              <a href={shiur.pdfUrl} target="_blank" rel="noopener noreferrer">
                                <FileText className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {filteredShiurim.length === 0 && (
                <Card className="border-border bg-card">
                  <CardContent className="py-16 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                      <Headphones className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-2">
                      {showSavedOnly ? "No saved shiurim" : "No shiurim found"}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      {showSavedOnly ? "Bookmark shiurim to access them here" : "Try adjusting your search or filters"}
                    </p>
                    <Button variant="outline" onClick={clearAllFilters}>
                      {showSavedOnly ? "Browse All Shiurim" : "Clear Filters"}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </main>

        {/* Persistent Audio Player */}
        {currentlyPlaying && currentShiur && (
          <div className="fixed bottom-0 left-0 right-0 bg-navy text-cream border-t border-navy-light shadow-lg z-50">
            {!isGoogleDrive && currentShiur.audioUrl && (
              <audio
                ref={audioRef}
                src={getGoogleDriveDirectUrl(currentShiur.audioUrl)}
                onLoadedMetadata={(e) => {
                  setDuration(e.currentTarget.duration)
                  handleAudioLoaded(currentShiur.id)
                }}
                onTimeUpdate={(e) => {
                  setCurrentTime(e.currentTarget.currentTime)
                  handleTimeUpdate(currentShiur.id)
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => handleAudioEnded(currentShiur.id)}
                autoPlay
              />
            )}

            <div className="max-w-7xl mx-auto px-4 py-3">
              <div className="flex items-center gap-4">
                {/* Track Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate font-hebrew">{currentShiur.title}</p>
                  <p className="text-sm text-cream/70">{currentShiur.rebbe}</p>
                </div>

                {isGoogleDrive ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-cream/70">Google Drive audio</span>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="bg-gold text-navy hover:bg-gold/90"
                      onClick={() => {
                        const fileId = getGoogleDriveFileId(currentShiur.audioUrl!)
                        if (fileId) {
                          window.open(`https://drive.google.com/file/d/${fileId}/view`, "_blank")
                        }
                      }}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Open
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Playback Controls */}
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-cream hover:text-gold hover:bg-cream/10"
                        onClick={skipBackward}
                      >
                        <SkipBack className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        className="h-10 w-10 rounded-full bg-gold text-navy hover:bg-gold/90"
                        onClick={togglePlayPause}
                      >
                        {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-cream hover:text-gold hover:bg-cream/10"
                        onClick={skipForward}
                      >
                        <SkipForward className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Progress */}
                    <div className="hidden md:flex items-center gap-3 flex-1 max-w-md">
                      <span className="text-xs text-cream/70 w-10 text-right">{formatPlayerTime(currentTime)}</span>
                      <Slider
                        value={[currentTime]}
                        max={duration || 100}
                        step={1}
                        onValueChange={handleSeek}
                        className="flex-1 [&_[role=slider]]:bg-gold [&_[role=slider]]:border-gold [&_.bg-primary]:bg-gold"
                      />
                      <span className="text-xs text-cream/70 w-10">{formatPlayerTime(duration)}</span>
                    </div>

                    {/* Speed Control */}
                    <div className="relative">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-cream hover:text-gold hover:bg-cream/10 gap-1"
                        onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                      >
                        <Gauge className="h-4 w-4" />
                        {playbackSpeed}x
                      </Button>
                      {showSpeedMenu && (
                        <div className="absolute bottom-full right-0 mb-2 bg-navy-light border border-navy-lighter rounded-lg shadow-lg py-1 min-w-[80px]">
                          {speedOptions.map((speed) => (
                            <button
                              key={speed}
                              onClick={() => handleSpeedChange(speed)}
                              className={`w-full px-3 py-1.5 text-sm text-left hover:bg-cream/10 ${
                                playbackSpeed === speed ? "text-gold" : "text-cream"
                              }`}
                            >
                              {speed}x
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Volume */}
                    <div className="hidden md:flex items-center gap-2 bg-navy-light/50 rounded-full px-3 py-1.5">
                      <button onClick={toggleMute} className="text-cream hover:text-gold transition-colors">
                        {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                      </button>
                      <Slider
                        value={[volume]}
                        max={1}
                        step={0.1}
                        onValueChange={handleVolumeChange}
                        className="w-20 [&_[role=slider]]:bg-gold [&_[role=slider]]:border-gold [&_.bg-primary]:bg-gold"
                      />
                    </div>
                  </>
                )}

                {/* Close */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-cream hover:text-gold hover:bg-cream/10"
                  onClick={closePlayer}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {/* Mobile seek bar */}
              {!isGoogleDrive && currentShiur.audioUrl && (
                <div className="mt-2 md:hidden">
                  <Slider
                    value={[currentTime]}
                    max={duration || 100}
                    step={1}
                    onValueChange={handleSeek}
                    className="[&_[role=slider]]:bg-gold [&_[role=slider]]:border-gold [&_.bg-primary]:bg-gold"
                  />
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-cream/70">{formatPlayerTime(currentTime)}</span>
                    <span className="text-xs text-cream/70">{formatPlayerTime(duration)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  )
}
