"use client"

import { useEffect, useState } from "react"
import { collection, doc, getDocs, setDoc, updateDoc, deleteField } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/lib/auth-context"
import { GRANTABLE_ADMIN_PAGES, SUPER_ADMIN_EMAIL } from "@/lib/admin-pages"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Shield, ShieldCheck, RefreshCw, Save, UserPlus } from "lucide-react"

interface AdminRecord {
  email: string
  pages: string[] | null // null = no restriction (full access)
  isSuperAdmin: boolean
}

export default function AdminPermissionsPage() {
  const { isSuperAdmin, checkingApproval } = useAuth()
  const { toast } = useToast()

  const [admins, setAdmins] = useState<AdminRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [savingEmail, setSavingEmail] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, AdminRecord>>({})
  const [newAdminEmail, setNewAdminEmail] = useState("")
  const [addingAdmin, setAddingAdmin] = useState(false)

  const fetchAdmins = async () => {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, "admins"))
      const list: AdminRecord[] = snap.docs.map((d) => {
        const data = d.data()
        const email = (typeof data.email === "string" ? data.email : d.id).toLowerCase()
        const rawPages = data.pages
        const pages = Array.isArray(rawPages)
          ? rawPages.filter((p: unknown): p is string => typeof p === "string")
          : null
        return {
          email,
          pages,
          isSuperAdmin: email === SUPER_ADMIN_EMAIL.toLowerCase(),
        }
      })
      list.sort((a, b) => {
        // Super-admin pinned first
        if (a.isSuperAdmin && !b.isSuperAdmin) return -1
        if (!a.isSuperAdmin && b.isSuperAdmin) return 1
        return a.email.localeCompare(b.email)
      })
      setAdmins(list)
      // Reset drafts on refresh
      const next: Record<string, AdminRecord> = {}
      list.forEach((a) => {
        next[a.email] = { ...a, pages: a.pages === null ? null : [...a.pages] }
      })
      setDrafts(next)
    } catch (error: any) {
      console.error("Error loading admins:", error)
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (checkingApproval) return
    if (!isSuperAdmin) return
    fetchAdmins()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkingApproval, isSuperAdmin])

  const setDraft = (email: string, updater: (prev: AdminRecord) => AdminRecord) => {
    setDrafts((prev) => ({ ...prev, [email]: updater(prev[email]) }))
  }

  const isDirty = (email: string) => {
    const original = admins.find((a) => a.email === email)
    const draft = drafts[email]
    if (!original || !draft) return false
    if ((original.pages === null) !== (draft.pages === null)) return true
    if (original.pages === null) return false
    const a = [...original.pages].sort()
    const b = [...(draft.pages || [])].sort()
    if (a.length !== b.length) return true
    return a.some((v, i) => v !== b[i])
  }

  const handleToggleFullAccess = (email: string, fullAccess: boolean) => {
    setDraft(email, (prev) => ({
      ...prev,
      pages: fullAccess ? null : [],
    }))
  }

  const handleTogglePage = (email: string, href: string, checked: boolean) => {
    setDraft(email, (prev) => {
      const pages = prev.pages === null ? GRANTABLE_ADMIN_PAGES.map((p) => p.href) : [...prev.pages]
      const set = new Set(pages)
      if (checked) set.add(href)
      else set.delete(href)
      return { ...prev, pages: Array.from(set) }
    })
  }

  const handleAddAdmin = async () => {
    const raw = newAdminEmail.trim().toLowerCase()
    if (!raw) return
    // Lightweight email check — Firebase auth will catch real validation later
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
      toast({ title: "Invalid email", variant: "destructive" })
      return
    }
    if (admins.some((a) => a.email === raw)) {
      toast({ title: "Already an admin", description: raw })
      return
    }
    setAddingAdmin(true)
    try {
      await setDoc(doc(db, "admins", raw), {
        email: raw,
        addedAt: new Date().toISOString(),
      })
      toast({ title: "Admin added", description: `${raw} now has full admin access.` })
      setNewAdminEmail("")
      await fetchAdmins()
    } catch (error: any) {
      console.error("Error adding admin:", error)
      toast({ title: "Error adding admin", description: error.message, variant: "destructive" })
    } finally {
      setAddingAdmin(false)
    }
  }

  const handleSave = async (email: string) => {
    const draft = drafts[email]
    if (!draft) return
    setSavingEmail(email)
    try {
      const adminDocRef = doc(db, "admins", email)
      if (draft.pages === null) {
        // Full access — remove the pages field entirely.
        await updateDoc(adminDocRef, { pages: deleteField() }).catch(async (err) => {
          // updateDoc fails if doc doesn't exist (race). Recreate without pages.
          if (err?.code === "not-found") {
            await setDoc(adminDocRef, { email }, { merge: true })
          } else {
            throw err
          }
        })
      } else {
        await setDoc(adminDocRef, { email, pages: draft.pages }, { merge: true })
      }
      toast({ title: "Permissions updated", description: email })
      // Update the snapshot so isDirty resets
      setAdmins((prev) =>
        prev.map((a) =>
          a.email === email
            ? { ...a, pages: draft.pages === null ? null : [...draft.pages] }
            : a,
        ),
      )
    } catch (error: any) {
      console.error("Error saving permissions:", error)
      toast({ title: "Error saving", description: error.message, variant: "destructive" })
    } finally {
      setSavingEmail(null)
    }
  }

  if (checkingApproval) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-navy" />
      </div>
    )
  }

  if (!isSuperAdmin) {
    return (
      <div className="max-w-xl mx-auto py-12">
        <Card className="border-red-200 bg-white">
          <CardHeader>
            <CardTitle className="text-navy flex items-center gap-2">
              <Shield className="h-5 w-5 text-red-500" />
              Super-admin only
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-navy/70">
              Only the super-admin ({SUPER_ADMIN_EMAIL}) can edit admin permissions.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-3xl font-bold text-navy mb-2 flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-gold" />
            Admin Permissions
          </h1>
          <p className="text-navy/70 max-w-2xl">
            Choose which admin pages each admin can access. The super-admin always has full access
            and is the only account that can edit this page.
          </p>
        </div>
        <Button onClick={fetchAdmins} variant="outline" disabled={loading} className="border-navy text-navy">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card className="border-gold/20 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-navy text-lg flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-gold" />
            Add Admin
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleAddAdmin()
            }}
            className="flex flex-col sm:flex-row sm:items-end gap-3"
          >
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="newAdminEmail" className="text-sm text-navy">
                Email
              </Label>
              <Input
                id="newAdminEmail"
                type="email"
                placeholder="someone@example.com"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                disabled={addingAdmin}
                className="border-navy/20"
              />
            </div>
            <Button
              type="submit"
              disabled={addingAdmin || !newAdminEmail.trim()}
              className="bg-navy text-cream hover:bg-navy/90"
            >
              {addingAdmin ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Admin
                </>
              )}
            </Button>
          </form>
          <p className="text-xs text-navy/60 mt-2">
            New admins start with full access. Lock them down to specific pages below.
          </p>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-navy" />
        </div>
      ) : admins.length === 0 ? (
        <Card className="border-gold/20 bg-white">
          <CardContent className="py-12 text-center text-navy/60">
            No admins found. Add admins from the User Accounts page first.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {admins.map((admin) => {
            const draft = drafts[admin.email]
            if (!draft) return null
            const fullAccess = draft.pages === null
            const dirty = isDirty(admin.email)
            const saving = savingEmail === admin.email
            return (
              <Card
                key={admin.email}
                className={`border-gold/20 bg-white shadow-sm ${dirty ? "ring-2 ring-gold/40" : ""}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <CardTitle className="text-navy text-lg">{admin.email}</CardTitle>
                      {admin.isSuperAdmin && (
                        <Badge className="bg-gold text-navy">Super-admin</Badge>
                      )}
                      {!admin.isSuperAdmin && fullAccess && (
                        <Badge variant="outline" className="border-navy/30 text-navy">
                          Full access
                        </Badge>
                      )}
                      {!admin.isSuperAdmin && !fullAccess && (
                        <Badge variant="outline" className="border-amber-500 text-amber-700">
                          Restricted ({(draft.pages || []).length} pages)
                        </Badge>
                      )}
                    </div>
                    {!admin.isSuperAdmin && (
                      <Button
                        onClick={() => handleSave(admin.email)}
                        disabled={!dirty || saving}
                        className="bg-navy text-cream hover:bg-navy/90"
                      >
                        {saving ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {admin.isSuperAdmin ? (
                    <p className="text-sm text-navy/60">
                      The super-admin has unrestricted access to every admin page.
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-cream border border-gold/20">
                        <div>
                          <p className="text-sm font-semibold text-navy">Full access</p>
                          <p className="text-xs text-navy/60">
                            When on, this admin can see and use every admin page (except
                            Permissions, which is super-admin only).
                          </p>
                        </div>
                        <Switch
                          checked={fullAccess}
                          onCheckedChange={(checked) =>
                            handleToggleFullAccess(admin.email, checked)
                          }
                        />
                      </div>

                      {!fullAccess && (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {GRANTABLE_ADMIN_PAGES.map((p) => {
                            const pages = draft.pages || []
                            const checked = pages.includes(p.href)
                            const Icon = p.icon
                            return (
                              <label
                                key={p.href}
                                className="flex items-center gap-3 p-2.5 rounded-md border border-gold/20 hover:bg-gold/5 cursor-pointer"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(v) =>
                                    handleTogglePage(admin.email, p.href, !!v)
                                  }
                                />
                                <Icon className="h-4 w-4 text-navy/70 flex-shrink-0" />
                                <span className="text-sm text-navy">{p.label}</span>
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
