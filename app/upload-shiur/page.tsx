"use client"

import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type React from "react"
import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { db } from "@/lib/firebase"
import { collection, addDoc, doc, getDoc, setDoc } from "firebase/firestore"
import { uploadToB2 } from "@/lib/b2-upload"
import { useToast } from "@/hooks/use-toast"
import { getUserFriendlyError, checkFirestoreReachable } from "@/lib/utils"
import { Loader2, CheckCircle, Plus, X, UploadIcon, Trash2, ListPlus } from "lucide-react"

type UploadStatus = "idle" | "uploading-audio" | "uploading-pdf" | "saving" | "complete" | "error"

interface BulkShiurEntry {
  id: string
  title: string
  rebbe: string
  date: string
  tags: string[]
  description: string
  audioFile: File | null
  pdfFile: File | null
  status: UploadStatus
  error?: string
  progress: number
  series: string
  uploaderName: string
}

export default function UploadShiurPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  // Single upload state
  const [formData, setFormData] = useState({
    title: "",
    rebbe: "",
    date: "",
    description: "",
    series: "",
    uploaderName: "",
  })
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle")
  const [uploadProgress, setUploadProgress] = useState(0)

  // Background (parallel) upload state for audio + pdf
  const [audioBgStatus, setAudioBgStatus] = useState<"idle" | "uploading" | "complete" | "error">("idle")
  const [audioBgProgress, setAudioBgProgress] = useState(0)
  const [audioBgUrl, setAudioBgUrl] = useState<string | null>(null)
  const [audioBgError, setAudioBgError] = useState<string | null>(null)
  const audioPromiseRef = useRef<Promise<string> | null>(null)

  const [pdfBgStatus, setPdfBgStatus] = useState<"idle" | "uploading" | "complete" | "error">("idle")
  const [pdfBgProgress, setPdfBgProgress] = useState(0)
  const [pdfBgUrl, setPdfBgUrl] = useState<string | null>(null)
  const [pdfBgError, setPdfBgError] = useState<string | null>(null)
  const pdfPromiseRef = useRef<Promise<string> | null>(null)

  // Options state
  const [rebbeimOptions, setRebbeimOptions] = useState<string[]>([])
  const [tagsOptions, setTagsOptions] = useState<string[]>([])
  const [seriesOptions, setSeriesOptions] = useState<string[]>([])
  const [newRebbe, setNewRebbe] = useState("")
  const [newTag, setNewTag] = useState("")
  const [newSeries, setNewSeries] = useState("")
  const [showAddRebbe, setShowAddRebbe] = useState(false)
  const [showAddTag, setShowAddTag] = useState(false)
  const [showAddSeries, setShowAddSeries] = useState(false)

  // Bulk upload state
  const [bulkEntries, setBulkEntries] = useState<BulkShiurEntry[]>([])
  const [bulkUploading, setBulkUploading] = useState(false)
  const [activeTab, setActiveTab] = useState("single")

  useEffect(() => {
    fetchOptions()
  }, [])

  const fetchOptions = async () => {
    try {
      const optionsDoc = await getDoc(doc(db, "settings", "shiurOptions"))
      if (optionsDoc.exists()) {
        const data = optionsDoc.data()
        setRebbeimOptions(data.rebbeim || [])
        setTagsOptions(data.tags || [])
        setSeriesOptions(data.series || [])
      }
    } catch (error) {
      console.error("Error fetching options:", error)
    }
  }

  const saveOptions = async (newRebbeim: string[], newTags: string[], newSeriesList?: string[]) => {
    try {
      await setDoc(doc(db, "settings", "shiurOptions"), {
        rebbeim: newRebbeim,
        tags: newTags,
        series: newSeriesList || seriesOptions,
      })
    } catch (error: any) {
      toast({ title: "Unable to save", description: getUserFriendlyError(error), variant: "destructive" })
    }
  }

  const handleAddRebbe = async () => {
    if (!newRebbe.trim()) return
    try {
      const updatedList = [...rebbeimOptions, newRebbe.trim()].sort()
      await saveOptions(updatedList, tagsOptions, seriesOptions)
      setRebbeimOptions(updatedList)
      setFormData({ ...formData, rebbe: newRebbe.trim() })
      setNewRebbe("")
      setShowAddRebbe(false)
      toast({ title: "Rebbe added to list" })
    } catch (error) {
      console.error("Error adding rebbe:", error)
      toast({ title: "Error adding rebbe", variant: "destructive" })
    }
  }

  const handleAddTag = async () => {
    if (!newTag.trim()) return
    try {
      const updatedList = [...tagsOptions, newTag.trim()].sort()
      await saveOptions(rebbeimOptions, updatedList, seriesOptions)
      setTagsOptions(updatedList)
      setSelectedTags([...selectedTags, newTag.trim()])
      setNewTag("")
      setShowAddTag(false)
      toast({ title: "Tag added to list" })
    } catch (error) {
      console.error("Error adding tag:", error)
      toast({ title: "Error adding tag", variant: "destructive" })
    }
  }

  const handleAddSeries = async () => {
    if (!newSeries.trim()) return
    try {
      const updatedList = [...seriesOptions, newSeries.trim()].sort()
      await saveOptions(rebbeimOptions, tagsOptions, updatedList)
      setSeriesOptions(updatedList)
      setFormData({ ...formData, series: newSeries.trim() })
      setNewSeries("")
      setShowAddSeries(false)
      toast({ title: "Series added to list" })
    } catch (error) {
      console.error("Error adding series:", error)
      toast({ title: "Error adding series", variant: "destructive" })
    }
  }

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  const uploadFile = async (
    file: File,
    type: "audio" | "pdf",
    onProgress?: (percent: number) => void,
  ): Promise<string> => {
    const folder = type === "audio" ? "shiurim/audio" : "shiurim/pdf"
    const url = await uploadToB2(file, folder, onProgress)
    return url
  }

  // Start the audio upload immediately when a file is picked, in parallel with form filling
  const handleAudioFileChange = async (file: File | null) => {
    setAudioFile(file)
    setAudioBgUrl(null)
    setAudioBgError(null)
    setAudioBgProgress(0)
    audioPromiseRef.current = null

    if (!file) {
      setAudioBgStatus("idle")
      return
    }

    // Pre-flight check so we don't start a long upload that will be silently blocked
    const reachable = await checkFirestoreReachable()
    if (!reachable) {
      setAudioBgStatus("error")
      setAudioBgError(
        "A browser extension (ad blocker or privacy extension) appears to be blocking uploads. Please disable it for this site or try a different browser.",
      )
      toast({
        title: "Connection Blocked",
        description: "An ad blocker or privacy extension is blocking the upload. Please disable it for this site.",
        variant: "destructive",
      })
      return
    }

    setAudioBgStatus("uploading")
    const promise = uploadFile(file, "audio", (p) => setAudioBgProgress(p))
      .then((url) => {
        setAudioBgUrl(url)
        setAudioBgStatus("complete")
        setAudioBgProgress(100)
        return url
      })
      .catch((err) => {
        console.error("Audio upload error:", err)
        setAudioBgStatus("error")
        setAudioBgError(getUserFriendlyError(err))
        throw err
      })
    audioPromiseRef.current = promise
  }

  const handlePdfFileChange = async (file: File | null) => {
    setPdfFile(file)
    setPdfBgUrl(null)
    setPdfBgError(null)
    setPdfBgProgress(0)
    pdfPromiseRef.current = null

    if (!file) {
      setPdfBgStatus("idle")
      return
    }

    setPdfBgStatus("uploading")
    const promise = uploadFile(file, "pdf", (p) => setPdfBgProgress(p))
      .then((url) => {
        setPdfBgUrl(url)
        setPdfBgStatus("complete")
        setPdfBgProgress(100)
        return url
      })
      .catch((err) => {
        console.error("PDF upload error:", err)
        setPdfBgStatus("error")
        setPdfBgError(getUserFriendlyError(err))
        throw err
      })
    pdfPromiseRef.current = promise
  }

  const retryAudioUpload = () => {
    if (audioFile) handleAudioFileChange(audioFile)
  }

  const retryPdfUpload = () => {
    if (pdfFile) handlePdfFileChange(pdfFile)
  }

  const getStatusLabel = (status: UploadStatus) => {
    switch (status) {
      case "uploading-audio":
        return "Uploading audio..."
      case "uploading-pdf":
        return "Uploading PDF..."
      case "saving":
        return "Saving to database..."
      case "complete":
        return "Complete!"
      default:
        return ""
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.uploaderName.trim()) {
      toast({ title: "Please enter your name", variant: "destructive" })
      return
    }

    // Pre-flight check: detect ad blockers / privacy extensions before starting a long upload
    const reachable = await checkFirestoreReachable()
    if (!reachable) {
      toast({
        title: "Connection Blocked",
        description:
          "A browser extension (ad blocker or privacy extension) appears to be blocking the upload. Please disable it for this site or try a different browser, then try again.",
        variant: "destructive",
      })
      return
    }

    if (!audioFile && !audioBgUrl) {
      toast({ title: "Please select an audio file", variant: "destructive" })
      return
    }

    if (audioBgStatus === "error") {
      toast({
        title: "Audio upload failed",
        description: audioBgError || "Please remove and re-select the audio file, then try again.",
        variant: "destructive",
      })
      return
    }

    if (pdfBgStatus === "error") {
      toast({
        title: "PDF upload failed",
        description: pdfBgError || "Please remove and re-select the PDF, then try again.",
        variant: "destructive",
      })
      return
    }

    setUploading(true)
    setUploadProgress(0)

    try {
      let audioUrl = ""
      let pdfUrl = ""

      // Audio: use already-uploaded URL if available, otherwise wait for in-flight upload, else upload now
      if (audioFile) {
        if (audioBgUrl) {
          audioUrl = audioBgUrl
          setUploadProgress(60)
        } else if (audioPromiseRef.current) {
          setUploadStatus("uploading-audio")
          // Mirror background progress into the submit progress bar
          const mirror = setInterval(() => setUploadProgress(audioBgProgress * 0.6), 200)
          try {
            audioUrl = await audioPromiseRef.current
          } finally {
            clearInterval(mirror)
          }
          setUploadProgress(60)
        } else {
          setUploadStatus("uploading-audio")
          audioUrl = await uploadFile(audioFile, "audio", (p) => setUploadProgress(p * 0.6))
        }
      } else {
        setUploadProgress(60)
      }

      // PDF: same pattern
      if (pdfFile) {
        if (pdfBgUrl) {
          pdfUrl = pdfBgUrl
          setUploadProgress(90)
        } else if (pdfPromiseRef.current) {
          setUploadStatus("uploading-pdf")
          const mirror = setInterval(() => setUploadProgress(60 + pdfBgProgress * 0.3), 200)
          try {
            pdfUrl = await pdfPromiseRef.current
          } finally {
            clearInterval(mirror)
          }
          setUploadProgress(90)
        } else {
          setUploadStatus("uploading-pdf")
          pdfUrl = await uploadFile(pdfFile, "pdf", (p) => setUploadProgress(60 + p * 0.3))
        }
      } else {
        setUploadProgress(90)
      }

      setUploadStatus("saving")
      setUploadProgress(95)

      const shiurData = {
        title: formData.title,
        rebbe: formData.rebbe,
        date: formData.date,
        tags: selectedTags,
        description: formData.description,
        series: formData.series || null,
        audioUrl,
        pdfUrl,
        uploadedBy: user?.email || "unknown",
        uploaderName: formData.uploaderName.trim(),
        uploadedAt: new Date().toISOString(),
      }

      await addDoc(collection(db, "shiurim"), shiurData)

      setUploadStatus("complete")
      setUploadProgress(100)
      toast({ title: "Shiur uploaded successfully!", description: "Thank you for sharing." })

      setTimeout(() => {
        router.push("/shiurim")
      }, 1500)
    } catch (error: any) {
      console.error("Error uploading shiur:", error)
      setUploadStatus("error")
      toast({ title: "Unable to upload shiur", description: getUserFriendlyError(error), variant: "destructive" })
      setUploading(false)
    }
  }

  // Bulk upload functions
  const createEmptyBulkEntry = (): BulkShiurEntry => ({
    id: Math.random().toString(36).substr(2, 9),
    title: "",
    rebbe: "",
    date: "",
    tags: [],
    description: "",
    audioFile: null,
    pdfFile: null,
    status: "idle",
    progress: 0,
    series: "",
    uploaderName: "",
  })

  const addBulkEntry = () => {
    setBulkEntries([...bulkEntries, createEmptyBulkEntry()])
  }

  const removeBulkEntry = (id: string) => {
    setBulkEntries(bulkEntries.filter((e) => e.id !== id))
  }

  const updateBulkEntry = (id: string, updates: Partial<BulkShiurEntry>) => {
    setBulkEntries(bulkEntries.map((e) => (e.id === id ? { ...e, ...updates } : e)))
  }

  const toggleBulkTag = (entryId: string, tag: string) => {
    const entry = bulkEntries.find((e) => e.id === entryId)
    if (!entry) return
    const newTags = entry.tags.includes(tag) ? entry.tags.filter((t) => t !== tag) : [...entry.tags, tag]
    updateBulkEntry(entryId, { tags: newTags })
  }

  const handleBulkUpload = async () => {
    // Validate all entries have uploader name
    const missingNames = bulkEntries.some(e => !e.uploaderName.trim())
    if (missingNames) {
      toast({ title: "Please enter your name for all entries", variant: "destructive" })
      return
    }

    // Pre-flight check: detect ad blockers before starting bulk upload
    const reachable = await checkFirestoreReachable()
    if (!reachable) {
      toast({
        title: "Connection Blocked",
        description:
          "A browser extension (ad blocker or privacy extension) appears to be blocking the upload. Please disable it for this site or try a different browser, then try again.",
        variant: "destructive",
      })
      return
    }

    setBulkUploading(true)

    for (let i = 0; i < bulkEntries.length; i++) {
      const entry = bulkEntries[i]
      if (!entry.title || !entry.rebbe || !entry.date) {
        updateBulkEntry(entry.id, { status: "error", error: "Missing required fields" })
        continue
      }

      try {
        updateBulkEntry(entry.id, { status: "uploading-audio", progress: 10 })

        let audioUrl = ""
        let pdfUrl = ""

        if (entry.audioFile) {
          audioUrl = await uploadFile(entry.audioFile, "audio", (p) => {
            updateBulkEntry(entry.id, { progress: 10 + p * 0.5 })
          })
        }
        updateBulkEntry(entry.id, { progress: 60 })

        if (entry.pdfFile) {
          updateBulkEntry(entry.id, { status: "uploading-pdf", progress: 60 })
          pdfUrl = await uploadFile(entry.pdfFile, "pdf", (p) => {
            updateBulkEntry(entry.id, { progress: 60 + p * 0.3 })
          })
        }

        updateBulkEntry(entry.id, { status: "saving", progress: 90 })

        await addDoc(collection(db, "shiurim"), {
          title: entry.title,
          rebbe: entry.rebbe,
          date: entry.date,
          tags: entry.tags,
          description: entry.description,
          series: entry.series || null,
          audioUrl,
          pdfUrl,
          uploadedBy: user?.email || "unknown",
          uploaderName: entry.uploaderName.trim(),
          uploadedAt: new Date().toISOString(),
        })

        updateBulkEntry(entry.id, { status: "complete", progress: 100 })
      } catch (error: any) {
        updateBulkEntry(entry.id, { status: "error", error: getUserFriendlyError(error), progress: 0 })
      }
    }

    setBulkUploading(false)

    const completed = bulkEntries.filter((e) => e.status === "complete").length
    toast({ title: `Uploaded ${completed} of ${bulkEntries.length} shiurim` })
    
    if (completed === bulkEntries.length) {
      setTimeout(() => {
        router.push("/shiurim")
      }, 1500)
    }
  }

  const applyToAllBulk = (field: "rebbe" | "series" | "uploaderName", value: string) => {
    setBulkEntries(bulkEntries.map(e => ({ ...e, [field]: value })))
    toast({ title: `Applied to all entries` })
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cream via-cream to-gold/10 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-navy mx-auto mb-4" />
          <p className="text-navy/70">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream via-cream to-gold/10">
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <UploadIcon className="h-8 w-8 text-gold" />
            <h1 className="font-serif text-4xl font-bold text-navy">Upload Shiurim</h1>
          </div>
          <p className="text-navy/70">Share your shiurim with the alumni network</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white border border-gold/20">
            <TabsTrigger value="single" className="data-[state=active]:bg-navy data-[state=active]:text-cream">
              <UploadIcon className="h-4 w-4 mr-2" />
              Single Upload
            </TabsTrigger>
            <TabsTrigger value="bulk" className="data-[state=active]:bg-navy data-[state=active]:text-cream">
              <ListPlus className="h-4 w-4 mr-2" />
              Bulk Upload
            </TabsTrigger>
          </TabsList>

          {/* Single Upload Tab */}
          <TabsContent value="single">
            <div className="bg-white rounded-lg shadow-lg border-2 border-gold/20 p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Files first - upload starts immediately so it runs while you fill out the rest */}
                <div className="space-y-4 p-5 rounded-lg border-2 border-navy/20 bg-navy/[0.03]">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-navy font-bold text-lg">Step 1 - Upload Files First</h3>
                      <p className="text-xs text-navy/60 mt-0.5">
                        Pick your audio file now and it will upload in the background while you fill out the details below.
                      </p>
                    </div>
                  </div>

                  {/* Audio File */}
                  <div className="space-y-2">
                    <Label className="text-navy font-semibold">Audio File *</Label>
                    <Input
                      type="file"
                      accept="audio/*"
                      required
                      onChange={(e) => handleAudioFileChange(e.target.files?.[0] || null)}
                      disabled={audioBgStatus === "uploading" || uploading}
                      className="border-gold/30 bg-white"
                    />
                    {audioFile && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-navy/70 truncate flex-1 mr-2 flex items-center gap-1.5">
                            {audioBgStatus === "uploading" && <Loader2 className="h-3 w-3 animate-spin text-navy/60 flex-shrink-0" />}
                            {audioBgStatus === "complete" && <CheckCircle className="h-3 w-3 text-green-600 flex-shrink-0" />}
                            <span className="truncate">{audioFile.name}</span>
                          </span>
                          <span className="font-medium flex-shrink-0">
                            {audioBgStatus === "uploading" && (
                              <span className="text-navy">{Math.round(audioBgProgress)}%</span>
                            )}
                            {audioBgStatus === "complete" && (
                              <span className="text-green-700">Uploaded</span>
                            )}
                            {audioBgStatus === "error" && (
                              <span className="text-red-600">Failed</span>
                            )}
                          </span>
                        </div>
                        {audioBgStatus === "uploading" && (
                          <Progress value={audioBgProgress} className="h-1.5" />
                        )}
                        {audioBgStatus === "error" && (
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-red-600 flex-1">{audioBgError}</span>
                            <Button type="button" variant="outline" size="sm" onClick={retryAudioUpload} className="h-7 text-xs">
                              Retry
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Mareh Mekomos PDF */}
                  <div className="space-y-2">
                    <Label className="text-navy font-semibold">Mareh Mekomos (PDF) - Optional</Label>
                    <Input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => handlePdfFileChange(e.target.files?.[0] || null)}
                      disabled={pdfBgStatus === "uploading" || uploading}
                      className="border-gold/30 bg-white"
                    />
                    {pdfFile && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-navy/70 truncate flex-1 mr-2 flex items-center gap-1.5">
                            {pdfBgStatus === "uploading" && <Loader2 className="h-3 w-3 animate-spin text-navy/60 flex-shrink-0" />}
                            {pdfBgStatus === "complete" && <CheckCircle className="h-3 w-3 text-green-600 flex-shrink-0" />}
                            <span className="truncate">{pdfFile.name}</span>
                          </span>
                          <span className="font-medium flex-shrink-0">
                            {pdfBgStatus === "uploading" && (
                              <span className="text-navy">{Math.round(pdfBgProgress)}%</span>
                            )}
                            {pdfBgStatus === "complete" && (
                              <span className="text-green-700">Uploaded</span>
                            )}
                            {pdfBgStatus === "error" && (
                              <span className="text-red-600">Failed</span>
                            )}
                          </span>
                        </div>
                        {pdfBgStatus === "uploading" && (
                          <Progress value={pdfBgProgress} className="h-1.5" />
                        )}
                        {pdfBgStatus === "error" && (
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-red-600 flex-1">{pdfBgError}</span>
                            <Button type="button" variant="outline" size="sm" onClick={retryPdfUpload} className="h-7 text-xs">
                              Retry
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 2 marker */}
                <div className="pt-2">
                  <h3 className="text-navy font-bold text-lg">Step 2 - Shiur Details</h3>
                  <p className="text-xs text-navy/60 mt-0.5">Fill these in while your file uploads.</p>
                </div>

                {/* Uploader Name */}
                <div className="space-y-2 p-4 bg-gold/5 rounded-lg border border-gold/20">
                  <Label htmlFor="uploaderName" className="text-navy font-semibold">
                    Your Name *
                  </Label>
                  <Input
                    id="uploaderName"
                    required
                    value={formData.uploaderName}
                    onChange={(e) => setFormData({ ...formData, uploaderName: e.target.value })}
                    placeholder="Enter your name (visible to admins)"
                    className="border-gold/30"
                  />
                  <p className="text-xs text-navy/50">This helps admins know who uploaded each shiur</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title" className="text-navy font-semibold">
                    Title *
                  </Label>
                  <Input
                    id="title"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Shiur title"
                    className="border-gold/30"
                  />
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  {/* Rebbe Selection */}
                  <div className="space-y-2">
                    <Label className="text-navy font-semibold">Rebbe *</Label>
                    {showAddRebbe ? (
                      <div className="flex gap-2">
                        <Input
                          value={newRebbe}
                          onChange={(e) => setNewRebbe(e.target.value)}
                          placeholder="New rebbe name"
                          className="border-gold/30"
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddRebbe())}
                        />
                        <Button type="button" onClick={handleAddRebbe} size="sm" className="bg-navy text-cream">
                          Add
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddRebbe(false)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Select
                          value={formData.rebbe}
                          onValueChange={(value) => setFormData({ ...formData, rebbe: value })}
                        >
                          <SelectTrigger className="flex-1 border-gold/30">
                            <SelectValue placeholder="Select Rebbe" />
                          </SelectTrigger>
                          <SelectContent>
                            {rebbeimOptions.map((rebbe) => (
                              <SelectItem key={rebbe} value={rebbe}>
                                {rebbe}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setShowAddRebbe(true)}
                          title="Add new rebbe"
                          className="border-gold/30"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="date" className="text-navy font-semibold">
                      Date *
                    </Label>
                    <Input
                      id="date"
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="border-gold/30"
                    />
                  </div>
                </div>

                {/* Series Selection */}
                <div className="space-y-2">
                  <Label className="text-navy font-semibold">Series (Optional)</Label>
                  {showAddSeries ? (
                    <div className="flex gap-2">
                      <Input
                        value={newSeries}
                        onChange={(e) => setNewSeries(e.target.value)}
                        placeholder="New series name"
                        className="border-gold/30"
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddSeries())}
                      />
                      <Button type="button" onClick={handleAddSeries} size="sm" className="bg-navy text-cream">
                        Add
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddSeries(false)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Select
                        value={formData.series}
                        onValueChange={(value) => setFormData({ ...formData, series: value === "none" ? "" : value })}
                      >
                        <SelectTrigger className="flex-1 border-gold/30">
                          <SelectValue placeholder="Select Series (Optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Series</SelectItem>
                          {seriesOptions.map((series) => (
                            <SelectItem key={series} value={series}>
                              {series}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setShowAddSeries(true)}
                        title="Add new series"
                        className="border-gold/30"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <p className="text-xs text-navy/50">Group related shiurim together in a series</p>
                </div>

                {/* Tags */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-navy font-semibold">Tags</Label>
                    {showAddTag ? (
                      <div className="flex gap-2 items-center">
                        <Input
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          placeholder="New tag"
                          className="w-32 h-8 text-sm border-gold/30"
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                        />
                        <Button type="button" onClick={handleAddTag} size="sm" className="h-8 bg-navy text-cream text-xs">
                          Add
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8"
                          onClick={() => setShowAddTag(false)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAddTag(true)}
                        className="text-xs"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Tag
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tagsOptions.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`px-3 py-1 rounded-full text-sm transition-colors ${
                          selectedTags.includes(tag)
                            ? "bg-navy text-cream"
                            : "bg-cream border border-gold/30 text-navy hover:border-gold"
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                    {tagsOptions.length === 0 && <p className="text-sm text-navy/50">No tags yet. Add one above.</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-navy font-semibold">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of the shiur"
                    rows={3}
                    className="border-gold/30"
                  />
                </div>

                {uploadStatus !== "idle" && uploadStatus !== "error" && (
                  <div className="space-y-2 p-4 bg-gold/5 rounded-lg border border-gold/20">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-navy/70 flex items-center gap-2">
                        {uploadStatus === "complete" ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        {getStatusLabel(uploadStatus)}
                      </span>
                      <span className="text-navy font-medium">{Math.round(uploadProgress)}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={uploading || audioBgStatus === "error" || pdfBgStatus === "error"}
                  className="w-full bg-navy text-cream hover:bg-navy/90 h-12 text-lg font-semibold"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {audioBgStatus === "uploading"
                        ? `Waiting for audio (${Math.round(audioBgProgress)}%)...`
                        : getStatusLabel(uploadStatus)}
                    </>
                  ) : (
                    <>
                      <UploadIcon className="mr-2 h-5 w-5" />
                      {audioBgStatus === "uploading"
                        ? `Submit (audio still uploading - ${Math.round(audioBgProgress)}%)`
                        : "Upload Shiur"}
                    </>
                  )}
                </Button>
              </form>
            </div>
          </TabsContent>

          {/* Bulk Upload Tab */}
          <TabsContent value="bulk">
            <div className="space-y-6">
              {/* Quick Apply Section */}
              {bulkEntries.length > 0 && (
                <Card className="bg-gold/5 border-gold/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg text-navy">Quick Apply to All</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label className="text-sm text-navy/70">Uploader Name</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Your name"
                            id="bulkUploaderName"
                            className="border-gold/30"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const input = document.getElementById("bulkUploaderName") as HTMLInputElement
                              if (input.value) applyToAllBulk("uploaderName", input.value)
                            }}
                            className="border-gold/30"
                          >
                            Apply
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-navy/70">Rebbe</Label>
                        <div className="flex gap-2">
                          <Select onValueChange={(val) => applyToAllBulk("rebbe", val)}>
                            <SelectTrigger className="border-gold/30">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {rebbeimOptions.map((r) => (
                                <SelectItem key={r} value={r}>{r}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-navy/70">Series</Label>
                        <div className="flex gap-2">
                          <Select onValueChange={(val) => applyToAllBulk("series", val === "none" ? "" : val)}>
                            <SelectTrigger className="border-gold/30">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No Series</SelectItem>
                              {seriesOptions.map((s) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Bulk Entries */}
              {bulkEntries.length === 0 ? (
                <Card className="bg-white border-gold/20">
                  <CardContent className="py-12 text-center">
                    <ListPlus className="h-12 w-12 text-gold/50 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-navy mb-2">No shiurim added yet</h3>
                    <p className="text-navy/60 mb-4">Add multiple shiurim to upload them all at once</p>
                    <Button onClick={addBulkEntry} className="bg-navy text-cream hover:bg-navy/90">
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Shiur
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {bulkEntries.map((entry, index) => (
                    <Card key={entry.id} className={`bg-white border-2 ${
                      entry.status === "complete" ? "border-green-500/50" :
                      entry.status === "error" ? "border-red-500/50" :
                      "border-gold/20"
                    }`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg text-navy">
                            Shiur #{index + 1}
                            {entry.status === "complete" && <CheckCircle className="inline ml-2 h-5 w-5 text-green-600" />}
                          </CardTitle>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeBulkEntry(entry.id)}
                            disabled={bulkUploading}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Uploader Name */}
                        <div className="space-y-2">
                          <Label className="text-navy font-semibold text-sm">Your Name *</Label>
                          <Input
                            value={entry.uploaderName}
                            onChange={(e) => updateBulkEntry(entry.id, { uploaderName: e.target.value })}
                            placeholder="Enter your name"
                            className="border-gold/30"
                            disabled={bulkUploading}
                          />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label className="text-navy font-semibold text-sm">Title *</Label>
                            <Input
                              value={entry.title}
                              onChange={(e) => updateBulkEntry(entry.id, { title: e.target.value })}
                              placeholder="Shiur title"
                              className="border-gold/30"
                              disabled={bulkUploading}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-navy font-semibold text-sm">Date *</Label>
                            <Input
                              type="date"
                              value={entry.date}
                              onChange={(e) => updateBulkEntry(entry.id, { date: e.target.value })}
                              className="border-gold/30"
                              disabled={bulkUploading}
                            />
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label className="text-navy font-semibold text-sm">Rebbe *</Label>
                            <Select
                              value={entry.rebbe}
                              onValueChange={(val) => updateBulkEntry(entry.id, { rebbe: val })}
                              disabled={bulkUploading}
                            >
                              <SelectTrigger className="border-gold/30">
                                <SelectValue placeholder="Select Rebbe" />
                              </SelectTrigger>
                              <SelectContent>
                                {rebbeimOptions.map((r) => (
                                  <SelectItem key={r} value={r}>{r}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-navy font-semibold text-sm">Series</Label>
                            <Select
                              value={entry.series || "none"}
                              onValueChange={(val) => updateBulkEntry(entry.id, { series: val === "none" ? "" : val })}
                              disabled={bulkUploading}
                            >
                              <SelectTrigger className="border-gold/30">
                                <SelectValue placeholder="Select Series" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No Series</SelectItem>
                                {seriesOptions.map((s) => (
                                  <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-navy font-semibold text-sm">Tags</Label>
                          <div className="flex flex-wrap gap-2">
                            {tagsOptions.map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => toggleBulkTag(entry.id, tag)}
                                disabled={bulkUploading}
                                className={`px-2 py-1 rounded-full text-xs transition-colors ${
                                  entry.tags.includes(tag)
                                    ? "bg-navy text-cream"
                                    : "bg-cream border border-gold/30 text-navy hover:border-gold"
                                }`}
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label className="text-navy font-semibold text-sm">Audio File *</Label>
                            <Input
                              type="file"
                              accept="audio/*"
                              onChange={(e) => updateBulkEntry(entry.id, { audioFile: e.target.files?.[0] || null })}
                              className="border-gold/30"
                              disabled={bulkUploading}
                            />
                            {entry.audioFile && (
                              <p className="text-xs text-navy/60">{entry.audioFile.name}</p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label className="text-navy font-semibold text-sm">PDF (Optional)</Label>
                            <Input
                              type="file"
                              accept=".pdf"
                              onChange={(e) => updateBulkEntry(entry.id, { pdfFile: e.target.files?.[0] || null })}
                              className="border-gold/30"
                              disabled={bulkUploading}
                            />
                            {entry.pdfFile && (
                              <p className="text-xs text-navy/60">{entry.pdfFile.name}</p>
                            )}
                          </div>
                        </div>

                        {/* Progress/Status */}
                        {entry.status !== "idle" && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className={`flex items-center gap-2 ${entry.status === "error" ? "text-red-600" : "text-navy/70"}`}>
                                {entry.status === "complete" ? (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                ) : entry.status === "error" ? (
                                  <X className="h-4 w-4" />
                                ) : (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                )}
                                {entry.status === "error" ? entry.error : getStatusLabel(entry.status)}
                              </span>
                              <span className="text-navy font-medium">{Math.round(entry.progress)}%</span>
                            </div>
                            <Progress value={entry.progress} className="h-2" />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={addBulkEntry}
                  disabled={bulkUploading}
                  className="border-gold/30"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Another Shiur
                </Button>
                
                {bulkEntries.length > 0 && (
                  <Button
                    type="button"
                    onClick={handleBulkUpload}
                    disabled={bulkUploading || bulkEntries.length === 0}
                    className="bg-navy text-cream hover:bg-navy/90 flex-1 sm:flex-none"
                  >
                    {bulkUploading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <UploadIcon className="mr-2 h-5 w-5" />
                        Upload All ({bulkEntries.length} shiurim)
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
