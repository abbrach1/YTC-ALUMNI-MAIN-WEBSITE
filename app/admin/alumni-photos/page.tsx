"use client"
import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { uploadToB2 } from "@/lib/b2-upload"
import { useToast } from "@/hooks/use-toast"
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Users, Upload, Link } from "lucide-react"

interface AlumniPhoto {
  id: string
  url: string
  caption: string
  name?: string
  year?: string
  order: number
}

export default function AlumniPhotosPage() {
  const [photos, setPhotos] = useState<AlumniPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingPhoto, setEditingPhoto] = useState<AlumniPhoto | null>(null)
  const [formData, setFormData] = useState({
    url: "",
    caption: "",
    name: "",
    year: "",
  })
  const [uploadMode, setUploadMode] = useState<"upload" | "url">("upload")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const { toast } = useToast()

  useEffect(() => {
    fetchPhotos()
  }, [])

  const fetchPhotos = async () => {
    setLoading(true)
    try {
      const querySnapshot = await getDocs(collection(db, "alumniPhotos"))
      const items: AlumniPhoto[] = []
      querySnapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as AlumniPhoto)
      })
      items.sort((a, b) => a.order - b.order)
      setPhotos(items)
    } catch (error) {
      console.error("Error fetching photos:", error)
    } finally {
      setLoading(false)
    }
  }

  const uploadFile = async (file: File): Promise<string> => {
    return await uploadToB2(file, "alumni/photos", (progress) => {
      setUploadProgress(progress)
    })
  }

  const openAddDialog = () => {
    setEditingPhoto(null)
    setFormData({ url: "", caption: "", name: "", year: "" })
    setUploadMode("upload")
    setSelectedFile(null)
    setUploadProgress(0)
    setShowDialog(true)
  }

  const openEditDialog = (photo: AlumniPhoto) => {
    setEditingPhoto(photo)
    setFormData({
      url: photo.url,
      caption: photo.caption || "",
      name: photo.name || "",
      year: photo.year || "",
    })
    setUploadMode("url")
    setSelectedFile(null)
    setUploadProgress(0)
    setShowDialog(true)
  }

  const handleSave = async () => {
    let imageUrl = formData.url

    if (uploadMode === "upload") {
      if (!selectedFile && !editingPhoto) {
        toast({ title: "Please select an image to upload", variant: "destructive" })
        return
      }

      if (selectedFile) {
        try {
          setUploading(true)
          imageUrl = await uploadFile(selectedFile)
        } catch (error) {
          console.error("Error uploading image:", error)
          toast({ title: "Failed to upload image", variant: "destructive" })
          setUploading(false)
          return
        }
      } else if (editingPhoto) {
        imageUrl = editingPhoto.url
      }
    } else {
      if (!imageUrl && !editingPhoto) {
        toast({ title: "Please provide an image URL", variant: "destructive" })
        return
      }
    }

    try {
      const id = editingPhoto?.id || `photo_${Date.now()}`
      const order = editingPhoto?.order ?? photos.length
      await setDoc(doc(db, "alumniPhotos", id), {
        url: imageUrl,
        caption: formData.caption,
        name: formData.name,
        year: formData.year,
        order,
        updatedAt: new Date().toISOString(),
      })
      toast({ title: editingPhoto ? "Photo updated" : "Photo added" })
      setShowDialog(false)
      setSelectedFile(null)
      setUploadProgress(0)
      fetchPhotos()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this photo?")) return

    try {
      await deleteDoc(doc(db, "alumniPhotos", id))
      toast({ title: "Photo deleted" })
      fetchPhotos()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const movePhoto = async (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= photos.length) return

    const newPhotos = [...photos]
    const temp = newPhotos[index]
    newPhotos[index] = newPhotos[newIndex]
    newPhotos[newIndex] = temp

    for (let i = 0; i < newPhotos.length; i++) {
      await setDoc(doc(db, "alumniPhotos", newPhotos[i].id), {
        ...newPhotos[i],
        order: i,
      })
    }

    fetchPhotos()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-navy mb-2">Alumni Photos</h1>
          <p className="text-navy/70">Manage alumni spotlight photos on the home page</p>
        </div>
        <Button onClick={openAddDialog} className="bg-gold text-navy hover:bg-gold/90">
          <Plus className="mr-2 h-4 w-4" />
          Add Photo
        </Button>
      </div>

      {loading ? (
        <Card className="border-gold/20">
          <CardContent className="py-12 text-center">
            <div className="h-8 w-8 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto" />
          </CardContent>
        </Card>
      ) : photos.length === 0 ? (
        <Card className="border-gold/20">
          <CardContent className="py-12 text-center">
            <Users className="mx-auto h-12 w-12 text-navy/30 mb-4" />
            <p className="text-navy/70">No alumni photos yet</p>
            <Button onClick={openAddDialog} className="mt-4 bg-gold text-navy hover:bg-gold/90">
              Add Your First Photo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo, index) => (
            <Card key={photo.id} className="border-gold/20 overflow-hidden">
              <div className="aspect-square overflow-hidden bg-navy/5">
                <img
                  src={photo.url || "/placeholder.svg"}
                  alt={photo.caption || "Alumni photo"}
                  className="h-full w-full object-cover"
                />
              </div>
              <CardContent className="p-3">
                {photo.name && <p className="font-serif font-semibold text-navy text-sm">{photo.name}</p>}
                {photo.year && <p className="text-xs text-gold font-medium">Class of {photo.year}</p>}
                {photo.caption && <p className="text-xs text-navy/70 mt-1 line-clamp-2">{photo.caption}</p>}
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-gold/10">
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => movePhoto(index, "up")}
                      disabled={index === 0}
                      className="h-7 w-7 text-navy/60"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => movePhoto(index, "down")}
                      disabled={index === photos.length - 1}
                      className="h-7 w-7 text-navy/60"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(photo)}
                      className="h-7 w-7 text-navy/60 hover:text-navy"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(photo.id)}
                      className="h-7 w-7 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={showDialog}
        onOpenChange={(open) => {
          setShowDialog(open)
          if (!open) {
            setSelectedFile(null)
            setUploadProgress(0)
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-navy">{editingPhoto ? "Edit Photo" : "Add Alumni Photo"}</DialogTitle>
            <DialogDescription>
              {editingPhoto ? "Update the photo details" : "Add a photo to the alumni spotlight section"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={uploadMode === "upload" ? "default" : "outline"}
                onClick={() => setUploadMode("upload")}
                className={uploadMode === "upload" ? "bg-navy text-cream" : ""}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload File
              </Button>
              <Button
                type="button"
                variant={uploadMode === "url" ? "default" : "outline"}
                onClick={() => setUploadMode("url")}
                className={uploadMode === "url" ? "bg-navy text-cream" : ""}
              >
                <Link className="mr-2 h-4 w-4" />
                Paste URL
              </Button>
            </div>

            {uploadMode === "upload" ? (
              <div className="space-y-2">
                <Label htmlFor="file">Select Image {!editingPhoto && "*"}</Label>
                <Input
                  id="file"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
                {selectedFile ? (
                  <div className="rounded-lg overflow-hidden border border-gold/20">
                    <img
                      src={URL.createObjectURL(selectedFile) || "/placeholder.svg"}
                      alt="Preview"
                      className="w-full aspect-square object-cover"
                    />
                  </div>
                ) : editingPhoto ? (
                  <div className="rounded-lg overflow-hidden border border-gold/20">
                    <p className="text-sm text-navy/60 p-2 bg-navy/5">Current image (select new to replace):</p>
                    <img
                      src={editingPhoto.url || "/placeholder.svg"}
                      alt="Current"
                      className="w-full aspect-square object-cover"
                    />
                  </div>
                ) : null}
                {uploading && (
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
            ) : (
              <div className="space-y-2">
                <Label htmlFor="url">Image URL *</Label>
                <Input
                  id="url"
                  placeholder="https://example.com/image.jpg"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                />
                {formData.url && (
                  <div className="rounded-lg overflow-hidden border border-gold/20">
                    <img
                      src={formData.url || "/placeholder.svg"}
                      alt="Preview"
                      className="w-full aspect-square object-cover"
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).src = "/placeholder.svg"
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name (Optional)</Label>
                <Input
                  id="name"
                  placeholder="e.g., Yosef Cohen"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">Graduation Year (Optional)</Label>
                <Input
                  id="year"
                  placeholder="e.g., 2020"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="caption">Caption (Optional)</Label>
              <Input
                id="caption"
                placeholder="e.g., Now learning in Kollel Ner Yisroel"
                value={formData.caption}
                onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowDialog(false)} className="border-navy/20">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={uploading} className="bg-navy text-cream hover:bg-navy/90">
              {uploading ? "Uploading..." : editingPhoto ? "Save Changes" : "Add Photo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
