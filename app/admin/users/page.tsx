"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { collection, getDocs, doc, getDoc, deleteDoc, setDoc, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { auth } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { Search, Users, Trash2, CheckCircle, XCircle, Clock, RefreshCw, Upload } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface UserAccount {
  email: string
  createdAt?: string
  lastSignIn?: string
  isApproved: boolean
  isAdmin: boolean
  canUploadShiurim: boolean
  approvalSource?: string
  accessRequestStatus?: string
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserAccount[]>([])
  const [filteredUsers, setFilteredUsers] = useState<UserAccount[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; email: string; name: string }>({
    open: false,
    email: "",
    name: "",
  })
  const { toast } = useToast()

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    if (searchQuery) {
      const filtered = users.filter((u) =>
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setFilteredUsers(filtered)
    } else {
      setFilteredUsers(users)
    }
  }, [searchQuery, users])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      // Get all access requests (these are users who have signed up)
      const accessRequestsSnapshot = await getDocs(collection(db, "accessRequests"))
      const accessRequests = new Map<string, any>()
      accessRequestsSnapshot.forEach((doc) => {
        accessRequests.set(doc.id, doc.data())
      })

      // Get alumni database
      const alumniSnapshot = await getDocs(collection(db, "alumniDatabase"))
      const alumni = new Map<string, any>()
      alumniSnapshot.forEach((doc) => {
        alumni.set(doc.id, doc.data())
      })

      // Get approved emails
      const approvedSnapshot = await getDocs(collection(db, "approvedEmails"))
      const approved = new Map<string, any>()
      approvedSnapshot.forEach((doc) => {
        approved.set(doc.id, doc.data())
      })

      // Get admins
      const adminsSnapshot = await getDocs(collection(db, "admins"))
      const admins = new Set<string>()
      adminsSnapshot.forEach((doc) => {
        admins.add(doc.id)
      })

      // Get shiur uploaders - users granted permission to upload shiurim from
      // the mobile app. Doc id is the lowercased email; presence = permission.
      const uploadersSnapshot = await getDocs(collection(db, "shiurUploaders"))
      const uploaders = new Set<string>()
      uploadersSnapshot.forEach((doc) => {
        uploaders.add(doc.id)
      })

      // Combine all unique emails from access requests (these are actual signups)
      const userAccounts: UserAccount[] = []

      accessRequests.forEach((data, email) => {
        const isInAlumni = alumni.has(email)
        const isInApproved = approved.has(email)
        const isAdmin = admins.has(email)
        const isApproved = isInAlumni || isInApproved || data.status === "approved"

        userAccounts.push({
          email,
          createdAt: data.requestedAt,
          isApproved,
          isAdmin,
          canUploadShiurim: uploaders.has(email),
          approvalSource: isInAlumni ? "Alumni Database" : isInApproved ? "Manual Approval" : data.status === "approved" ? "Request Approved" : undefined,
          accessRequestStatus: data.status,
        })
      })

      // Sort by created date, newest first
      userAccounts.sort((a, b) => {
        if (!a.createdAt) return 1
        if (!b.createdAt) return -1
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })

      setUsers(userAccounts)
      setFilteredUsers(userAccounts)
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleToggleUploader = async (email: string, allowed: boolean) => {
    const ref = doc(db, "shiurUploaders", email)
    // Optimistic update so the toggle feels instant
    setUsers((prev) =>
      prev.map((u) => (u.email === email ? { ...u, canUploadShiurim: allowed } : u)),
    )
    try {
      if (allowed) {
        await setDoc(ref, {
          email,
          grantedAt: new Date().toISOString(),
          grantedBy: auth.currentUser?.email || null,
        })
        toast({ title: "Upload access granted", description: email })
      } else {
        await deleteDoc(ref)
        toast({ title: "Upload access revoked", description: email })
      }
    } catch (error: any) {
      // Roll back on failure
      setUsers((prev) =>
        prev.map((u) => (u.email === email ? { ...u, canUploadShiurim: !allowed } : u)),
      )
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const handleResetAccount = async (email: string) => {
    try {
      // Delete the user from Firebase Auth
      const authResponse = await fetch("/api/delete-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const authResult = await authResponse.json()
      
      // Delete the access request to allow them to re-submit
      await deleteDoc(doc(db, "accessRequests", email))
      
      toast({ 
        title: "Account Reset", 
        description: `${email} can now sign up again with a new password.` 
      })
      fetchUsers()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const handleDeleteAccount = async () => {
    const email = deleteDialog.email
    if (!email) return

    try {
      // Delete the user from Firebase Auth
      const authResponse = await fetch("/api/delete-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const authResult = await authResponse.json()
      
      // Delete access request
      await deleteDoc(doc(db, "accessRequests", email))
      
      // Remove from approved emails if present
      await deleteDoc(doc(db, "approvedEmails", email))
      
      // Remove from userProfiles if present
      await deleteDoc(doc(db, "userProfiles", email))

      // Revoke shiur uploader permission if granted
      await deleteDoc(doc(db, "shiurUploaders", email)).catch(() => {})
      
      toast({ 
        title: "Account Removed", 
        description: `All records for ${email} have been deleted.` 
      })
      setDeleteDialog({ open: false, email: "", name: "" })
      fetchUsers()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const getStatusBadge = (user: UserAccount) => {
    if (user.isAdmin) {
      return <Badge className="bg-gold text-navy">Admin</Badge>
    }
    if (user.isApproved) {
      return <Badge className="bg-green-600 text-white">Approved</Badge>
    }
    if (user.accessRequestStatus === "denied") {
      return <Badge variant="destructive">Denied</Badge>
    }
    return <Badge variant="outline" className="border-amber-500 text-amber-600">Pending</Badge>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-navy mb-2">User Accounts</h1>
        <p className="text-navy/70">View and manage user accounts that have signed up</p>
      </div>

      <Card className="border-gold/20 bg-white shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-gold" />
              <CardTitle className="text-navy">Registered Users ({filteredUsers.length})</CardTitle>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={fetchUsers}
                variant="outline"
                size="sm"
                className="border-navy text-navy"
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy/50" />
                <Input
                  placeholder="Search by email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-navy/50" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-navy/50">
              {searchQuery ? "No users match your search." : "No users have signed up yet."}
            </div>
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {filteredUsers.map((user) => (
                <div
                  key={user.email}
                  className="flex items-start justify-between border-b border-gold/20 pb-4 last:border-0"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-navy">{user.email}</p>
                      {getStatusBadge(user)}
                      {user.canUploadShiurim && (
                        <Badge className="bg-blue-600 text-white">
                          <Upload className="h-3 w-3 mr-1" />
                          Uploader
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-navy/60">
                      {user.createdAt && (
                        <span>Signed up: {new Date(user.createdAt).toLocaleDateString()}</span>
                      )}
                      {user.approvalSource && (
                        <span className="text-green-600">Source: {user.approvalSource}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer select-none" title="Allow this user to upload shiurim from the mobile app">
                      <span className="text-xs font-medium text-navy/70">Can upload</span>
                      <Switch
                        checked={user.canUploadShiurim}
                        onCheckedChange={(v) => handleToggleUploader(user.email, v)}
                      />
                    </label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResetAccount(user.email)}
                      className="border-amber-500 text-amber-600 hover:bg-amber-50"
                      title="Reset account - allows user to sign up again"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteDialog({ open: true, email: user.email, name: user.email })}
                      className="border-destructive text-destructive hover:bg-destructive hover:text-white"
                      title="Delete all records for this user"
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

      <Card className="border-gold/20 bg-white shadow-lg">
        <CardHeader>
          <CardTitle className="text-navy">Account Status Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Badge className="bg-gold text-navy">Admin</Badge>
              <span className="text-navy/70">Full admin access</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-green-600 text-white">Approved</Badge>
              <span className="text-navy/70">Can access alumni portal</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-amber-500 text-amber-600">Pending</Badge>
              <span className="text-navy/70">Awaiting approval</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="destructive">Denied</Badge>
              <span className="text-navy/70">Access was denied</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-600 text-white">
                <Upload className="h-3 w-3 mr-1" />
                Uploader
              </Badge>
              <span className="text-navy/70">Can upload shiurim from the mobile app</span>
            </div>
          </div>
          <div className="mt-4 p-4 bg-navy/5 rounded-lg">
            <p className="text-sm text-navy/70">
              <strong>Reset Account:</strong> Removes the user's access request record, allowing them to sign up again with a new password.
              Use this if a user forgot their password and needs to create a new account.
            </p>
            <p className="text-sm text-navy/70 mt-2">
              <strong>Delete Account:</strong> Removes all records for this user including their access request and any manual approvals.
            </p>
            <p className="text-sm text-navy/70 mt-2">
              <strong>Can upload:</strong> Toggle this on to let a user see and use the upload-shiur page in the Android/iOS app. The app reads from the <code className="bg-white border border-navy/10 rounded px-1.5 py-0.5 text-xs">shiurUploaders</code> Firestore collection.
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete all records for <strong>{deleteDialog.email}</strong>? 
              This will remove their access request and any manual approvals. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, email: "", name: "" })}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAccount}>
              Delete Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
