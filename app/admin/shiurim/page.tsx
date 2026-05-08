"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Plus,
  Pencil,
  Trash2,
  Send,
  X,
  Loader2,
  CheckCircle,
  ListPlus,
  User,
  Tag,
  Play,
  Download,
  Layers,
  Upload,
  Link2,
  Copy,
  Check,
} from "lucide-react"
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
  query,
  getDoc,
  setDoc,
} from "firebase/firestore"
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { storage, db } from "@/lib/firebase"
import { uploadToB2 } from "@/lib/b2-upload"
import { useToast } from "@/hooks/use-toast"
import { EngagementHoverCard } from "@/components/engagement-hover-card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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
  uploadedBy?: string
  uploaderName?: string
  uploadedAt?: string
}

interface Series {
  id: string
  name: string
  description?: string
  shiurCount?: number
}

type UploadStatus = "idle" | "uploading-audio" | "uploading-pdf" | "saving" | "complete" | "error"

interface BulkShiurEntry {
  id: string
  title: string
  rebbe: string
  date: string
  tags: string[]
  description: string
  audioSourceType: "upload" | "gdrive"
  gdriveUrl: string
  audioFile: File | null
  pdfFile: File | null
  status: UploadStatus
  error?: string
  progress: number
  series: string
}

export default function AdminShiurimPage() {
  const [shiurim, setShiurim] = useState<Shiur[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false)
  const [bulkEntries, setBulkEntries] = useState<BulkShiurEntry[]>([])
  const [bulkUploading, setBulkUploading] = useState(false)

  const [editingShiur, setEditingShiur] = useState<Shiur | null>(null)
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
  const [sendingReminder, setSendingReminder] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState<string | null>(null)
  const [audioSourceType, setAudioSourceType] = useState<"upload" | "gdrive">("upload")
  const [gdriveUrl, setGdriveUrl] = useState("")
  const [storageProvider, setStorageProvider] = useState<"b2" | "firebase">("b2")

  // Filter states
  const [filterSearch, setFilterSearch] = useState("")
  const [filterRebbe, setFilterRebbe] = useState<string>("")
  const [filterSeries, setFilterSeries] = useState<string>("")
  const [filterTag, setFilterTag] = useState<string>("")
  const [sortBy, setSortBy] = useState<"date" | "plays" | "downloads">("date")

  const [rebbeimOptions, setRebbeimOptions] = useState<string[]>([])
  const [tagsOptions, setTagsOptions] = useState<string[]>([])
  const [seriesOptions, setSeriesOptions] = useState<string[]>([])
  const [newRebbe, setNewRebbe] = useState("")
  const [newTag, setNewTag] = useState("")
  const [newSeries, setNewSeries] = useState("")

  // Inline edit state for renaming options
  const [editingRebbe, setEditingRebbe] = useState<string | null>(null)
  const [editingTag, setEditingTag] = useState<string | null>(null)
  const [editingSeries, setEditingSeries] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [renaming, setRenaming] = useState(false)
  const [showAddRebbe, setShowAddRebbe] = useState(false)
  const [showAddTag, setShowAddTag] = useState(false)
  const [showAddSeries, setShowAddSeries] = useState(false)

  const [activeTab, setActiveTab] = useState("shiurim")

  const { toast } = useToast()

  useEffect(() => {
    fetchShiurim()
    fetchOptions()
  }, [])

  const fetchShiurim = async () => {
    const shiurimRef = collection(db, "shiurim")
    const q = query(shiurimRef, orderBy("date", "desc"))
    const querySnapshot = await getDocs(q)
    const shiurimData: Shiur[] = []
    querySnapshot.forEach((doc) => {
      shiurimData.push({ id: doc.id, ...doc.data() } as Shiur)
    })
    setShiurim(shiurimData)
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
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const handleAddRebbe = async () => {
    if (!newRebbe.trim()) return
    if (rebbeimOptions.includes(newRebbe.trim())) {
      toast({ title: "Rebbe already exists", variant: "destructive" })
      return
    }
    const updated = [...rebbeimOptions, newRebbe.trim()].sort()
    setRebbeimOptions(updated)
    setFormData({ ...formData, rebbe: newRebbe.trim() })
    setNewRebbe("")
    setShowAddRebbe(false)
    await saveOptions(updated, tagsOptions)
    toast({ title: "Rebbe added" })
  }

  const handleRemoveRebbe = async (rebbe: string) => {
    const updated = rebbeimOptions.filter((r) => r !== rebbe)
    setRebbeimOptions(updated)
    await saveOptions(updated, tagsOptions)
    toast({ title: "Rebbe removed" })
  }

  const handleAddTag = async () => {
    if (!newTag.trim()) return
    if (tagsOptions.includes(newTag.trim())) {
      toast({ title: "Tag already exists", variant: "destructive" })
      return
    }
    const updated = [...tagsOptions, newTag.trim()].sort()
    setTagsOptions(updated)
    setSelectedTags([...selectedTags, newTag.trim()])
    setNewTag("")
    setShowAddTag(false)
    await saveOptions(rebbeimOptions, updated)
    toast({ title: "Tag added" })
  }

  const handleRemoveTag = async (tag: string) => {
    const updated = tagsOptions.filter((t) => t !== tag)
    setTagsOptions(updated)
    await saveOptions(rebbeimOptions, updated)
    toast({ title: "Tag removed" })
  }

  const handleAddSeries = async () => {
    if (!newSeries.trim()) return
    if (seriesOptions.includes(newSeries.trim())) {
      toast({ title: "Series already exists", variant: "destructive" })
      return
    }
    const updated = [...seriesOptions, newSeries.trim()].sort()
    setSeriesOptions(updated)
    setFormData({ ...formData, series: newSeries.trim() })
    setNewSeries("")
    setShowAddSeries(false)
    await saveOptions(rebbeimOptions, tagsOptions, updated)
    toast({ title: "Series added" })
  }

  const handleRemoveSeries = async (series: string) => {
    const updated = seriesOptions.filter((s) => s !== series)
    setSeriesOptions(updated)
    await saveOptions(rebbeimOptions, tagsOptions, updated)
    toast({ title: "Series removed" })
  }

  const startEditRebbe = (rebbe: string) => {
    setEditingRebbe(rebbe)
    setEditingTag(null)
    setEditingSeries(null)
    setEditValue(rebbe)
  }

  const startEditTag = (tag: string) => {
    setEditingTag(tag)
    setEditingRebbe(null)
    setEditingSeries(null)
    setEditValue(tag)
  }

  const startEditSeries = (series: string) => {
    setEditingSeries(series)
    setEditingRebbe(null)
    setEditingTag(null)
    setEditValue(series)
  }

  const cancelEdit = () => {
    setEditingRebbe(null)
    setEditingTag(null)
    setEditingSeries(null)
    setEditValue("")
  }

  // Rename a Rebbe and update all shiurim that reference the old name
  const handleRenameRebbe = async (oldName: string) => {
    const newName = editValue.trim()
    if (!newName) {
      toast({ title: "Name cannot be empty", variant: "destructive" })
      return
    }
    if (newName === oldName) {
      cancelEdit()
      return
    }
    if (rebbeimOptions.includes(newName)) {
      toast({ title: "A rebbe with that name already exists", variant: "destructive" })
      return
    }
    setRenaming(true)
    try {
      // Update the options doc
      const updated = rebbeimOptions.map((r) => (r === oldName ? newName : r)).sort()
      setRebbeimOptions(updated)
      await saveOptions(updated, tagsOptions, seriesOptions)

      // Update every shiur that references this rebbe
      const affected = shiurim.filter((s) => s.rebbe === oldName)
      await Promise.all(
        affected.map((s) => updateDoc(doc(db, "shiurim", s.id), { rebbe: newName })),
      )

      // Update local shiurim state so UI reflects change immediately
      setShiurim((prev) => prev.map((s) => (s.rebbe === oldName ? { ...s, rebbe: newName } : s)))
      cancelEdit()
      toast({
        title: "Rebbe renamed",
        description: `Updated ${affected.length} shiur${affected.length !== 1 ? "im" : ""}.`,
      })
    } catch (err) {
      console.error("Failed to rename rebbe:", err)
      toast({ title: "Failed to rename rebbe", variant: "destructive" })
    } finally {
      setRenaming(false)
    }
  }

  // Rename a Tag and update all shiurim whose tags array contains it
  const handleRenameTag = async (oldName: string) => {
    const newName = editValue.trim()
    if (!newName) {
      toast({ title: "Tag cannot be empty", variant: "destructive" })
      return
    }
    if (newName === oldName) {
      cancelEdit()
      return
    }
    if (tagsOptions.includes(newName)) {
      toast({ title: "A tag with that name already exists", variant: "destructive" })
      return
    }
    setRenaming(true)
    try {
      const updated = tagsOptions.map((t) => (t === oldName ? newName : t)).sort()
      setTagsOptions(updated)
      await saveOptions(rebbeimOptions, updated, seriesOptions)

      const affected = shiurim.filter((s) => Array.isArray(s.tags) && s.tags.includes(oldName))
      await Promise.all(
        affected.map((s) => {
          const newTags = (s.tags || []).map((t: string) => (t === oldName ? newName : t))
          return updateDoc(doc(db, "shiurim", s.id), { tags: newTags })
        }),
      )

      setShiurim((prev) =>
        prev.map((s) =>
          Array.isArray(s.tags) && s.tags.includes(oldName)
            ? { ...s, tags: s.tags.map((t: string) => (t === oldName ? newName : t)) }
            : s,
        ),
      )
      // If user is currently editing/creating a shiur that has this tag selected, sync that too
      setSelectedTags((prev) => prev.map((t) => (t === oldName ? newName : t)))
      cancelEdit()
      toast({
        title: "Tag renamed",
        description: `Updated ${affected.length} shiur${affected.length !== 1 ? "im" : ""}.`,
      })
    } catch (err) {
      console.error("Failed to rename tag:", err)
      toast({ title: "Failed to rename tag", variant: "destructive" })
    } finally {
      setRenaming(false)
    }
  }

  // Rename a Series and update all shiurim that reference the old name
  const handleRenameSeries = async (oldName: string) => {
    const newName = editValue.trim()
    if (!newName) {
      toast({ title: "Series name cannot be empty", variant: "destructive" })
      return
    }
    if (newName === oldName) {
      cancelEdit()
      return
    }
    if (seriesOptions.includes(newName)) {
      toast({ title: "A series with that name already exists", variant: "destructive" })
      return
    }
    setRenaming(true)
    try {
      const updated = seriesOptions.map((s) => (s === oldName ? newName : s)).sort()
      setSeriesOptions(updated)
      await saveOptions(rebbeimOptions, tagsOptions, updated)

      const affected = shiurim.filter((s) => s.series === oldName)
      await Promise.all(
        affected.map((s) => updateDoc(doc(db, "shiurim", s.id), { series: newName })),
      )

      setShiurim((prev) => prev.map((s) => (s.series === oldName ? { ...s, series: newName } : s)))
      cancelEdit()
      toast({
        title: "Series renamed",
        description: `Updated ${affected.length} shiur${affected.length !== 1 ? "im" : ""}.`,
      })
    } catch (err) {
      console.error("Failed to rename series:", err)
      toast({ title: "Failed to rename series", variant: "destructive" })
    } finally {
      setRenaming(false)
    }
  }

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag))
    } else {
      setSelectedTags([...selectedTags, tag])
    }
  }

  const uploadToFirebase = async (file: File, type: "audio" | "pdf", onProgress?: (percent: number) => void) => {
    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
    const path = `shiurim/${type}/${timestamp}-${safeName}`
    const storageRef = ref(storage, path)

    if (onProgress) {
      const uploadTask = uploadBytesResumable(storageRef, file)
      uploadTask.on("state_changed", (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        onProgress(progress)
      })
    }

    const url = await getDownloadURL(storageRef)
    return url
  }

  const uploadFile = async (
    file: File,
    type: "audio" | "pdf",
    onProgress?: (percent: number) => void,
  ): Promise<string> => {
    const folder = type === "audio" ? "shiurim/audio" : "shiurim/pdf"

    if (storageProvider === "b2" && type === "audio") {
      try {
        console.log("[v0] Uploading audio to B2...")
        const url = await uploadToB2(file, folder, onProgress)
        console.log("[v0] B2 upload successful:", url)
        return url
      } catch (error) {
        console.log("[v0] B2 upload failed, falling back to Firebase:", error)
        return uploadToFirebase(file, type, onProgress)
      }
    } else {
      return uploadToFirebase(file, type, onProgress)
    }
  }

  const convertGdriveUrl = (url: string): string => {
    let fileId = ""
    const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
    if (fileIdMatch) {
      fileId = fileIdMatch[1]
    }
    const idParamMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
    if (!fileId && idParamMatch) {
      fileId = idParamMatch[1]
    }
    const openIdMatch = url.match(/\/open\?id=([a-zA-Z0-9_-]+)/)
    if (!fileId && openIdMatch) {
      fileId = openIdMatch[1]
    }
    if (fileId) {
      return `https://drive.google.com/uc?export=preview&id=${fileId}`
    }
    return url
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setUploading(true)
    setUploadProgress(0)

    try {
      let audioUrl = editingShiur?.audioUrl || ""
      let pdfUrl = editingShiur?.pdfUrl || ""

      if (audioSourceType === "upload" && audioFile) {
        setUploadStatus("uploading-audio")
        audioUrl = await uploadFile(audioFile, "audio", (p) => setUploadProgress(p * 0.6))
      } else if (audioSourceType === "gdrive" && gdriveUrl) {
        audioUrl = convertGdriveUrl(gdriveUrl)
        setUploadProgress(60)
      } else {
        setUploadProgress(60)
      }

      if (pdfFile) {
        setUploadStatus("uploading-pdf")
        pdfUrl = await uploadFile(pdfFile, "pdf", (p) => setUploadProgress(60 + p * 0.3))
      } else {
        setUploadProgress(90)
      }

      setUploadStatus("saving")
      setUploadProgress(95)

      if (editingShiur) {
        // Only update the fields being edited - preserves playCount, downloadCount, uploadedBy, etc.
        const updateData: Record<string, any> = {
          title: formData.title,
          rebbe: formData.rebbe,
          date: formData.date || null,
          tags: selectedTags,
          description: formData.description,
          series: formData.series || null,
        }
        // Only update audio/pdf URLs if they changed
        if (audioUrl && audioUrl !== editingShiur.audioUrl) {
          updateData.audioUrl = audioUrl
        } else if (audioUrl) {
          updateData.audioUrl = audioUrl
        }
        if (pdfUrl && pdfUrl !== editingShiur.pdfUrl) {
          updateData.pdfUrl = pdfUrl
        } else if (pdfUrl) {
          updateData.pdfUrl = pdfUrl
        }

        await updateDoc(doc(db, "shiurim", editingShiur.id), updateData)
        toast({ title: "Shiur updated successfully" })
      } else {
        const shiurData = {
          title: formData.title,
          rebbe: formData.rebbe,
          date: formData.date || null,
          tags: selectedTags,
          description: formData.description,
          series: formData.series || null,
          audioUrl,
          pdfUrl,
          playCount: 0,
          downloadCount: 0,
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

        toast({ title: "Shiur added successfully" })
      }

      setUploadStatus("complete")
      setUploadProgress(100)

      setTimeout(() => {
        setIsDialogOpen(false)
        resetForm()
        fetchShiurim()
      }, 500)
    } catch (error: any) {
      console.error("Error saving shiur:", error)
      setUploadStatus("error")
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  const handleEdit = (shiur: Shiur) => {
    setEditingShiur(shiur)
    setFormData({
      title: shiur.title,
      rebbe: shiur.rebbe,
      date: shiur.date,
      description: shiur.description || "",
      series: shiur.series || "",
    })
    setSelectedTags(shiur.tags || [])
    if (shiur.audioUrl?.includes("drive.google.com")) {
      setAudioSourceType("gdrive")
      setGdriveUrl(shiur.audioUrl)
    } else {
      setAudioSourceType("upload")
      setGdriveUrl("")
    }
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this shiur?")) return

    try {
      await deleteDoc(doc(db, "shiurim", id))
      toast({ title: "Shiur deleted successfully" })
      fetchShiurim()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const handleSendReminder = async (shiur: Shiur) => {
    if (!confirm(`Send reminder emails to all subscribers about "${shiur.title}"?`)) return

    setSendingReminder(shiur.id)
    try {
      const response = await fetch("/api/send-shiur-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiurId: shiur.id,
          title: shiur.title,
          rebbe: shiur.rebbe,
          date: shiur.date,
        }),
      })
      const data = await response.json()

      if (response.ok) {
        toast({ title: `Reminders sent to ${data.sentTo} subscribers` })
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setSendingReminder(null)
    }
  }

  const createEmptyBulkEntry = (): BulkShiurEntry => ({
    id: Math.random().toString(36).substr(2, 9),
    title: "",
    rebbe: "",
    date: "",
    tags: [],
    description: "",
    audioSourceType: "upload",
    gdriveUrl: "",
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
    setBulkUploading(true)

    for (let i = 0; i < bulkEntries.length; i++) {
      const entry = bulkEntries[i]
      if (!entry.title || !entry.rebbe) {
        updateBulkEntry(entry.id, { status: "error", error: "Missing required fields (title, rebbe)" })
        continue
      }

      try {
        updateBulkEntry(entry.id, { status: "uploading-audio", progress: 10 })

        let audioUrl = ""
        let pdfUrl = ""

        if (entry.audioSourceType === "upload" && entry.audioFile) {
          audioUrl = await uploadFile(entry.audioFile, "audio")
          updateBulkEntry(entry.id, { progress: 50 })
        } else if (entry.audioSourceType === "gdrive" && entry.gdriveUrl) {
          audioUrl = convertGdriveUrl(entry.gdriveUrl)
          updateBulkEntry(entry.id, { progress: 50 })
        }

        if (entry.pdfFile) {
          updateBulkEntry(entry.id, { status: "uploading-pdf", progress: 70 })
          pdfUrl = await uploadFile(entry.pdfFile, "pdf")
        }

        updateBulkEntry(entry.id, { status: "saving", progress: 90 })

        const newShiurRef = await addDoc(collection(db, "shiurim"), {
          title: entry.title,
          rebbe: entry.rebbe,
          date: entry.date || null,
          tags: entry.tags,
          description: entry.description,
          series: entry.series || null,
          audioUrl,
          pdfUrl,
        })

        // Fire-and-forget: notify subscribers. Failures here must not break upload.
        fetch("/api/notify-new-shiur", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shiurId: newShiurRef.id,
            title: entry.title,
            rebbe: entry.rebbe,
            date: entry.date || null,
            tags: entry.tags,
            description: entry.description,
            audioUrl,
            pdfUrl,
          }),
        }).catch((err) => console.error("Notify subscribers failed:", err))

        updateBulkEntry(entry.id, { status: "complete", progress: 100 })
      } catch (error: any) {
        updateBulkEntry(entry.id, { status: "error", error: error.message, progress: 0 })
      }
    }

    setBulkUploading(false)
    fetchShiurim()

    const completed = bulkEntries.filter((e) => e.status === "complete").length
    toast({ title: `Uploaded ${completed} of ${bulkEntries.length} shiurim` })
  }

  const copyShareLink = (shiurId: string) => {
    const url = `${window.location.origin}/shiurim?play=${shiurId}`
    navigator.clipboard.writeText(url)
    setCopiedLink(shiurId)
    setTimeout(() => setCopiedLink(null), 2000)
  }

  const resetForm = () => {
    setEditingShiur(null)
    setFormData({ title: "", rebbe: "", date: "", description: "", series: "" })
    setSelectedTags([])
    setAudioFile(null)
    setPdfFile(null)
    setAudioSourceType("upload")
    setGdriveUrl("")
    setShowAddRebbe(false)
    setShowAddTag(false)
    setShowAddSeries(false)
    setNewRebbe("")
    setNewTag("")
    setNewSeries("")
    setUploadStatus("idle")
    setUploadProgress(0)
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
      case "error":
        return "Error"
      default:
        return ""
    }
  }

  // Filter and sort shiurim
  const filteredShiurim = shiurim
    .filter((shiur) => {
      const matchesSearch = !filterSearch || 
        shiur.title.toLowerCase().includes(filterSearch.toLowerCase()) ||
        shiur.rebbe.toLowerCase().includes(filterSearch.toLowerCase())
      const matchesRebbe = !filterRebbe || shiur.rebbe === filterRebbe
      const matchesSeries = !filterSeries || shiur.series === filterSeries
      const matchesTag = !filterTag || shiur.tags?.includes(filterTag)
      return matchesSearch && matchesRebbe && matchesSeries && matchesTag
    })
    .sort((a, b) => {
      if (sortBy === "plays") {
        return (b.playCount || 0) - (a.playCount || 0)
      } else if (sortBy === "downloads") {
        return (b.downloadCount || 0) - (a.downloadCount || 0)
      }
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })

  const shiurimBySeries = filteredShiurim.reduce(
    (acc, shiur) => {
      const seriesName = shiur.series || "Uncategorized"
      if (!acc[seriesName]) {
        acc[seriesName] = []
      }
      acc[seriesName].push(shiur)
      return acc
    },
    {} as Record<string, Shiur[]>,
  )

  const clearFilters = () => {
    setFilterSearch("")
    setFilterRebbe("")
    setFilterSeries("")
    setFilterTag("")
    setSortBy("date")
  }

  const hasActiveFilters = filterSearch || filterRebbe || filterSeries || filterTag || sortBy !== "date"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-navy mb-2">Shiur Database</h1>
        <p className="text-navy/70">Manage shiurim recordings, rebbeim, tags, and series</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="shiurim">Shiurim ({shiurim.length})</TabsTrigger>
          <TabsTrigger value="options">Rebbeim, Tags & Series</TabsTrigger>
        </TabsList>

        <TabsContent value="shiurim" className="space-y-6">
          {/* Filters */}
          <Card className="bg-cream/30">
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    placeholder="Search shiurim..."
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    className="w-full sm:w-64 bg-white"
                  />
                  <Select value={filterRebbe || "all"} onValueChange={(val) => setFilterRebbe(val === "all" ? "" : val)}>
                    <SelectTrigger className="w-full sm:w-48 bg-white">
                      <SelectValue placeholder="All Rebbeim" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Rebbeim</SelectItem>
                      {rebbeimOptions.map((rebbe) => (
                        <SelectItem key={rebbe} value={rebbe}>{rebbe}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterSeries || "all"} onValueChange={(val) => setFilterSeries(val === "all" ? "" : val)}>
                    <SelectTrigger className="w-full sm:w-48 bg-white">
                      <SelectValue placeholder="All Series" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Series</SelectItem>
                      {seriesOptions.map((series) => (
                        <SelectItem key={series} value={series}>{series}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterTag || "all"} onValueChange={(val) => setFilterTag(val === "all" ? "" : val)}>
                    <SelectTrigger className="w-full sm:w-48 bg-white">
                      <SelectValue placeholder="All Tags" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tags</SelectItem>
                      {tagsOptions.map((tag) => (
                        <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={(val) => setSortBy(val as "date" | "plays" | "downloads")}>
                    <SelectTrigger className="w-full sm:w-48 bg-white">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date">Sort by Date</SelectItem>
                      <SelectItem value="plays">Sort by Plays</SelectItem>
                      <SelectItem value="downloads">Sort by Downloads</SelectItem>
                    </SelectContent>
                  </Select>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="text-navy/60 hover:text-navy">
                      <X className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>
                {hasActiveFilters && (
                  <p className="text-sm text-navy/60">
                    Showing {filteredShiurim.length} of {shiurim.length} shiurim
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-2">
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
                  Add Shiur
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="font-serif text-2xl text-navy">
                    {editingShiur ? "Edit Shiur" : "Add New Shiur"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingShiur ? "Update the shiur information" : "Add a new shiur to the archive"}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Shiur title"
                      className="font-hebrew"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Rebbe *</Label>
                      {showAddRebbe ? (
                        <div className="flex gap-2">
                          <Input
                            value={newRebbe}
                            onChange={(e) => setNewRebbe(e.target.value)}
                            placeholder="New rebbe name"
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
                            <SelectTrigger className="flex-1">
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
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="date">Date (Optional)</Label>
                      <Input
                        id="date"
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Series (Optional)</Label>
                    {showAddSeries ? (
                      <div className="flex gap-2">
                        <Input
                          value={newSeries}
                          onChange={(e) => setNewSeries(e.target.value)}
                          placeholder="New series name"
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddSeries())}
                          className="font-hebrew"
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
                          value={formData.series || "none"}
                          onValueChange={(value) => setFormData({ ...formData, series: value === "none" ? "" : value })}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select Series (optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Series</SelectItem>
                            {seriesOptions.map((series) => (
                              <SelectItem key={series} value={series} className="font-hebrew">
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
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Tags</Label>
                    {showAddTag ? (
                      <div className="flex gap-2 mb-2">
                        <Input
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          placeholder="New tag"
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                        />
                        <Button type="button" onClick={handleAddTag} size="sm" className="bg-navy text-cream">
                          Add
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddTag(false)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddTag(true)}
                        className="mb-2"
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        New Tag
                      </Button>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {tagsOptions.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className={`px-3 py-1 rounded-full text-sm transition-colors ${
                            selectedTags.includes(tag)
                              ? "bg-gold text-navy"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Brief description of the shiur"
                      className="font-hebrew"
                    />
                  </div>

                  <div className="space-y-4">
                    <Label>Audio Source</Label>
                    <RadioGroup
                      value={audioSourceType}
                      onValueChange={(val: "upload" | "gdrive") => setAudioSourceType(val)}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="upload" id="audio-upload" />
                        <Label htmlFor="audio-upload">Upload File</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="gdrive" id="audio-gdrive" />
                        <Label htmlFor="audio-gdrive">Google Drive Link</Label>
                      </div>
                    </RadioGroup>

                    {audioSourceType === "upload" ? (
                      <div className="space-y-2">
                        {editingShiur?.audioUrl && !audioFile && (
                          <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-md">
                            <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                            <span className="text-sm text-green-800 truncate">
                              Current audio file attached
                            </span>
                            <span className="text-xs text-green-600 ml-auto flex-shrink-0">
                              Choose a new file below to replace it
                            </span>
                          </div>
                        )}
                        {audioFile && editingShiur?.audioUrl && (
                          <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-md">
                            <Upload className="h-4 w-4 text-amber-600 flex-shrink-0" />
                            <span className="text-sm text-amber-800">
                              Replacing audio with: {audioFile.name}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="ml-auto h-6 px-2 text-xs text-amber-700 hover:text-amber-900"
                              onClick={() => setAudioFile(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        )}
                        <div className="flex gap-2 items-center">
                          <Select
                            value={storageProvider}
                            onValueChange={(val: "b2" | "firebase") => setStorageProvider(val)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="b2">B2</SelectItem>
                              <SelectItem value="firebase">Firebase</SelectItem>
                            </SelectContent>
                          </Select>
                          <span className="text-xs text-muted-foreground">Storage provider</span>
                        </div>
                        <Input
                          type="file"
                          accept="audio/*"
                          onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                        />
                        {audioFile && !editingShiur && <p className="text-sm text-muted-foreground">{audioFile.name}</p>}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {editingShiur?.audioUrl && !gdriveUrl && (
                          <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-md">
                            <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                            <span className="text-sm text-green-800 truncate">
                              Current Google Drive link attached
                            </span>
                          </div>
                        )}
                        <Input
                          placeholder="https://drive.google.com/file/d/..."
                          value={gdriveUrl}
                          onChange={(e) => setGdriveUrl(e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Mareh Mekomos PDF (optional)</Label>
                    {editingShiur?.pdfUrl && !pdfFile && (
                      <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-md">
                        <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                        <span className="text-sm text-green-800 truncate">
                          Current PDF attached
                        </span>
                        <span className="text-xs text-green-600 ml-auto flex-shrink-0">
                          Choose a new file below to replace it
                        </span>
                      </div>
                    )}
                    {pdfFile && editingShiur?.pdfUrl && (
                      <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-md">
                        <Upload className="h-4 w-4 text-amber-600 flex-shrink-0" />
                        <span className="text-sm text-amber-800">
                          Replacing PDF with: {pdfFile.name}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="ml-auto h-6 px-2 text-xs text-amber-700 hover:text-amber-900"
                          onClick={() => setPdfFile(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                    <Input type="file" accept=".pdf" onChange={(e) => setPdfFile(e.target.files?.[0] || null)} />
                    {pdfFile && !editingShiur && <p className="text-sm text-muted-foreground">{pdfFile.name}</p>}
                  </div>

                  {uploadStatus !== "idle" && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {uploadStatus === "complete" ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : uploadStatus === "error" ? (
                          <X className="h-4 w-4 text-destructive" />
                        ) : (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        <span className="text-sm">{getStatusLabel(uploadStatus)}</span>
                      </div>
                      <Progress value={uploadProgress} className="h-2" />
                    </div>
                  )}

                  <Button type="submit" disabled={uploading} className="w-full bg-navy text-cream hover:bg-navy/90">
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : editingShiur ? (
                      "Update Shiur"
                    ) : (
                      "Add Shiur"
                    )}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog
              open={isBulkDialogOpen}
              onOpenChange={(open) => {
                setIsBulkDialogOpen(open)
                if (!open) setBulkEntries([])
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline" onClick={() => setBulkEntries([createEmptyBulkEntry()])}>
                  <ListPlus className="mr-2 h-4 w-4" />
                  Add Multiple
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="font-serif text-2xl text-navy">Bulk Upload Shiurim</DialogTitle>
                  <DialogDescription>Add multiple shiurim at once</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  {bulkEntries.map((entry, index) => (
                    <Card key={entry.id} className="relative">
                      <CardContent className="pt-6 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Shiur {index + 1}</span>
                          {entry.status !== "idle" && (
                            <div className="flex items-center gap-2 text-sm">
                              {entry.status === "complete" ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : entry.status === "error" ? (
                                <span className="text-destructive">{entry.error}</span>
                              ) : (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              )}
                              <span>{getStatusLabel(entry.status)}</span>
                            </div>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeBulkEntry(entry.id)}
                            disabled={bulkUploading}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        {entry.status !== "idle" && <Progress value={entry.progress} className="h-1" />}

                        <div className="grid gap-3 md:grid-cols-3">
                          <Input
                            placeholder="Title *"
                            value={entry.title}
                            onChange={(e) => updateBulkEntry(entry.id, { title: e.target.value })}
                            disabled={bulkUploading}
                            className="font-hebrew"
                          />
                          <Select
                            value={entry.rebbe}
                            onValueChange={(val) => updateBulkEntry(entry.id, { rebbe: val })}
                            disabled={bulkUploading}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Rebbe *" />
                            </SelectTrigger>
                            <SelectContent>
                              {rebbeimOptions.map((rebbe) => (
                                <SelectItem key={rebbe} value={rebbe}>
                                  {rebbe}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="date"
                            value={entry.date}
                            onChange={(e) => updateBulkEntry(entry.id, { date: e.target.value })}
                            disabled={bulkUploading}
                          />
                        </div>

                        <Select
                          value={entry.series || "none"}
                          onValueChange={(val) => updateBulkEntry(entry.id, { series: val === "none" ? "" : val })}
                          disabled={bulkUploading}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Series (optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Series</SelectItem>
                            {seriesOptions.map((series) => (
                              <SelectItem key={series} value={series} className="font-hebrew">
                                {series}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <div className="flex flex-wrap gap-1">
                          {tagsOptions.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => toggleBulkTag(entry.id, tag)}
                              disabled={bulkUploading}
                              className={`px-2 py-0.5 rounded-full text-xs transition-colors ${
                                entry.tags.includes(tag)
                                  ? "bg-gold text-navy"
                                  : "bg-muted text-muted-foreground hover:bg-muted/80"
                              }`}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>

                        <RadioGroup
                          value={entry.audioSourceType}
                          onValueChange={(val: "upload" | "gdrive") =>
                            updateBulkEntry(entry.id, { audioSourceType: val })
                          }
                          className="flex gap-4"
                          disabled={bulkUploading}
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="upload" id={`bulk-upload-${entry.id}`} />
                            <Label htmlFor={`bulk-upload-${entry.id}`}>Upload</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="gdrive" id={`bulk-gdrive-${entry.id}`} />
                            <Label htmlFor={`bulk-gdrive-${entry.id}`}>Google Drive</Label>
                          </div>
                        </RadioGroup>

                        {entry.audioSourceType === "upload" ? (
                          <Input
                            type="file"
                            accept="audio/*"
                            onChange={(e) => updateBulkEntry(entry.id, { audioFile: e.target.files?.[0] || null })}
                            disabled={bulkUploading}
                          />
                        ) : (
                          <Input
                            placeholder="Google Drive URL"
                            value={entry.gdriveUrl}
                            onChange={(e) => updateBulkEntry(entry.id, { gdriveUrl: e.target.value })}
                            disabled={bulkUploading}
                          />
                        )}
                      </CardContent>
                    </Card>
                  ))}

                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={addBulkEntry} disabled={bulkUploading}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Another
                    </Button>
                    <Button
                      onClick={handleBulkUpload}
                      disabled={bulkUploading || bulkEntries.length === 0}
                      className="bg-navy text-cream hover:bg-navy/90"
                    >
                      {bulkUploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>Upload All ({bulkEntries.length})</>
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {filteredShiurim.map((shiur) => (
              <Card key={shiur.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <h3 className="font-serif text-lg font-semibold text-navy font-hebrew">{shiur.title}</h3>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {shiur.rebbe}
                        </span>
                        <span>{new Date(shiur.date).toLocaleDateString()}</span>
                        {shiur.series && (
                          <span className="flex items-center gap-1 text-gold">
                            <Layers className="h-3 w-3" />
                            {shiur.series}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {shiur.tags?.map((tag) => (
                          <span key={tag} className="px-2 py-0.5 bg-muted rounded-full text-xs">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <EngagementHoverCard
                          shiurId={shiur.id}
                          type="plays"
                          total={shiur.playCount || 0}
                        >
                          <Play className="h-3 w-3" />
                          <span>{shiur.playCount || 0} plays</span>
                        </EngagementHoverCard>
                        <EngagementHoverCard
                          shiurId={shiur.id}
                          type="downloads"
                          total={shiur.downloadCount || 0}
                        >
                          <Download className="h-3 w-3" />
                          <span>{shiur.downloadCount || 0} downloads</span>
                        </EngagementHoverCard>
                        {(shiur.uploaderName || shiur.uploadedBy) && (
                          <span className="flex items-center gap-1 text-navy/60">
                            <Upload className="h-3 w-3" />
                            Uploaded by: {shiur.uploaderName || shiur.uploadedBy}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Link2 className="h-3 w-3 text-navy/40 flex-shrink-0" />
                        <code className="text-xs text-navy/50 bg-navy/5 px-2 py-0.5 rounded truncate max-w-md">
                          {typeof window !== "undefined"
                            ? `${window.location.origin}/shiurim?play=${shiur.id}`
                            : `/shiurim?play=${shiur.id}`}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 flex-shrink-0"
                          onClick={() => copyShareLink(shiur.id)}
                        >
                          {copiedLink === shiur.id ? (
                            <Check className="h-3 w-3 text-green-600" />
                          ) : (
                            <Copy className="h-3 w-3 text-navy/50" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(shiur)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(shiur.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSendReminder(shiur)}
                        disabled={sendingReminder === shiur.id}
                      >
                        {sendingReminder === shiur.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="options" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Rebbeim ({rebbeimOptions.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Add new rebbe..."
                    value={newRebbe}
                    onChange={(e) => setNewRebbe(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddRebbe()}
                  />
                  <Button onClick={handleAddRebbe} size="icon" className="bg-navy text-cream">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {rebbeimOptions.map((rebbe) => {
                    const isEditing = editingRebbe === rebbe
                    const count = shiurim.filter((s) => s.rebbe === rebbe).length
                    return (
                      <div key={rebbe} className="flex items-center justify-between gap-2 p-2 bg-muted rounded">
                        {isEditing ? (
                          <>
                            <Input
                              autoFocus
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleRenameRebbe(rebbe)
                                if (e.key === "Escape") cancelEdit()
                              }}
                              disabled={renaming}
                              className="h-8 text-sm"
                            />
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleRenameRebbe(rebbe)}
                                disabled={renaming}
                              >
                                {renaming ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Check className="h-3 w-3 text-green-600" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={cancelEdit}
                                disabled={renaming}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm">{rebbe}</span>
                              <span className="text-xs text-muted-foreground ml-2">({count})</span>
                            </div>
                            <div className="flex items-center gap-0.5 flex-shrink-0">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditRebbe(rebbe)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveRebbe(rebbe)}>
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  Tags ({tagsOptions.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Add new tag..."
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                  />
                  <Button onClick={handleAddTag} size="icon" className="bg-navy text-cream">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {tagsOptions.map((tag) => {
                    const isEditing = editingTag === tag
                    const count = shiurim.filter((s) => Array.isArray(s.tags) && s.tags.includes(tag)).length
                    return (
                      <div key={tag} className="flex items-center justify-between gap-2 p-2 bg-muted rounded">
                        {isEditing ? (
                          <>
                            <Input
                              autoFocus
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleRenameTag(tag)
                                if (e.key === "Escape") cancelEdit()
                              }}
                              disabled={renaming}
                              className="h-8 text-sm"
                            />
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleRenameTag(tag)}
                                disabled={renaming}
                              >
                                {renaming ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Check className="h-3 w-3 text-green-600" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={cancelEdit}
                                disabled={renaming}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm">{tag}</span>
                              <span className="text-xs text-muted-foreground ml-2">({count})</span>
                            </div>
                            <div className="flex items-center gap-0.5 flex-shrink-0">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditTag(tag)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveTag(tag)}>
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5" />
                  Series ({seriesOptions.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Add new series..."
                    value={newSeries}
                    onChange={(e) => setNewSeries(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddSeries()}
                    className="font-hebrew"
                  />
                  <Button onClick={handleAddSeries} size="icon" className="bg-navy text-cream">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {seriesOptions.map((series) => {
                    const count = shiurim.filter((s) => s.series === series).length
                    const isEditing = editingSeries === series
                    return (
                      <div key={series} className="flex items-center justify-between gap-2 p-2 bg-muted rounded">
                        {isEditing ? (
                          <>
                            <Input
                              autoFocus
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleRenameSeries(series)
                                if (e.key === "Escape") cancelEdit()
                              }}
                              disabled={renaming}
                              className="h-8 text-sm font-hebrew"
                            />
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleRenameSeries(series)}
                                disabled={renaming}
                              >
                                {renaming ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Check className="h-3 w-3 text-green-600" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={cancelEdit}
                                disabled={renaming}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-hebrew">{series}</span>
                              <span className="text-xs text-muted-foreground ml-2">({count} shiurim)</span>
                            </div>
                            <div className="flex items-center gap-0.5 flex-shrink-0">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditSeries(series)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveSeries(series)}>
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
