"use client"
import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { Plus, Pencil, Trash2, Megaphone, PartyPopper } from "lucide-react"

interface Announcement {
  id: string
  title: string
  content: string
  type: "mazel_tov" | "announcement"
  date: string
  enabled: boolean
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingItem, setEditingItem] = useState<Announcement | null>(null)
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    type: "announcement" as "mazel_tov" | "announcement",
    date: new Date().toISOString().split("T")[0],
    enabled: true,
  })
  const { toast } = useToast()

  useEffect(() => {
    fetchAnnouncements()
  }, [])

  const fetchAnnouncements = async () => {
    setLoading(true)
    try {
      const querySnapshot = await getDocs(collection(db, "announcements"))
      const items: Announcement[] = []
      querySnapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as Announcement)
      })
      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setAnnouncements(items)
    } catch (error) {
      console.error("Error fetching announcements:", error)
    } finally {
      setLoading(false)
    }
  }

  const openAddDialog = () => {
    setEditingItem(null)
    setFormData({
      title: "",
      content: "",
      type: "announcement",
      date: new Date().toISOString().split("T")[0],
      enabled: true,
    })
    setShowDialog(true)
  }

  const openEditDialog = (item: Announcement) => {
    setEditingItem(item)
    setFormData({
      title: item.title,
      content: item.content,
      type: item.type,
      date: item.date,
      enabled: item.enabled,
    })
    setShowDialog(true)
  }

  const handleSave = async () => {
    if (!formData.title || !formData.content) {
      toast({ title: "Please fill in all required fields", variant: "destructive" })
      return
    }

    try {
      const id = editingItem?.id || `announcement_${Date.now()}`
      await setDoc(doc(db, "announcements", id), {
        ...formData,
        updatedAt: new Date().toISOString(),
      })
      toast({ title: editingItem ? "Announcement updated" : "Announcement added" })
      setShowDialog(false)
      fetchAnnouncements()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this announcement?")) return

    try {
      await deleteDoc(doc(db, "announcements", id))
      toast({ title: "Announcement deleted" })
      fetchAnnouncements()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const toggleEnabled = async (item: Announcement) => {
    try {
      await setDoc(doc(db, "announcements", item.id), {
        ...item,
        enabled: !item.enabled,
        updatedAt: new Date().toISOString(),
      })
      fetchAnnouncements()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-navy mb-2">Mazel Tovs & Announcements</h1>
          <p className="text-navy/70">Manage announcements displayed on the home page</p>
        </div>
        <Button onClick={openAddDialog} className="bg-gold text-navy hover:bg-gold/90">
          <Plus className="mr-2 h-4 w-4" />
          Add New
        </Button>
      </div>

      {loading ? (
        <Card className="border-gold/20">
          <CardContent className="py-12 text-center">
            <div className="h-8 w-8 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto" />
          </CardContent>
        </Card>
      ) : announcements.length === 0 ? (
        <Card className="border-gold/20">
          <CardContent className="py-12 text-center">
            <Megaphone className="mx-auto h-12 w-12 text-navy/30 mb-4" />
            <p className="text-navy/70">No announcements yet</p>
            <Button onClick={openAddDialog} className="mt-4 bg-gold text-navy hover:bg-gold/90">
              Add Your First Announcement
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {announcements.map((item) => (
            <Card key={item.id} className={`border-gold/20 ${!item.enabled ? "opacity-60" : ""}`}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    {item.type === "mazel_tov" ? (
                      <PartyPopper className="h-5 w-5 text-gold flex-shrink-0 mt-1" />
                    ) : (
                      <Megaphone className="h-5 w-5 text-navy flex-shrink-0 mt-1" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-serif font-semibold text-navy">{item.title}</h3>
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            item.type === "mazel_tov" ? "bg-gold/20 text-gold" : "bg-navy/10 text-navy"
                          }`}
                        >
                          {item.type === "mazel_tov" ? "Mazel Tov" : "Announcement"}
                        </span>
                        {!item.enabled && (
                          <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">Hidden</span>
                        )}
                      </div>
                      <p className="text-sm text-navy/60 mt-0.5">
                        {new Date(item.date).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                      <p className="text-navy/80 mt-2 text-sm">{item.content}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={item.enabled} onCheckedChange={() => toggleEnabled(item)} />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(item)}
                      className="text-navy/60 hover:text-navy"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(item.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-navy">{editingItem ? "Edit Announcement" : "Add Announcement"}</DialogTitle>
            <DialogDescription>
              {editingItem ? "Update the announcement details" : "Create a new announcement for the home page"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value: "mazel_tov" | "announcement") => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mazel_tov">
                    <span className="flex items-center gap-2">
                      <PartyPopper className="h-4 w-4 text-gold" />
                      Mazel Tov
                    </span>
                  </SelectItem>
                  <SelectItem value="announcement">
                    <span className="flex items-center gap-2">
                      <Megaphone className="h-4 w-4 text-navy" />
                      Announcement
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder={
                  formData.type === "mazel_tov"
                    ? "e.g., Mazel Tov to the Cohen Family!"
                    : "e.g., New Shiur Series Starting"
                }
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Content *</Label>
              <Textarea
                id="content"
                rows={4}
                placeholder={
                  formData.type === "mazel_tov"
                    ? "e.g., Mazel Tov to Rabbi & Mrs. Cohen on the birth of their son!"
                    : "e.g., We're excited to announce a new weekly shiur series..."
                }
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-navy/5 rounded-lg">
              <div>
                <Label htmlFor="enabled" className="text-navy font-medium">
                  Show on Home Page
                </Label>
                <p className="text-sm text-navy/60">Toggle visibility</p>
              </div>
              <Switch
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowDialog(false)} className="border-navy/20">
              Cancel
            </Button>
            <Button onClick={handleSave} className="bg-navy text-cream hover:bg-navy/90">
              {editingItem ? "Save Changes" : "Add Announcement"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
