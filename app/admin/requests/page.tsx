"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { collection, getDocs, query, where, updateDoc, doc, addDoc, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Check, X } from "lucide-react"

interface SimchaSubmission {
  id: string
  fullName: string
  simchaType: string
  date: string
  connection?: string
  message?: string
  imageUrl?: string
  submittedBy: string
  status: string
}

interface UpdateRequest {
  id: string
  name: string
  email: string
  phone?: string
  address?: string
  graduationYear?: string
  notes?: string
  photoUrl?: string
  submittedBy: string
  status: string
}

interface AccessRequest {
  id: string
  email: string
  firstName?: string
  lastName?: string
  fullName?: string
  graduationYear?: string
  requestedAt: string
  status: string
}

export default function RequestsPage() {
  const [simchaSubmissions, setSimchaSubmissions] = useState<SimchaSubmission[]>([])
  const [updateRequests, setUpdateRequests] = useState<UpdateRequest[]>([])
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([])
  const { toast } = useToast()

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    const simchasQuery = query(collection(db, "simchaSubmissions"), where("status", "==", "new"))
    const simchasSnapshot = await getDocs(simchasQuery)
    const simchasData: SimchaSubmission[] = []
    simchasSnapshot.forEach((doc) => {
      simchasData.push({ id: doc.id, ...doc.data() } as SimchaSubmission)
    })
    setSimchaSubmissions(simchasData)

    const updatesQuery = query(collection(db, "updateRequests"), where("status", "==", "new"))
    const updatesSnapshot = await getDocs(updatesQuery)
    const updatesData: UpdateRequest[] = []
    updatesSnapshot.forEach((doc) => {
      updatesData.push({ id: doc.id, ...doc.data() } as UpdateRequest)
    })
    setUpdateRequests(updatesData)

    const accessQuery = query(collection(db, "accessRequests"), where("status", "==", "pending"))
    const accessSnapshot = await getDocs(accessQuery)
    const accessData: AccessRequest[] = []
    accessSnapshot.forEach((doc) => {
      accessData.push({ id: doc.id, ...doc.data() } as AccessRequest)
    })
    setAccessRequests(accessData)
  }

  const handleApproveAccess = async (request: AccessRequest) => {
    try {
      const normalizedEmail = request.email.toLowerCase()

      await setDoc(doc(db, "approvedEmails", normalizedEmail), {
        email: normalizedEmail,
        firstName: request.firstName || "",
        lastName: request.lastName || "",
        fullName: request.fullName || request.email,
        graduationYear: request.graduationYear || null,
        notes: request.graduationYear ? `Alumnus ${request.graduationYear}` : "",
        addedAt: new Date().toISOString(),
        needsProfileCompletion: !request.firstName || !request.lastName,
      })

      await updateDoc(doc(db, "accessRequests", request.id), {
        status: "approved",
        approvedAt: new Date().toISOString(),
      })

      // Send approval email to user
      try {
        console.log("[v0] Sending approval email to:", normalizedEmail)
        const emailResponse = await fetch("/api/send-approval-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: normalizedEmail,
            userName: request.fullName || request.firstName || "",
          }),
        })
        const emailResult = await emailResponse.json()
        console.log("[v0] Email API response:", emailResult)
        if (!emailResponse.ok) {
          console.error("[v0] Email API error:", emailResult)
        }
      } catch (emailError) {
        console.error("[v0] Failed to send approval email:", emailError)
      }

      toast({ title: `${request.fullName || request.email} approved for access` })
      fetchAll()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const handleDenyAccess = async (request: AccessRequest) => {
    if (!confirm(`Deny access for ${request.fullName || request.email}?`)) return

    try {
      await updateDoc(doc(db, "accessRequests", request.id), {
        status: "denied",
        deniedAt: new Date().toISOString(),
      })

      toast({ title: `Access denied for ${request.fullName || request.email}` })
      fetchAll()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const handleApproveSimcha = async (submission: SimchaSubmission) => {
    try {
      await addDoc(collection(db, "events"), {
        eventName: `${submission.simchaType} - ${submission.fullName}`,
        personFamily: submission.fullName,
        type: submission.simchaType,
        date: submission.date,
        location: "TBD",
        description: submission.message,
        imageUrl: submission.imageUrl,
      })

      await updateDoc(doc(db, "simchaSubmissions", submission.id), {
        status: "approved",
      })

      toast({ title: "Simcha approved and added to events" })
      fetchAll()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const handleMarkSimchaProcessed = async (id: string) => {
    try {
      await updateDoc(doc(db, "simchaSubmissions", id), {
        status: "processed",
      })
      toast({ title: "Marked as processed" })
      fetchAll()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const handleApplyUpdate = async (request: UpdateRequest) => {
    try {
      await addDoc(collection(db, "alumni"), {
        name: request.name,
        email: request.email,
        city: request.address,
        graduationYear: request.graduationYear,
      })

      await updateDoc(doc(db, "updateRequests", request.id), {
        status: "processed",
      })

      toast({ title: "Update applied successfully" })
      fetchAll()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-navy mb-2">Pending Requests</h1>
        <p className="text-navy/70">Review and process submissions from alumni</p>
      </div>

      <Tabs defaultValue="access" className="space-y-6">
        <TabsList>
          <TabsTrigger value="access">Access Requests ({accessRequests.length})</TabsTrigger>
          <TabsTrigger value="simchas">Simcha Submissions ({simchaSubmissions.length})</TabsTrigger>
          <TabsTrigger value="updates">Info Updates ({updateRequests.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="access">
          <div className="space-y-4">
            {accessRequests.map((request) => (
              <Card key={request.id} className="border-gold/20 bg-white shadow-lg">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div>
                        <h3 className="font-semibold text-navy text-lg">{request.fullName || request.email}</h3>
                        <p className="text-navy/70">{request.email}</p>
                        {!request.fullName && (
                          <p className="text-amber-600 text-sm">Profile not yet completed</p>
                        )}
                      </div>
                      <div className="text-sm text-navy/60">
                        {request.graduationYear && <p>Graduation Year: {request.graduationYear}</p>}
                        <p>Requested: {new Date(request.requestedAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleApproveAccess(request)}
                        className="bg-green-600 text-white hover:bg-green-700"
                        size="sm"
                      >
                        <Check className="mr-1 h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        onClick={() => handleDenyAccess(request)}
                        variant="outline"
                        className="border-destructive text-destructive hover:bg-destructive hover:text-white"
                        size="sm"
                      >
                        <X className="mr-1 h-4 w-4" />
                        Deny
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {accessRequests.length === 0 && (
              <Card className="border-gold/20 bg-white shadow-lg">
                <CardContent className="py-12 text-center">
                  <p className="text-navy/50">No pending access requests.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="simchas">
          <div className="space-y-4">
            {simchaSubmissions.map((submission) => (
              <Card key={submission.id} className="border-gold/20 bg-white shadow-lg">
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-semibold text-navy text-lg">{submission.simchaType}</h3>
                      <p className="text-navy/70">{submission.fullName}</p>
                    </div>
                    <div className="text-sm text-navy/60">
                      <p>Date: {submission.date}</p>
                      {submission.connection && <p>Connection: {submission.connection}</p>}
                      {submission.message && <p>Message: {submission.message}</p>}
                      {submission.imageUrl && (
                        <img
                          src={submission.imageUrl || "/placeholder.svg"}
                          alt="Simcha"
                          className="mt-2 max-w-xs rounded-lg"
                        />
                      )}
                      <p className="text-xs mt-2">Submitted by: {submission.submittedBy}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleApproveSimcha(submission)}
                        className="bg-navy text-cream hover:bg-navy/90"
                      >
                        Approve & Add to Events
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleMarkSimchaProcessed(submission.id)}
                        className="border-gold text-navy hover:bg-gold/10"
                      >
                        Mark as Processed
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {simchaSubmissions.length === 0 && (
              <Card className="border-gold/20 bg-white shadow-lg">
                <CardContent className="py-12 text-center">
                  <p className="text-navy/50">No pending simcha submissions.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="updates">
          <div className="space-y-4">
            {updateRequests.map((request) => (
              <Card key={request.id} className="border-gold/20 bg-white shadow-lg">
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-semibold text-navy text-lg">{request.name}</h3>
                      <p className="text-navy/70">{request.email}</p>
                    </div>
                    <div className="text-sm text-navy/60">
                      {request.phone && <p>Phone: {request.phone}</p>}
                      {request.address && <p>Address: {request.address}</p>}
                      {request.graduationYear && <p>Graduation Year: {request.graduationYear}</p>}
                      {request.notes && <p>Notes: {request.notes}</p>}
                      {request.photoUrl && (
                        <img
                          src={request.photoUrl || "/placeholder.svg"}
                          alt="Profile"
                          className="mt-2 h-24 w-24 rounded-full object-cover"
                        />
                      )}
                      <p className="text-xs mt-2">Submitted by: {request.submittedBy}</p>
                    </div>
                    <Button onClick={() => handleApplyUpdate(request)} className="bg-navy text-cream hover:bg-navy/90">
                      Apply Changes & Mark Processed
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {updateRequests.length === 0 && (
              <Card className="border-gold/20 bg-white shadow-lg">
                <CardContent className="py-12 text-center">
                  <p className="text-navy/50">No pending update requests.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
