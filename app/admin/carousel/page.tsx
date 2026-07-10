"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore"
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { db, storage } from "@/lib/firebase"
import { Plus, Pencil, Trash2, MoveUp, MoveDown, ImageIcon, Upload, Link } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"

interface CarouselImage {
  id: string
  url: string
  caption?: string
  order: number
  enabled?: boolean
}

export default function CarouselManagement() {
  const [images, setImages] = useState<CarouselImage[]>([])
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingImage, setEditingImage] = useState<CarouselImage | null>(null)
  const [newImage, setNewImage] = useState({ url: "", caption: "" })
  const [uploadMode, setUploadMode] = useState<"upload" | "url">("upload")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const { toast } = useToast()

  useEffect(() => {
    fetchImages()
  }, [])

  const fetchImages = async () => {
    const querySnapshot = await getDocs(collection(db, "carouselImages"))
    const fetchedImages: CarouselImage[] = []
    querySnapshot.forEach((doc) => {
      fetchedImages.push({ id: doc.id, ...doc.data() } as CarouselImage)
    })
    fetchedImages.sort((a, b) => a.order - b.order)
    setImages(fetchedImages)
  }

  const uploadFile = async (file: File): Promise<string> => {
    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
    const storageRef = ref(storage, `carousel/${timestamp}-${safeName}`)

    return new Promise((resolve, reject) => {
      const uploadTask = uploadBytesResumable(storageRef, file)

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          setUploadProgress(progress)
        },
        (error) => {
          reject(error)
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
          resolve(downloadURL)
        },
      )
    })
  }

  const handleAdd = async () => {
    let imageUrl = newImage.url

    if (uploadMode === "upload") {
      if (!selectedFile) {
        toast({
          title: "Error",
          description: "Please select an image to upload",
          variant: "destructive",
        })
        return
      }

      try {
        setUploading(true)
        imageUrl = await uploadFile(selectedFile)
      } catch (error) {
        console.error("Error uploading image:", error)
        toast({
          title: "Error",
          description: "Failed to upload image",
          variant: "destructive",
        })
        setUploading(false)
        return
      }
    } else {
      if (!imageUrl) {
        toast({
          title: "Error",
          description: "Please enter an image URL",
          variant: "destructive",
        })
        return
      }
    }

    try {
      const order = images.length
      await addDoc(collection(db, "carouselImages"), {
        url: imageUrl,
        caption: newImage.caption || "",
        order,
        enabled: true,
      })

      toast({
        title: "Success",
        description: "Carousel image added successfully",
      })

      setNewImage({ url: "", caption: "" })
      setSelectedFile(null)
      setUploadProgress(0)
      setIsAddOpen(false)
      fetchImages()
    } catch (error) {
      console.error("Error adding image:", error)
      toast({
        title: "Error",
        description: "Failed to add carousel image",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
  }

  const handleEdit = async () => {
    if (!editingImage) return

    let imageUrl = editingImage.url

    if (uploadMode === "upload" && selectedFile) {
      try {
        setUploading(true)
        imageUrl = await uploadFile(selectedFile)
      } catch (error) {
        console.error("Error uploading image:", error)
        toast({
          title: "Error",
          description: "Failed to upload image",
          variant: "destructive",
        })
        setUploading(false)
        return
      }
    }

    try {
      const docRef = doc(db, "carouselImages", editingImage.id)
      await updateDoc(docRef, {
        url: imageUrl,
        caption: editingImage.caption || "",
      })

      toast({
        title: "Success",
        description: "Carousel image updated successfully",
      })

      setIsEditOpen(false)
      setEditingImage(null)
      setSelectedFile(null)
      setUploadProgress(0)
      fetchImages()
    } catch (error) {
      console.error("Error updating image:", error)
      toast({
        title: "Error",
        description: "Failed to update carousel image",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this carousel image?")) return

    try {
      await deleteDoc(doc(db, "carouselImages", id))

      toast({
        title: "Success",
        description: "Carousel image deleted successfully",
      })

      fetchImages()
    } catch (error) {
      console.error("Error deleting image:", error)
      toast({
        title: "Error",
        description: "Failed to delete carousel image",
        variant: "destructive",
      })
    }
  }

  const handleToggleEnabled = async (image: CarouselImage) => {
    const next = image.enabled === false ? true : false
    try {
      await updateDoc(doc(db, "carouselImages", image.id), { enabled: next })
      toast({ title: next ? "Image enabled" : "Image hidden from carousel" })
      fetchImages()
    } catch (error) {
      console.error("Error toggling image:", error)
      toast({ title: "Error", description: "Failed to update image", variant: "destructive" })
    }
  }

  const handleMoveUp = async (image: CarouselImage, index: number) => {
    if (index === 0) return

    const prevImage = images[index - 1]
    try {
      await updateDoc(doc(db, "carouselImages", image.id), { order: prevImage.order })
      await updateDoc(doc(db, "carouselImages", prevImage.id), { order: image.order })

      fetchImages()
    } catch (error) {
      console.error("Error reordering images:", error)
      toast({
        title: "Error",
        description: "Failed to reorder images",
        variant: "destructive",
      })
    }
  }

  const handleMoveDown = async (image: CarouselImage, index: number) => {
    if (index === images.length - 1) return

    const nextImage = images[index + 1]
    try {
      await updateDoc(doc(db, "carouselImages", image.id), { order: nextImage.order })
      await updateDoc(doc(db, "carouselImages", nextImage.id), { order: image.order })

      fetchImages()
    } catch (error) {
      console.error("Error reordering images:", error)
      toast({
        title: "Error",
        description: "Failed to reorder images",
        variant: "destructive",
      })
    }
  }

  const resetForm = () => {
    setNewImage({ url: "", caption: "" })
    setSelectedFile(null)
    setUploadProgress(0)
    setUploadMode("upload")
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-navy mb-2">Carousel Management</h1>
          <p className="text-navy/70">Manage homepage carousel images</p>
        </div>

        <Dialog
          open={isAddOpen}
          onOpenChange={(open) => {
            setIsAddOpen(open)
            if (!open) resetForm()
          }}
        >
          <DialogTrigger asChild>
            <Button className="bg-navy text-cream hover:bg-navy/90">
              <Plus className="mr-2 h-4 w-4" />
              Add Image
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Carousel Image</DialogTitle>
              <DialogDescription>Add a new image to the homepage carousel</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
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
                <div>
                  <Label htmlFor="add-file">Select Image *</Label>
                  <Input
                    id="add-file"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="mt-1"
                  />
                  {selectedFile && (
                    <div className="mt-2">
                      <img
                        src={URL.createObjectURL(selectedFile) || "/placeholder.svg"}
                        alt="Preview"
                        className="w-full h-32 object-cover rounded-lg"
                      />
                    </div>
                  )}
                  {uploading && (
                    <div className="mt-2">
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
                <div>
                  <Label htmlFor="add-url">Image URL *</Label>
                  <Input
                    id="add-url"
                    value={newImage.url}
                    onChange={(e) => setNewImage({ ...newImage, url: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="add-caption">Caption (optional)</Label>
                <Textarea
                  id="add-caption"
                  value={newImage.caption}
                  onChange={(e) => setNewImage({ ...newImage, caption: e.target.value })}
                  placeholder="A brief description of the image..."
                  rows={2}
                />
              </div>
              <Button onClick={handleAdd} disabled={uploading} className="w-full bg-navy text-cream hover:bg-navy/90">
                {uploading ? "Uploading..." : "Add Image"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {images.map((image, index) => {
          const isEnabled = image.enabled !== false
          return (
          <Card key={image.id} className={`border-gold/20 bg-white shadow-lg ${isEnabled ? "" : "opacity-60"}`}>
            <CardHeader className="pb-3">
              <div className="aspect-video relative overflow-hidden rounded-lg bg-navy/5">
                <img
                  src={image.url || "/placeholder.svg"}
                  alt={image.caption || "Carousel image"}
                  className={`h-full w-full object-cover ${isEnabled ? "" : "grayscale"}`}
                />
                {!isEnabled && (
                  <span className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 font-medium">
                    Hidden
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium text-navy">Order: {index + 1}</p>
                {image.caption && <p className="text-sm text-navy/70 mt-1 line-clamp-2">{image.caption}</p>}
              </div>

              <div className="flex items-center justify-between p-2 bg-navy/5 rounded-md">
                <Label htmlFor={`enabled-${image.id}`} className="text-sm text-navy/70 cursor-pointer">
                  Show in carousel
                </Label>
                <Switch
                  id={`enabled-${image.id}`}
                  checked={isEnabled}
                  onCheckedChange={() => handleToggleEnabled(image)}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleMoveUp(image, index)}
                  disabled={index === 0}
                  className="flex-1"
                >
                  <MoveUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleMoveDown(image, index)}
                  disabled={index === images.length - 1}
                  className="flex-1"
                >
                  <MoveDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingImage(image)
                    setUploadMode("url")
                    setIsEditOpen(true)
                  }}
                  className="flex-1"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDelete(image.id)} className="flex-1">
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </CardContent>
          </Card>
          )
        })}

        {images.length === 0 && (
          <Card className="border-gold/20 bg-white shadow-lg col-span-full">
            <CardContent className="py-12 text-center">
              <ImageIcon className="h-12 w-12 text-navy/30 mx-auto mb-4" />
              <p className="text-navy/70 mb-4">No carousel images yet</p>
              <Button onClick={() => setIsAddOpen(true)} className="bg-navy text-cream hover:bg-navy/90">
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Image
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {editingImage && (
        <Dialog
          open={isEditOpen}
          onOpenChange={(open) => {
            setIsEditOpen(open)
            if (!open) {
              setSelectedFile(null)
              setUploadProgress(0)
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Carousel Image</DialogTitle>
              <DialogDescription>Update the carousel image details</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={uploadMode === "upload" ? "default" : "outline"}
                  onClick={() => setUploadMode("upload")}
                  className={uploadMode === "upload" ? "bg-navy text-cream" : ""}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload New
                </Button>
                <Button
                  type="button"
                  variant={uploadMode === "url" ? "default" : "outline"}
                  onClick={() => setUploadMode("url")}
                  className={uploadMode === "url" ? "bg-navy text-cream" : ""}
                >
                  <Link className="mr-2 h-4 w-4" />
                  Edit URL
                </Button>
              </div>

              {uploadMode === "upload" ? (
                <div>
                  <Label htmlFor="edit-file">Select New Image</Label>
                  <Input
                    id="edit-file"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="mt-1"
                  />
                  {selectedFile ? (
                    <div className="mt-2">
                      <img
                        src={URL.createObjectURL(selectedFile) || "/placeholder.svg"}
                        alt="Preview"
                        className="w-full h-32 object-cover rounded-lg"
                      />
                    </div>
                  ) : (
                    <div className="mt-2">
                      <p className="text-sm text-navy/60 mb-1">Current image:</p>
                      <img
                        src={editingImage.url || "/placeholder.svg"}
                        alt="Current"
                        className="w-full h-32 object-cover rounded-lg"
                      />
                    </div>
                  )}
                  {uploading && (
                    <div className="mt-2">
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
                <div>
                  <Label htmlFor="edit-url">Image URL *</Label>
                  <Input
                    id="edit-url"
                    value={editingImage.url}
                    onChange={(e) => setEditingImage({ ...editingImage, url: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="edit-caption">Caption (optional)</Label>
                <Textarea
                  id="edit-caption"
                  value={editingImage.caption}
                  onChange={(e) => setEditingImage({ ...editingImage, caption: e.target.value })}
                  placeholder="A brief description of the image..."
                  rows={2}
                />
              </div>
              <Button onClick={handleEdit} disabled={uploading} className="w-full bg-navy text-cream hover:bg-navy/90">
                {uploading ? "Uploading..." : "Update Image"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
