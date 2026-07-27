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
import { AuthGuard } from "@/components/auth-guard"
import { db } from "@/lib/firebase"
import {
  collection,
  addDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getDocs,
  query,
  orderBy,
  limit,
  where,
} from "firebase/firestore"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { uploadToB2 } from "@/lib/b2-upload"
import { useToast } from "@/hooks/use-toast"
import { getUserFriendlyError, checkFirestoreReachable } from "@/lib/utils"
import { FileDropzone } from "@/components/file-dropzone"
import { isWavFile, maybeConvertWavToMp3 } from "@/lib/audio-convert"
import { Loader2, CheckCircle, Plus, X, UploadIcon, Trash2, ListPlus, User, Pencil, Lock, Clock } from "lucide-react"

type UploadStatus = "idle" | "converting-audio" | "uploading-audio" | "uploading-pdf" | "saving" | "complete" | "error"

// YYYY-MM-DD (local time) — matches the <input type="date"> format.
const fileDateString = (file: File): string => {
  const d = new Date(file.lastModified)
  const yr = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, "0")
  const dy = String(d.getDate()).padStart(2, "0")
  return `${yr}-${mo}-${dy}`
}

interface RecentShiur {
  id: string
  title: string
  rebbe: string
  date: string
  tags: string[]
  description?: string
  series?: string
  uploadedBy?: string
  uploaderName?: string
  uploadedAt?: string
}

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
}

