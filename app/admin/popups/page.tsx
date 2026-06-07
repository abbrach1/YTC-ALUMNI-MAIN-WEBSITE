"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import {
  POPUPS_COLLECTION,
  POPUP_DEFAULTS,
  POPUP_TARGETS,
  POPUP_TARGET_LABELS,
  type AdminPopup,
  type PopupTarget,
} from "@/lib/popups"
import { Plus, Pencil, Trash2, Loader2, MessageSquare, ExternalLink } from "lucide-react"

type DraftPopup = Omit<AdminPopup, "id" | "createdAt">

export default function AdminPopupsPage() {
  const { toast } = useToast()
  const [popups, setPopups] = useState<AdminPopup[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<DraftPopup>({ ...POPUP_DEFAULTS })

  const fetchPopups = async () => {
    try {
      const snap = await getDocs(query(collection(db, POPUPS_COLLECTION), orderBy("createdAt", "desc")))
      const data: AdminPopup[] = []
      snap.forEach((d) => data.push({ id: d.id, ...(d.data() as Omit<AdminPopup, "id">) }))
      setPopups(data)
    } catch (e) {
      console.error("Error loading popups:", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPopups()
  }, [])

  const openCreate = () => {
    setEditingId(null)
    setDraft({ ...POPUP_DEFAULTS })
    setDialogOpen(true)
  }

  const openEdit = (p: AdminPopup) => {
    setEditingId(p.id ?? null)
    setDraft({
      enabled: p.enabled,
      title: p.title,
      message: p.message,
      buttonLabel: p.buttonLabel,
      dismissLabel: p.dismissLabel,
      target: p.target,
      externalUrl: p.externalUrl,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!draft.title.trim() || !draft.message.trim()) {
      toast({ title: "Title and message are required", variant: "destructive" })
      return
    }
    if (draft.target === "external" && !draft.externalUrl.trim()) {
      toast({ title: "Enter the external link", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...draft,
        title: draft.title.trim(),
        message: draft.message.trim(),
        buttonLabel: draft.buttonLabel.trim(),
        dismissLabel: draft.dismissLabel.trim() || "Got it",
        externalUrl: draft.externalUrl.trim(),
      }
      if (editingId) {
        await updateDoc(doc(db, POPUPS_COLLECTION, editingId), payload)
        toast({ title: "Popup updated" })
      } else {
        await addDoc(collection(db, POPUPS_COLLECTION), {
          ...payload,
          createdAt: new Date().toISOString(),
        })
        toast({ title: "Popup created", description: "Users will see it next time they open the app." })
      }
      setDialogOpen(false)
      fetchPopups()
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (p: AdminPopup, enabled: boolean) => {
    const previous = popups
    setPopups((prev) => prev.map((x) => (x.id === p.id ? { ...x, enabled } : x)))
    try {
      await updateDoc(doc(db, POPUPS_COLLECTION, p.id!), { enabled })
    } catch (e: any) {
      setPopups(previous)
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this popup? People who haven't seen it won't anymore.")) return
    try {
      await deleteDoc(doc(db, POPUPS_COLLECTION, id))
      setPopups((prev) => prev.filter((x) => x.id !== id))
      toast({ title: "Popup deleted" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Popups</h1>
          <p className="text-navy/60">
            One-time pop-ups shown to users when they open the app (web + iOS). Each shows once, then
            never again after they dismiss it.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} className="bg-navy text-cream hover:bg-navy/90">
              <Plus className="mr-2 h-4 w-4" />
              New Popup
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Popup" : "New Popup"}</DialogTitle>
              <DialogDescription>
                Set the message and where the action button goes. Editing the text of a popup people
                already dismissed won&apos;t re-show it.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="e.g. Rebbeim Directory is up"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  rows={3}
                  value={draft.message}
                  onChange={(e) => setDraft({ ...draft, message: e.target.value })}
                  placeholder="What you want to tell people."
                  className="resize-none"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Action button goes to</Label>
                  <Select
                    value={draft.target}
                    onValueChange={(v) => setDraft({ ...draft, target: v as PopupTarget })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {POPUP_TARGETS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {POPUP_TARGET_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="buttonLabel">Button label</Label>
                  <Input
                    id="buttonLabel"
                    value={draft.buttonLabel}
                    onChange={(e) => setDraft({ ...draft, buttonLabel: e.target.value })}
                    placeholder="e.g. View directory"
                    disabled={draft.target === "none"}
                  />
                </div>
              </div>

              {draft.target === "external" && (
                <div className="space-y-1.5">
                  <Label htmlFor="externalUrl">External link</Label>
                  <Input
                    id="externalUrl"
                    value={draft.externalUrl}
                    onChange={(e) => setDraft({ ...draft, externalUrl: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="dismissLabel">Dismiss button label</Label>
                <Input
                  id="dismissLabel"
                  value={draft.dismissLabel}
                  onChange={(e) => setDraft({ ...draft, dismissLabel: e.target.value })}
                  placeholder="Got it"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-navy/10 px-4 py-2">
                <span className="text-sm font-medium text-navy">Enabled</span>
                <Switch
                  checked={draft.enabled}
                  onCheckedChange={(v) => setDraft({ ...draft, enabled: v })}
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving} className="bg-navy text-cream hover:bg-navy/90">
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : editingId ? (
                    "Save Changes"
                  ) : (
                    "Create Popup"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-navy" />
        </div>
      ) : popups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-navy/50">
            <MessageSquare className="mx-auto mb-3 h-10 w-10 opacity-50" />
            <p>No popups yet. Create one to greet users when they open the app.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {popups.map((p) => (
            <Card key={p.id} className={p.enabled ? "" : "opacity-60"}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <CardTitle className="text-navy">{p.title}</CardTitle>
                    <CardDescription className="mt-1 whitespace-pre-wrap">{p.message}</CardDescription>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Switch checked={p.enabled} onCheckedChange={(v) => handleToggle(p, v)} />
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-navy/40 hover:text-red-600"
                      onClick={() => handleDelete(p.id!)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-2 text-xs text-navy/60">
                  <span className="rounded-full bg-navy/5 px-2 py-0.5">{p.dismissLabel || "Got it"}</span>
                  {p.target !== "none" && p.buttonLabel && (
                    <span className="flex items-center gap-1 rounded-full bg-navy/10 px-2 py-0.5">
                      <ExternalLink className="h-3 w-3" />
                      {p.buttonLabel} → {POPUP_TARGET_LABELS[p.target]}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
