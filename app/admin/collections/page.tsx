"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Pencil, Trash2, Search, BookOpen, GripVertical } from "lucide-react"
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
  query,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { computeTimerFields, formatExpiryCountdown } from "@/lib/expiry"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface Shiur {
  id: string
  title: string
  rebbe: string
  date: string
  tags: string[]
}

interface ShiurCollection {
  id: string
  name: string
  description: string
  shiurIds: string[]
  isActive: boolean
  createdAt: string
  hideAfterDays?: number | null
  timerStartAt?: string | null
}

export default function CollectionsPage() {
  const [collections, setCollections] = useState<ShiurCollection[]>([])
  const [shiurim, setShiurim] = useState<Shiur[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCollection, setEditingCollection] = useState<ShiurCollection | null>(null)
  const [activatingCollection, setActivatingCollection] = useState<ShiurCollection | null>(null)
  const [activationDays, setActivationDays] = useState("")
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    hideAfterDays: "" as string,
  })
  const [selectedShiurim, setSelectedShiurim] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchCollections()
    fetchShiurim()
  }, [])

  const fetchCollections = async () => {
    const collectionsRef = collection(db, "shiurCollections")
    const querySnapshot = await getDocs(collectionsRef)
    const collectionsData: ShiurCollection[] = []
    querySnapshot.forEach((doc) => {
      collectionsData.push({ id: doc.id, ...doc.data() } as ShiurCollection)
    })
    collectionsData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    setCollections(collectionsData)
  }

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedShiurim.length === 0) {
      toast({ title: "Please select at least one shiur", variant: "destructive" })
      return
    }

    setLoading(true)

    try {
      const parsedDays = formData.hideAfterDays ? Number(formData.hideAfterDays) : null
      const timer = computeTimerFields(parsedDays, editingCollection)

      const collectionData = {
        name: formData.name,
        description: formData.description,
        shiurIds: selectedShiurim,
        isActive: editingCollection?.isActive || false,
        createdAt: editingCollection?.createdAt || new Date().toISOString(),
        hideAfterDays: timer.hideAfterDays,
        timerStartAt: timer.timerStartAt,
      }

      if (editingCollection) {
        await updateDoc(doc(db, "shiurCollections", editingCollection.id), collectionData)
        toast({ title: "Collection updated successfully" })
      } else {
        await addDoc(collection(db, "shiurCollections"), collectionData)
        toast({ title: "Collection created successfully" })
      }

      setIsDialogOpen(false)
      resetForm()
      fetchCollections()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (coll: ShiurCollection) => {
    setEditingCollection(coll)
    setFormData({
      name: coll.name,
      description: coll.description,
      hideAfterDays: coll.hideAfterDays ? String(coll.hideAfterDays) : "",
    })
    setSelectedShiurim(coll.shiurIds || [])
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this collection?")) return

    try {
      await deleteDoc(doc(db, "shiurCollections", id))
      toast({ title: "Collection deleted successfully" })
      fetchCollections()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  // Direct deactivation (no prompt). Used when toggling switch from on → off.
  const handleDeactivate = async (coll: ShiurCollection) => {
    try {
      await updateDoc(doc(db, "shiurCollections", coll.id), { isActive: false })
      toast({ title: "Collection deactivated" })
      fetchCollections()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  // Open the activation prompt — admin picks how long the collection stays active.
  const openActivationDialog = (coll: ShiurCollection) => {
    setActivatingCollection(coll)
    setActivationDays(coll.hideAfterDays ? String(coll.hideAfterDays) : "")
  }

  // Confirm activation: deactivate any other active collection, then set this one
  // active and (re)start its timer.
  const confirmActivation = async () => {
    if (!activatingCollection) return
    try {
      // Only one collection can be active on the homepage at a time
      for (const c of collections) {
        if (c.isActive && c.id !== activatingCollection.id) {
          await updateDoc(doc(db, "shiurCollections", c.id), { isActive: false })
        }
      }

      const parsedDays = activationDays ? Number(activationDays) : null
      const timer = computeTimerFields(parsedDays, null) // Always restart timer on activation
      await updateDoc(doc(db, "shiurCollections", activatingCollection.id), {
        isActive: true,
        hideAfterDays: timer.hideAfterDays,
        timerStartAt: timer.timerStartAt,
      })

      toast({
        title: "Collection is now active on homepage",
        description: parsedDays && parsedDays > 0 ? `Auto-deactivates in ${parsedDays} day${parsedDays === 1 ? "" : "s"}.` : "No auto-deactivate set.",
      })
      setActivatingCollection(null)
      setActivationDays("")
      fetchCollections()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const resetForm = () => {
    setEditingCollection(null)
    setFormData({ name: "", description: "", hideAfterDays: "" })
    setSelectedShiurim([])
    setSearchQuery("")
  }

  const toggleShiur = (shiurId: string) => {
    if (selectedShiurim.includes(shiurId)) {
      setSelectedShiurim(selectedShiurim.filter((id) => id !== shiurId))
    } else {
      setSelectedShiurim([...selectedShiurim, shiurId])
    }
  }

  const filteredShiurim = shiurim.filter(
    (shiur) =>
      shiur.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shiur.rebbe.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getShiurById = (id: string) => shiurim.find((s) => s.id === id)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-navy mb-2">Shiur Collections</h1>
          <p className="text-navy/70">Create collections of shiurim for parsha, yom tov, or special topics</p>
        </div>
        <Button
          onClick={() => {
            resetForm()
            setIsDialogOpen(true)
          }}
          className="bg-navy text-cream hover:bg-navy/90"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Collection
        </Button>
      </div>

      <div className="grid gap-4">
        {collections.length === 0 ? (
          <Card className="border-gold/20 bg-white">
            <CardContent className="py-12 text-center">
              <BookOpen className="h-12 w-12 text-navy/30 mx-auto mb-4" />
              <p className="text-navy/60">No collections yet. Create your first collection!</p>
            </CardContent>
          </Card>
        ) : (
          collections.map((coll) => (
            <Card key={coll.id} className={`border-gold/20 bg-white ${coll.isActive ? "ring-2 ring-gold" : ""}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <CardTitle className="text-navy">{coll.name}</CardTitle>
                      {coll.isActive && (
                        <span className="px-2 py-1 bg-gold/20 text-gold-dark text-xs font-medium rounded">
                          Active on Homepage
                        </span>
                      )}
                      {(() => {
                        const countdown = formatExpiryCountdown(coll)
                        if (!countdown) return null
                        const isGone = countdown.startsWith("expired")
                        return (
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded ${
                              isGone ? "bg-red-100 text-red-700" : "bg-navy/10 text-navy/70"
                            }`}
                          >
                            {countdown}
                          </span>
                        )
                      })()}
                    </div>
                    {coll.description && (
                      <p className="text-navy/60 text-sm mt-1">{coll.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 mr-4">
                      <Label htmlFor={`active-${coll.id}`} className="text-sm text-navy/70">
                        Show on Homepage
                      </Label>
                      <Switch
                        id={`active-${coll.id}`}
                        checked={coll.isActive}
                        onCheckedChange={(checked) => {
                          if (checked) openActivationDialog(coll)
                          else handleDeactivate(coll)
                        }}
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(coll)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => handleDelete(coll.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-navy/60 mb-2">{coll.shiurIds?.length || 0} shiurim in this collection</p>
                <div className="flex flex-wrap gap-2">
                  {coll.shiurIds?.slice(0, 5).map((shiurId) => {
                    const shiur = getShiurById(shiurId)
                    return shiur ? (
                      <span
                        key={shiurId}
                        className="px-2 py-1 bg-navy/5 text-navy text-xs rounded"
                      >
                        {shiur.title}
                      </span>
                    ) : null
                  })}
                  {(coll.shiurIds?.length || 0) > 5 && (
                    <span className="px-2 py-1 bg-navy/5 text-navy/60 text-xs rounded">
                      +{coll.shiurIds.length - 5} more
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog
        open={activatingCollection !== null}
        onOpenChange={(open) => {
          if (!open) {
            setActivatingCollection(null)
            setActivationDays("")
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Activate Collection</DialogTitle>
            <DialogDescription>
              "{activatingCollection?.name}" will appear on the home page. Any other active collection will be deactivated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="activation-days">Auto-deactivate after (days)</Label>
            <Input
              id="activation-days"
              type="number"
              min={1}
              placeholder="Leave blank to keep on home page indefinitely"
              value={activationDays}
              onChange={(e) => setActivationDays(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  confirmActivation()
                }
              }}
            />
            <p className="text-xs text-navy/60">
              Timer starts now. The collection will be hidden from the home page after this many days.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setActivatingCollection(null)
                setActivationDays("")
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={confirmActivation} className="bg-navy text-cream hover:bg-navy/90">
              Activate
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCollection ? "Edit Collection" : "Create New Collection"}</DialogTitle>
            <DialogDescription>
              {editingCollection ? "Update the collection details and shiurim." : "Create a new collection of shiurim for parsha, yom tov, or special topics."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Collection Name *</Label>
              <Input
                id="name"
                required
                placeholder="e.g., Parshas Vayikra, Pesach Shiurim"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                rows={2}
                placeholder="Brief description of this collection..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hideAfterDays">Auto-hide after (days, optional)</Label>
              <Input
                id="hideAfterDays"
                type="number"
                min={1}
                placeholder="Leave blank to never auto-hide"
                value={formData.hideAfterDays}
                onChange={(e) => setFormData({ ...formData, hideAfterDays: e.target.value })}
              />
              <p className="text-xs text-navy/50">
                Collection will be hidden from the site after this many days.
                {editingCollection?.timerStartAt && formData.hideAfterDays
                  ? ` Timer started ${new Date(editingCollection.timerStartAt).toLocaleDateString()}.`
                  : ""}
              </p>
            </div>

            <div className="space-y-3">
              <Label>Select Shiurim *</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy/40" />
                <Input
                  placeholder="Search shiurim..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {selectedShiurim.length > 0 && (
                <p className="text-sm text-navy/60">{selectedShiurim.length} shiurim selected</p>
              )}

              <div className="border rounded-lg max-h-64 overflow-y-auto">
                {filteredShiurim.map((shiur) => {
                  const isSelected = selectedShiurim.includes(shiur.id)
                  return (
                    <div
                      key={shiur.id}
                      className={`flex items-center gap-3 p-3 border-b last:border-b-0 hover:bg-navy/5 cursor-pointer ${
                        isSelected ? "bg-gold/10" : ""
                      }`}
                      onClick={() => toggleShiur(shiur.id)}
                    >
                      <Checkbox
                        checked={isSelected}
                        onClick={(e) => e.stopPropagation()}
                        onCheckedChange={() => toggleShiur(shiur.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-navy truncate">{shiur.title}</p>
                        <p className="text-sm text-navy/60">
                          {shiur.rebbe} - {new Date(shiur.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setIsDialogOpen(false); resetForm(); }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 bg-navy text-cream hover:bg-navy/90"
              >
                {loading ? "Saving..." : editingCollection ? "Update Collection" : "Create Collection"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