export default function UploadShiurPage() {
  const { user } = useAuth()
  const { toast } = useToast()

  // Single upload state
  const [formData, setFormData] = useState({
    title: "",
    rebbe: "",
    date: "",
    description: "",
    series: "",
  })
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle")
  const [uploadProgress, setUploadProgress] = useState(0)

  // Background (parallel) upload state for audio + pdf
  const [audioBgStatus, setAudioBgStatus] = useState<"idle" | "converting" | "uploading" | "complete" | "error">("idle")
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

  // Recent uploads + edit-your-own state
  const [recentShiurim, setRecentShiurim] = useState<RecentShiur[]>([])
  const [loadingRecent, setLoadingRecent] = useState(true)
  const [myShiurim, setMyShiurim] = useState<RecentShiur[]>([])
  const [loadingMine, setLoadingMine] = useState(true)
  const [editingShiur, setEditingShiur] = useState<RecentShiur | null>(null)
  const [editForm, setEditForm] = useState({ title: "", rebbe: "", date: "", description: "", series: "" })
  const [editTags, setEditTags] = useState<string[]>([])
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    fetchOptions()
    fetchRecent()
  }, [])

  // Load the user's own uploads once we know who they are.
  useEffect(() => {
    if (user?.email) fetchMine()
  }, [user?.email])

  const refreshLists = () => {
    fetchRecent()
    fetchMine()
  }

  // The 3 most recently uploaded shiurim across the whole site.
  const fetchRecent = async () => {
    setLoadingRecent(true)
    try {
      const q = query(collection(db, "shiurim"), orderBy("uploadedAt", "desc"), limit(3))
      const snap = await getDocs(q)
      const rows: RecentShiur[] = []
      snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as Omit<RecentShiur, "id">) }))
      setRecentShiurim(rows)
    } catch (error) {
      console.error("Error fetching recent shiurim:", error)
    } finally {
      setLoadingRecent(false)
    }
  }

  // Every shiur this user uploaded, newest first. (Sorted client-side to avoid
  // needing a composite Firestore index on uploadedBy + uploadedAt.)
  const fetchMine = async () => {
    if (!user?.email) {
      setMyShiurim([])
      setLoadingMine(false)
      return
    }
    setLoadingMine(true)
    try {
      const q = query(collection(db, "shiurim"), where("uploadedBy", "==", user.email))
      const snap = await getDocs(q)
      const rows: RecentShiur[] = []
      snap.forEach((d) => rows.push({ id: d.id, ...(d.data() as Omit<RecentShiur, "id">) }))
      rows.sort((a, b) => (b.uploadedAt || "").localeCompare(a.uploadedAt || ""))
      setMyShiurim(rows)
    } catch (error) {
      console.error("Error fetching your shiurim:", error)
    } finally {
      setLoadingMine(false)
    }
  }

  // A user may only edit shiurim they uploaded themselves.
  const canEditShiur = (s: RecentShiur) =>
    !!user?.email && !!s.uploadedBy && s.uploadedBy.toLowerCase() === user.email.toLowerCase()

  const openEditShiur = (s: RecentShiur) => {
    setEditingShiur(s)
    setEditForm({
      title: s.title || "",
      rebbe: s.rebbe || "",
      date: s.date || "",
      description: s.description || "",
      series: s.series || "",
    })
    setEditTags(s.tags || [])
  }

  const toggleEditTag = (tag: string) => {
    setEditTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  const handleSaveEdit = async () => {
    if (!editingShiur) return
    // Guard again at write time in case state was tampered with.
    if (!canEditShiur(editingShiur)) {
      toast({ title: "Not allowed", description: "You can only edit shiurim you uploaded.", variant: "destructive" })
      return
    }
    if (!editForm.title.trim() || !editForm.rebbe.trim()) {
      toast({ title: "Missing info", description: "Title and Rebbe are required.", variant: "destructive" })
      return
    }
    setSavingEdit(true)
    try {
      await updateDoc(doc(db, "shiurim", editingShiur.id), {
        title: editForm.title.trim(),
        rebbe: editForm.rebbe,
        date: editForm.date || null,
        tags: editTags,
        description: editForm.description,
        series: editForm.series || null,
      })
      toast({ title: "Shiur updated" })
      setEditingShiur(null)
      refreshLists()
    } catch (error: any) {
      toast({ title: "Unable to update", description: getUserFriendlyError(error), variant: "destructive" })
    } finally {
      setSavingEdit(false)
    }
  }

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

    // Auto-fill the date from the file's Last Modified if the user hasn't set one yet.
    setFormData((prev) => (prev.date ? prev : { ...prev, date: fileDateString(file) }))

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

    const runConvertAndUpload = async (): Promise<string> => {
      let toUpload = file
      if (isWavFile(file)) {
        setAudioBgStatus("converting")
        setAudioBgProgress(0)
        const result = await maybeConvertWavToMp3(file, (p) => setAudioBgProgress(p))
        if (result.converted) {
          toUpload = result.file
          // Update the visible filename to the new .mp3
          setAudioFile(result.file)
        } else if (result.error) {
          toast({
            title: "Couldn't convert WAV to MP3",
            description: `${result.error}. Uploading the original file instead.`,
          })
        }
      }
      setAudioBgStatus("uploading")
      setAudioBgProgress(0)
      return uploadToB2(toUpload, "shiurim/audio", (p) => setAudioBgProgress(p))
    }

    const promise = runConvertAndUpload()
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
      case "converting-audio":
        return "Converting WAV to MP3..."
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
        uploaderName: user?.email || "unknown",
        uploadedAt: new Date().toISOString(),
      }

      const newShiurRef = await addDoc(collection(db, "shiurim"), shiurData)

      // Fire-and-forget: notify subscribers. Failures here must not break upload.
      fetch("/api/notify-new-shiur", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiurId: newShiurRef.id,
          title: shiurData.title,
          rebbe: shiurData.rebbe,
          date: shiurData.date,
          tags: shiurData.tags,
          description: shiurData.description,
          audioUrl: shiurData.audioUrl,
          pdfUrl: shiurData.pdfUrl,
        }),
      }).catch((err) => console.error("Notify subscribers failed:", err))

      setUploadStatus("complete")
      setUploadProgress(100)
      toast({ title: "Shiur uploaded successfully!", description: "Ready for the next one." })

      // Refresh both lists and reset the form so the user can keep uploading.
      refreshLists()
      setTimeout(() => {
        setFormData({ title: "", rebbe: "", date: "", description: "", series: "" })
        setSelectedTags([])
        setAudioFile(null)
        setPdfFile(null)
        setAudioBgStatus("idle")
        setAudioBgUrl(null)
        setAudioBgProgress(0)
        setAudioBgError(null)
        audioPromiseRef.current = null
        setPdfBgStatus("idle")
        setPdfBgUrl(null)
        setPdfBgProgress(0)
        setPdfBgError(null)
        pdfPromiseRef.current = null
        setUploadStatus("idle")
        setUploadProgress(0)
        setUploading(false)
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
        let audioUrl = ""
        let pdfUrl = ""

        if (entry.audioFile) {
          let audioForUpload = entry.audioFile
          if (isWavFile(entry.audioFile)) {
            updateBulkEntry(entry.id, { status: "converting-audio", progress: 0 })
            const result = await maybeConvertWavToMp3(entry.audioFile, (p) => {
              updateBulkEntry(entry.id, { progress: p * 0.3 })
            })
            if (result.converted) {
              audioForUpload = result.file
              updateBulkEntry(entry.id, { audioFile: result.file })
            }
          }

          updateBulkEntry(entry.id, { status: "uploading-audio", progress: 30 })
          audioUrl = await uploadFile(audioForUpload, "audio", (p) => {
            updateBulkEntry(entry.id, { progress: 30 + p * 0.3 })
          })
        } else {
          updateBulkEntry(entry.id, { status: "uploading-audio", progress: 10 })
        }
        updateBulkEntry(entry.id, { progress: 60 })

        if (entry.pdfFile) {
          updateBulkEntry(entry.id, { status: "uploading-pdf", progress: 60 })
          pdfUrl = await uploadFile(entry.pdfFile, "pdf", (p) => {
            updateBulkEntry(entry.id, { progress: 60 + p * 0.3 })
          })
        }

        updateBulkEntry(entry.id, { status: "saving", progress: 90 })

        const newShiurRef = await addDoc(collection(db, "shiurim"), {
          title: entry.title,
          rebbe: entry.rebbe,
          date: entry.date,
          tags: entry.tags,
          description: entry.description,
          series: entry.series || null,
          audioUrl,
          pdfUrl,
          uploadedBy: user?.email || "unknown",
          uploaderName: user?.email || "unknown",
          uploadedAt: new Date().toISOString(),
        })

        // Fire-and-forget: notify subscribers. Failures here must not break upload.
        fetch("/api/notify-new-shiur", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shiurId: newShiurRef.id,
            title: entry.title,
            rebbe: entry.rebbe,
            date: entry.date,
            tags: entry.tags,
            description: entry.description,
            audioUrl,
            pdfUrl,
          }),
        }).catch((err) => console.error("Notify subscribers failed:", err))

        updateBulkEntry(entry.id, { status: "complete", progress: 100 })
      } catch (error: any) {
        updateBulkEntry(entry.id, { status: "error", error: getUserFriendlyError(error), progress: 0 })
      }
    }

    setBulkUploading(false)

    const completed = bulkEntries.filter((e) => e.status === "complete").length
    toast({ title: `Uploaded ${completed} of ${bulkEntries.length} shiurim` })

    // Refresh both lists; stay on the page so the user can upload more.
    refreshLists()
    if (completed === bulkEntries.length) {
      // Clear out the finished entries, ready for the next batch.
      setBulkEntries([])
    }
  }

  const applyToAllBulk = (field: "rebbe" | "series", value: string) => {
    setBulkEntries(bulkEntries.map(e => ({ ...e, [field]: value })))
    toast({ title: `Applied to all entries` })
  }

  // Toggle a tag across every bulk entry. If every entry already has it, remove
  // from all; otherwise add to any that are missing it.
  const applyTagToAllBulk = (tag: string) => {
    if (bulkEntries.length === 0) return
    const allHave = bulkEntries.every((e) => e.tags.includes(tag))
    setBulkEntries(
      bulkEntries.map((e) => ({
        ...e,
        tags: allHave
          ? e.tags.filter((t) => t !== tag)
          : e.tags.includes(tag)
            ? e.tags
            : [...e.tags, tag],
      })),
    )
    toast({ title: allHave ? `Removed "${tag}" from all` : `Added "${tag}" to all` })
  }

  const clearAllBulkTags = () => {
    if (bulkEntries.length === 0) return
    setBulkEntries(bulkEntries.map((e) => ({ ...e, tags: [] })))
    toast({ title: "Cleared tags on all entries" })
  }

  if (!user) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-gradient-to-br from-cream via-cream to-gold/10 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-navy mx-auto mb-4" />
            <p className="text-navy/70">Loading...</p>
          </div>
        </div>
      </AuthGuard>
    )
  }

  return (
    <AuthGuard>
    <div className="min-h-screen bg-gradient-to-br from-cream via-cream to-gold/10">
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <UploadIcon className="h-8 w-8 text-gold" />
            <h1 className="font-serif text-4xl font-bold text-navy">Upload Shiurim</h1>
          </div>
          <p className="text-navy/70">Share your shiurim with the alumni network</p>
          {user?.email && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gold/10 border border-gold/30 text-sm text-navy">
              <User className="h-3.5 w-3.5 text-gold-dark" />
              <span>
                Uploading as <span className="font-medium">{user.displayName || user.email}</span>
              </span>
            </div>
          )}
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
                    <Label className="text-navy font-semibold">Audio File</Label>
                    <FileDropzone
                      accept="audio/*"
                      label="Drop audio file here, or click to browse"
                      hint="MP3, WAV, M4A, etc. (WAV files auto-convert to MP3)"
                      selectedFile={audioFile}
                      disabled={audioBgStatus === "uploading" || audioBgStatus === "converting" || uploading}
                      onFilesSelected={(files) => handleAudioFileChange(files[0] || null)}
                    />
                    {audioFile && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-navy/70 truncate flex-1 mr-2 flex items-center gap-1.5">
                            {(audioBgStatus === "uploading" || audioBgStatus === "converting") && <Loader2 className="h-3 w-3 animate-spin text-navy/60 flex-shrink-0" />}
                            {audioBgStatus === "complete" && <CheckCircle className="h-3 w-3 text-green-600 flex-shrink-0" />}
                            <span className="truncate">{audioFile.name}</span>
                          </span>
                          <span className="font-medium flex-shrink-0">
                            {audioBgStatus === "converting" && (
                              <span className="text-navy">Converting WAV {Math.round(audioBgProgress)}%</span>
                            )}
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
                        {(audioBgStatus === "uploading" || audioBgStatus === "converting") && (
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
                    <FileDropzone
                      accept=".pdf"
                      label="Drop PDF here, or click to browse"
                      hint="Mareh mekomos / source sheets"
                      selectedFile={pdfFile}
                      disabled={pdfBgStatus === "uploading" || uploading}
                      onFilesSelected={(files) => handlePdfFileChange(files[0] || null)}
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
                      {audioBgStatus === "converting"
                        ? `Converting WAV (${Math.round(audioBgProgress)}%)...`
                        : audioBgStatus === "uploading"
                        ? `Waiting for audio (${Math.round(audioBgProgress)}%)...`
                        : getStatusLabel(uploadStatus)}
                    </>
                  ) : (
                    <>
                      <UploadIcon className="mr-2 h-5 w-5" />
                      {audioBgStatus === "converting"
                        ? `Submit (converting WAV - ${Math.round(audioBgProgress)}%)`
                        : audioBgStatus === "uploading"
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
                    <div className="grid gap-4 md:grid-cols-2">
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

                    {/* Tag bulk-apply: click to toggle a tag on every entry. */}
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm text-navy/70">Tags</Label>
                        {bulkEntries.some((e) => e.tags.length > 0) && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={clearAllBulkTags}
                            className="h-7 text-xs"
                          >
                            Clear all
                          </Button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {tagsOptions.map((tag) => {
                          const allHave = bulkEntries.every((e) => e.tags.includes(tag))
                          const someHave = !allHave && bulkEntries.some((e) => e.tags.includes(tag))
                          return (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => applyTagToAllBulk(tag)}
                              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                                allHave
                                  ? "bg-navy text-cream"
                                  : someHave
                                    ? "bg-gold/20 border border-gold text-navy"
                                    : "bg-cream border border-gold/30 text-navy hover:border-gold"
                              }`}
                              title={
                                allHave
                                  ? "Click to remove from all entries"
                                  : someHave
                                    ? "On some entries — click to add to all"
                                    : "Click to add to all entries"
                              }
                            >
                              {tag}
                            </button>
                          )
                        })}
                        {tagsOptions.length === 0 && (
                          <p className="text-sm text-navy/50">No tags available.</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Multi-file drop zone - drop many audio files to auto-create entries */}
              <FileDropzone
                accept="audio/*"
                multiple
                label="Drop multiple audio files here to add them all at once"
                hint="Each file will become its own shiur entry - then fill in the details below"
                disabled={bulkUploading}
                onFilesSelected={(files) => {
                  const newEntries: BulkShiurEntry[] = files.map((file) => {
                    const baseName = file.name.replace(/\.[^/.]+$/, "")
                    return {
                      ...createEmptyBulkEntry(),
                      audioFile: file,
                      title: baseName,
                      date: fileDateString(file),
                    }
                  })
                  setBulkEntries((prev) => [...prev, ...newEntries])
                  toast({
                    title: `Added ${files.length} shiur${files.length !== 1 ? "im" : ""}`,
                    description: "Fill in the details for each entry below.",
                  })
                }}
              />

              {/* Bulk Entries */}
              {bulkEntries.length === 0 ? (
                <Card className="bg-white border-gold/20">
                  <CardContent className="py-12 text-center">
                    <ListPlus className="h-12 w-12 text-gold/50 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-navy mb-2">No shiurim added yet</h3>
                    <p className="text-navy/60 mb-4">
                      Drop audio files above, or add a single entry to get started
                    </p>
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
                            <Label className="text-navy font-semibold text-sm">Audio File</Label>
                            <FileDropzone
                              accept="audio/*"
                              label="Drop audio or click"
                              hint="MP3, WAV, M4A"
                              compact
                              selectedFile={entry.audioFile}
                              disabled={bulkUploading}
                              onFilesSelected={(files) => {
                                const file = files[0] || null
                                const updates: Partial<BulkShiurEntry> = { audioFile: file }
                                if (file && !entry.date) updates.date = fileDateString(file)
                                updateBulkEntry(entry.id, updates)
                              }}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-navy font-semibold text-sm">PDF (Optional)</Label>
                            <FileDropzone
                              accept=".pdf"
                              label="Drop PDF or click"
                              hint="Optional source sheet"
                              compact
                              selectedFile={entry.pdfFile}
                              disabled={bulkUploading}
                              onFilesSelected={(files) =>
                                updateBulkEntry(entry.id, { pdfFile: files[0] || null })
                              }
                            />
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

        {/* Recent uploads across the site. Each user can edit only their own. */}
        <div className="mt-12">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-gold-dark" />
            <h2 className="font-serif text-2xl font-bold text-navy">Recently Uploaded</h2>
          </div>
          {loadingRecent ? (
            <div className="flex items-center gap-2 text-navy/60 py-6">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading recent shiurim...
            </div>
          ) : recentShiurim.length === 0 ? (
            <Card className="bg-white border-gold/20">
              <CardContent className="py-8 text-center text-navy/60">No shiurim uploaded yet.</CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {recentShiurim.map((s) => {
                const mine = canEditShiur(s)
                return (
                  <Card key={s.id} className="bg-white border-2 border-gold/20">
                    <CardContent className="p-4 flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-navy truncate">{s.title || "(untitled)"}</h3>
                          {mine && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gold/15 text-gold-dark border border-gold/30">
                              Your upload
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-navy/70 mt-0.5">
                          {s.rebbe}
                          {s.date ? ` · ${new Date(s.date).toLocaleDateString()}` : ""}
                          {s.series ? ` · ${s.series}` : ""}
                        </p>
                        {(s.uploaderName || s.uploadedBy) && (
                          <p className="text-xs text-navy/40 mt-1">Uploaded by {s.uploaderName || s.uploadedBy}</p>
                        )}
                      </div>
                      {mine ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEditShiur(s)}
                          className="border-gold/30 shrink-0"
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1.5" />
                          Edit
                        </Button>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-xs text-navy/40 shrink-0"
                          title="You can only edit shiurim you uploaded"
                        >
                          <Lock className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        {/* All of the current user's own uploads — every one is editable. */}
        <div className="mt-12">
          <div className="flex items-center gap-2 mb-4">
            <User className="h-5 w-5 text-gold-dark" />
            <h2 className="font-serif text-2xl font-bold text-navy">Your Uploads</h2>
            {!loadingMine && myShiurim.length > 0 && (
              <span className="text-sm text-navy/50">({myShiurim.length})</span>
            )}
          </div>
          {loadingMine ? (
            <div className="flex items-center gap-2 text-navy/60 py-6">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading your shiurim...
            </div>
          ) : myShiurim.length === 0 ? (
            <Card className="bg-white border-gold/20">
              <CardContent className="py-8 text-center text-navy/60">
                You haven&apos;t uploaded any shiurim yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {myShiurim.map((s) => (
                <Card key={s.id} className="bg-white border-2 border-gold/20">
                  <CardContent className="p-4 flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-navy truncate">{s.title || "(untitled)"}</h3>
                      <p className="text-sm text-navy/70 mt-0.5">
                        {s.rebbe}
                        {s.date ? ` · ${new Date(s.date).toLocaleDateString()}` : ""}
                        {s.series ? ` · ${s.series}` : ""}
                      </p>
                      {s.uploadedAt && (
                        <p className="text-xs text-navy/40 mt-1">
                          Uploaded {new Date(s.uploadedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openEditShiur(s)}
                      className="border-gold/30 shrink-0"
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1.5" />
                      Edit
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit dialog — only reachable for the user's own shiurim. */}
      <Dialog open={!!editingShiur} onOpenChange={(open) => !open && setEditingShiur(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-navy">Edit Shiur</DialogTitle>
            <DialogDescription>Update the details of your shiur.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-navy font-semibold">Title *</Label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                className="border-gold/30"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-navy font-semibold">Rebbe *</Label>
                <Select value={editForm.rebbe} onValueChange={(v) => setEditForm({ ...editForm, rebbe: v })}>
                  <SelectTrigger className="border-gold/30">
                    <SelectValue placeholder="Select Rebbe" />
                  </SelectTrigger>
                  <SelectContent>
                    {rebbeimOptions.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-navy font-semibold">Date</Label>
                <Input
                  type="date"
                  value={editForm.date}
                  onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                  className="border-gold/30"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-navy font-semibold">Series</Label>
              <Select
                value={editForm.series || "none"}
                onValueChange={(v) => setEditForm({ ...editForm, series: v === "none" ? "" : v })}
              >
                <SelectTrigger className="border-gold/30">
                  <SelectValue placeholder="Select Series" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Series</SelectItem>
                  {seriesOptions.map((sr) => (
                    <SelectItem key={sr} value={sr}>
                      {sr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-navy font-semibold">Tags</Label>
              <div className="flex flex-wrap gap-2">
                {tagsOptions.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleEditTag(tag)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      editTags.includes(tag)
                        ? "bg-navy text-cream"
                        : "bg-cream border border-gold/30 text-navy hover:border-gold"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
                {tagsOptions.length === 0 && <p className="text-sm text-navy/50">No tags available.</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-navy font-semibold">Description</Label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={3}
                className="border-gold/30"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setEditingShiur(null)} disabled={savingEdit}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveEdit}
              disabled={savingEdit}
              className="bg-navy text-cream hover:bg-navy/90"
            >
              {savingEdit ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </AuthGuard>
  )
}
