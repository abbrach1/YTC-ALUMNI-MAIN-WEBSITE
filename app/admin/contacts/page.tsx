"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Pencil, Trash2, FileSpreadsheet, Download, Users } from "lucide-react"
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch } from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { db, storage } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import * as XLSX from "xlsx"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"

interface Rebbe {
  id: string
  name: string
  title: string
  email?: string
  phone?: string
  photoUrl?: string
}

interface RebbeImport {
  name: string
  title: string
  email?: string
  phone?: string
}

export default function AdminContactsPage() {
  const [rebbeim, setRebbeim] = useState<Rebbe[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [importPreview, setImportPreview] = useState<RebbeImport[]>([])
  const [editingRebbe, setEditingRebbe] = useState<Rebbe | null>(null)
  const [formData, setFormData] = useState({ name: "", title: "", email: "", phone: "" })
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchRebbeim()
  }, [])

  const fetchRebbeim = async () => {
    const snapshot = await getDocs(collection(db, "rebbeim"))
    const data: Rebbe[] = []
    snapshot.forEach((doc) => {
      data.push({ id: doc.id, ...doc.data() } as Rebbe)
    })
    setRebbeim(data)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setUploading(true)

    try {
      let photoUrl = editingRebbe?.photoUrl || ""

      if (photoFile) {
        const photoRef = ref(storage, `rebbe-photos/${Date.now()}-${photoFile.name}`)
        await uploadBytes(photoRef, photoFile)
        photoUrl = await getDownloadURL(photoRef)
      }

      const rebbeData = { ...formData, photoUrl }

      if (editingRebbe) {
        await updateDoc(doc(db, "rebbeim", editingRebbe.id), rebbeData)
        toast({ title: "Rebbe updated successfully" })
      } else {
        await addDoc(collection(db, "rebbeim"), rebbeData)
        toast({ title: "Rebbe added successfully" })
      }

      setIsDialogOpen(false)
      resetForm()
      fetchRebbeim()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure?")) return
    await deleteDoc(doc(db, "rebbeim", id))
    toast({ title: "Rebbe deleted" })
    fetchRebbeim()
  }

  const resetForm = () => {
    setEditingRebbe(null)
    setFormData({ name: "", title: "", email: "", phone: "" })
    setPhotoFile(null)
  }

  const handleExcelFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: "array" })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][]

        const records: RebbeImport[] = []
        // Check if first row is header
        const firstRow = jsonData[0]?.map(cell => String(cell || "").toLowerCase()) || []
        const hasHeader = firstRow.includes("name") || firstRow.includes("title")
        const startRow = hasHeader ? 1 : 0

        for (let i = startRow; i < jsonData.length; i++) {
          const row = jsonData[i]
          if (!row || row.length < 2) continue

          const name = String(row[0] || "").trim()
          const title = String(row[1] || "").trim()
          const email = row[2] ? String(row[2]).trim() : undefined
          const phone = row[3] ? String(row[3]).trim() : undefined

          if (name && title) {
            records.push({ name, title, email, phone })
          }
        }

        if (records.length === 0) {
          toast({
            title: "Error",
            description: "No valid records found. Ensure Column A is Name, B is Title, C is Email (optional), D is Phone (optional)",
            variant: "destructive",
          })
          return
        }

        setImportPreview(records)
        toast({ title: `Found ${records.length} Rebbeim to import` })
      } catch (error: any) {
        toast({ title: "Error", description: "Failed to parse Excel file: " + error.message, variant: "destructive" })
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleImport = async () => {
    if (importPreview.length === 0) return

    try {
      setUploading(true)
      const batch = writeBatch(db)

      importPreview.forEach((record) => {
        const docRef = doc(collection(db, "rebbeim"))
        batch.set(docRef, {
          name: record.name,
          title: record.title,
          email: record.email || "",
          phone: record.phone || "",
          photoUrl: "",
        })
      })

      await batch.commit()

      toast({ title: "Success", description: `Imported ${importPreview.length} Rebbeim` })
      setIsImportDialogOpen(false)
      setImportPreview([])
      fetchRebbeim()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  const handleExportExcel = () => {
    const exportData = rebbeim.map((r) => ({
      Name: r.name,
      Title: r.title,
      Email: r.email || "",
      Phone: r.phone || "",
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Rebbeim")
    XLSX.writeFile(wb, `rebbeim-directory-${new Date().toISOString().split("T")[0]}.xlsx`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-navy mb-2">Rebbeim Directory</h1>
        <p className="text-navy/70">Manage Rebbeim contact information</p>
      </div>

      <div className="flex flex-wrap gap-3">
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
              Add Rebbe
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl text-navy">
                {editingRebbe ? "Edit Rebbe" : "Add Rebbe"}
              </DialogTitle>
              <DialogDescription>
                {editingRebbe ? "Update the Rebbe's information" : "Add a new Rebbe to the directory"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Photo</Label>
                <Input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} />
              </div>
              <Button type="submit" disabled={uploading} className="w-full bg-navy text-cream">
                {uploading ? "Uploading..." : editingRebbe ? "Update" : "Add"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <Button
          onClick={() => setIsImportDialogOpen(true)}
          variant="outline"
          className="border-navy text-navy bg-transparent"
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Import Excel
        </Button>

        <Button
          onClick={handleExportExcel}
          variant="outline"
          className="border-navy text-navy bg-transparent"
        >
          <Download className="mr-2 h-4 w-4" />
          Export Excel
        </Button>
      </div>

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-navy">Import Rebbeim from Excel</DialogTitle>
            <DialogDescription>
              Upload an Excel file with columns: Name, Title, Email (optional), Phone (optional)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Excel File (.xlsx, .xls)</Label>
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelFile}
              />
            </div>

            {importPreview.length > 0 && (
              <div className="space-y-2">
                <Label>Preview ({importPreview.length} records)</Label>
                <div className="max-h-60 overflow-y-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-navy/5 sticky top-0">
                      <tr>
                        <th className="text-left p-2 text-navy">Name</th>
                        <th className="text-left p-2 text-navy">Title</th>
                        <th className="text-left p-2 text-navy">Email</th>
                        <th className="text-left p-2 text-navy">Phone</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.slice(0, 20).map((record, idx) => (
                        <tr key={idx} className="border-t border-gold/20">
                          <td className="p-2">{record.name}</td>
                          <td className="p-2">{record.title}</td>
                          <td className="p-2 text-navy/70">{record.email || "-"}</td>
                          <td className="p-2 text-navy/70">{record.phone || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {importPreview.length > 20 && (
                    <p className="text-center text-sm text-navy/50 py-2">
                      ... and {importPreview.length - 20} more
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsImportDialogOpen(false)
                setImportPreview([])
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={importPreview.length === 0 || uploading}
              className="bg-navy text-cream hover:bg-navy/90"
            >
              {uploading ? "Importing..." : `Import ${importPreview.length} Rebbeim`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="border-gold/20 bg-white shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-gold" />
            <CardTitle className="text-navy">Rebbeim ({rebbeim.length})</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {rebbeim.map((rebbe) => (
              <div
                key={rebbe.id}
                className="flex items-start justify-between border-b border-gold/20 pb-4 last:border-0"
              >
                <div>
                  <h3 className="font-semibold text-navy">{rebbe.name}</h3>
                  <p className="text-sm text-navy/70">{rebbe.title}</p>
                  {rebbe.email && <p className="text-xs text-navy/50">{rebbe.email}</p>}
                  {rebbe.phone && <p className="text-xs text-navy/50">{rebbe.phone}</p>}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingRebbe(rebbe)
                      setFormData({
                        name: rebbe.name,
                        title: rebbe.title,
                        email: rebbe.email || "",
                        phone: rebbe.phone || "",
                      })
                      setIsDialogOpen(true)
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(rebbe.id)}
                    className="border-destructive text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {rebbeim.length === 0 && <p className="text-center text-navy/50 py-8">No Rebbeim yet.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
