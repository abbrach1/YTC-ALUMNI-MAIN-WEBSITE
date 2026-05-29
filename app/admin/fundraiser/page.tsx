"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { exportRowsToXlsx } from "@/lib/export-xlsx"
import {
  FUNDRAISER_SETTINGS_DOC,
  FUNDRAISER_SIGNUPS_COLLECTION,
  FUNDRAISER_DEFAULTS,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUSES,
  type FundraiserSettings,
  type CampaignSignup,
  type CampaignSignupStatus,
} from "@/lib/fundraiser"
import {
  Save,
  Download,
  Trash2,
  Search,
  Mail,
  Phone,
  Target,
  Users,
  Clock,
  Sparkles,
  Loader2,
} from "lucide-react"

export default function AdminFundraiserPage() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<FundraiserSettings>(FUNDRAISER_DEFAULTS)
  const [savingSettings, setSavingSettings] = useState(false)
  const [signups, setSignups] = useState<CampaignSignup[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  const fetchSettings = async () => {
    try {
      const snap = await getDoc(doc(db, "settings", FUNDRAISER_SETTINGS_DOC))
      if (snap.exists()) {
        setSettings({ ...FUNDRAISER_DEFAULTS, ...(snap.data() as Partial<FundraiserSettings>) })
      }
    } catch (e) {
      console.error("Error loading fundraiser settings:", e)
    }
  }

  const fetchSignups = async () => {
    try {
      const q = query(collection(db, FUNDRAISER_SIGNUPS_COLLECTION), orderBy("submittedAt", "desc"))
      const snap = await getDocs(q)
      const data: CampaignSignup[] = []
      snap.forEach((d) => data.push({ id: d.id, ...d.data() } as CampaignSignup))
      setSignups(data)
    } catch (e) {
      console.error("Error loading campaign sign-ups:", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
    fetchSignups()
  }, [])

  const persistSettings = async (next: FundraiserSettings) => {
    await setDoc(doc(db, "settings", FUNDRAISER_SETTINGS_DOC), {
      ...next,
      updatedAt: new Date().toISOString(),
    })
  }

  const handleToggleEnabled = async (enabled: boolean) => {
    const previous = settings.enabled
    const next = { ...settings, enabled }
    setSettings(next)
    try {
      await persistSettings(next)
      toast({
        title: enabled ? "Campaign is live" : "Campaign hidden",
        description: enabled
          ? "The sign-up section is now showing on the home page."
          : "The sign-up section is hidden from the home page.",
      })
    } catch (e: any) {
      setSettings((s) => ({ ...s, enabled: previous })) // revert on failure
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    try {
      await persistSettings(settings)
      toast({ title: "Saved", description: "Campaign details updated." })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setSavingSettings(false)
    }
  }

  const handleStatusChange = async (id: string, status: CampaignSignupStatus) => {
    const previous = signups
    setSignups((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)))
    try {
      await updateDoc(doc(db, FUNDRAISER_SIGNUPS_COLLECTION, id), { status })
    } catch (e: any) {
      setSignups(previous) // revert
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this sign-up? This cannot be undone.")) return
    try {
      await deleteDoc(doc(db, FUNDRAISER_SIGNUPS_COLLECTION, id))
      setSignups((prev) => prev.filter((s) => s.id !== id))
      toast({ title: "Deleted", description: "Sign-up removed." })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

  const handleExport = () => {
    if (signups.length === 0) {
      toast({ title: "Nothing to export", description: "There are no sign-ups yet." })
      return
    }
    const rows = signups.map((s) => ({
      Name: s.fullName,
      Email: s.email,
      Phone: s.phone,
      "Page Title": s.pageTitle,
      Goal: s.goalAmount,
      Message: s.message,
      Status: CAMPAIGN_STATUS_LABELS[s.status] ?? s.status,
      "Submitted By": s.submittedBy ?? "",
      "Submitted At": s.submittedAt ? new Date(s.submittedAt).toLocaleString() : "",
    }))
    exportRowsToXlsx(rows, `campaign-signups-${new Date().toISOString().slice(0, 10)}`, "Sign-ups")
  }

  const filtered = signups.filter((s) => {
    if (!searchTerm) return true
    const t = searchTerm.toLowerCase()
    return (
      (s.fullName || "").toLowerCase().includes(t) ||
      (s.email || "").toLowerCase().includes(t) ||
      (s.pageTitle || "").toLowerCase().includes(t)
    )
  })

  const newCount = signups.filter((s) => s.status === "new").length
  const liveCount = signups.filter((s) => s.status === "live").length

  const getStatusBadge = (status: CampaignSignupStatus) => {
    switch (status) {
      case "live":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Page Live</Badge>
      case "contacted":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Contacted</Badge>
      case "archived":
        return <Badge className="bg-navy/10 text-navy/60 hover:bg-navy/10">Archived</Badge>
      default:
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">New</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Fundraiser Campaign</h1>
        <p className="text-navy/60">
          Manage the home-page campaign sign-up, review submissions, and export the data.
        </p>
      </div>

      {/* Campaign settings + on/off toggle */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Campaign Settings</CardTitle>
              <CardDescription>
                Turn the home-page sign-up section on or off and edit what alumni see.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-navy/10 px-4 py-2">
              <span className="text-sm font-medium text-navy">
                {settings.enabled ? "Showing on home page" : "Hidden"}
              </span>
              <Switch checked={settings.enabled} onCheckedChange={handleToggleEnabled} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="campaignName" className="text-sm font-medium text-navy">
                Campaign Name
              </Label>
              <Input
                id="campaignName"
                value={settings.campaignName}
                onChange={(e) => setSettings({ ...settings, campaignName: e.target.value })}
                placeholder="e.g. 2026 Annual Campaign"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campaignUrl" className="text-sm font-medium text-navy">
                CharityExtra Campaign Link
              </Label>
              <Input
                id="campaignUrl"
                value={settings.campaignUrl}
                onChange={(e) => setSettings({ ...settings, campaignUrl: e.target.value })}
                placeholder="https://charityextra.com/..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="headline" className="text-sm font-medium text-navy">
                Headline
              </Label>
              <Input
                id="headline"
                value={settings.headline}
                onChange={(e) => setSettings({ ...settings, headline: e.target.value })}
                placeholder="Be Part of Our Campaign"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deadline" className="text-sm font-medium text-navy">
                Deadline <span className="font-normal text-navy/40">(optional)</span>
              </Label>
              <Input
                id="deadline"
                type="date"
                value={settings.deadline ?? ""}
                onChange={(e) => setSettings({ ...settings, deadline: e.target.value || null })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-sm font-medium text-navy">
              Description
            </Label>
            <Textarea
              id="description"
              rows={3}
              value={settings.description}
              onChange={(e) => setSettings({ ...settings, description: e.target.value })}
              placeholder="Short blurb shown under the headline on the home page."
              className="resize-none"
            />
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="bg-navy text-cream hover:bg-navy/90"
            >
              {savingSettings ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Details
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-yellow-100 p-2">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-navy">{newCount}</p>
                <p className="text-sm text-navy/60">New (unactioned)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-2">
                <Sparkles className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-navy">{liveCount}</p>
                <p className="text-sm text-navy/60">Pages Live</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-navy/10 p-2">
                <Users className="h-5 w-5 text-navy" />
              </div>
              <div>
                <p className="text-2xl font-bold text-navy">{signups.length}</p>
                <p className="text-sm text-navy/60">Total Sign-ups</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Submissions */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Sign-ups</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/40" />
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline" onClick={handleExport} className="shrink-0">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-navy" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-navy/50">
              <Users className="mx-auto mb-3 h-10 w-10 opacity-50" />
              <p>{signups.length === 0 ? "No sign-ups yet" : "No sign-ups match your search"}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-col gap-4 rounded-lg border border-navy/10 bg-white p-4 lg:flex-row lg:items-start lg:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-navy">{s.fullName || "(no name)"}</h3>
                      {getStatusBadge(s.status)}
                      {s.pageTitle && (
                        <span className="text-sm text-navy/60">— {s.pageTitle}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-navy/60">
                      {s.email && (
                        <a href={`mailto:${s.email}`} className="flex items-center gap-1 hover:text-navy">
                          <Mail className="h-3.5 w-3.5" />
                          {s.email}
                        </a>
                      )}
                      {s.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5" />
                          {s.phone}
                        </span>
                      )}
                      {s.goalAmount && (
                        <span className="flex items-center gap-1">
                          <Target className="h-3.5 w-3.5" />
                          {s.goalAmount}
                        </span>
                      )}
                    </div>
                    {s.message && <p className="mt-2 text-sm text-navy/70">{s.message}</p>}
                    <p className="mt-1 text-xs text-navy/40">
                      Submitted {s.submittedAt ? new Date(s.submittedAt).toLocaleString() : "—"}
                      {s.submittedBy ? ` · ${s.submittedBy}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={s.status}
                      onValueChange={(v) => handleStatusChange(s.id!, v as CampaignSignupStatus)}
                    >
                      <SelectTrigger className="h-9 w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CAMPAIGN_STATUSES.map((st) => (
                          <SelectItem key={st} value={st}>
                            {CAMPAIGN_STATUS_LABELS[st]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-navy/40 hover:text-red-600"
                      onClick={() => handleDelete(s.id!)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
