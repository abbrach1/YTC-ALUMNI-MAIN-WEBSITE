"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { getUserFriendlyError } from "@/lib/utils"

export default function RequestAccessPage() {
  const { user, signOut } = useAuth()
  const { toast } = useToast()
  const [requested, setRequested] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(true)
  const [existingRequest, setExistingRequest] = useState<{ firstName?: string; lastName?: string; fullName?: string } | null>(null)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [graduationYear, setGraduationYear] = useState("")

  useEffect(() => {
    // Check if user already submitted a request
    const checkExistingRequest = async () => {
      if (!user?.email) return
      try {
        const requestDoc = await getDoc(doc(db, "accessRequests", user.email.toLowerCase()))
        if (requestDoc.exists()) {
          const data = requestDoc.data()
          setExistingRequest(data)
          // If user already provided name info during signup, mark as requested
          if (data.firstName && data.lastName) {
            setRequested(true)
          }
        }
      } catch (error) {
        console.error("Error checking request status:", error)
      } finally {
        setCheckingStatus(false)
      }
    }
    checkExistingRequest()
  }, [user?.email])

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!firstName || !lastName) {
      toast({
        title: "Missing Information",
        description: "Please enter your first and last name.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const fullName = `${firstName} ${lastName}`
      const normalizedEmail = user?.email?.toLowerCase() || ""

      await setDoc(doc(db, "accessRequests", normalizedEmail), {
        email: normalizedEmail,
        firstName,
        lastName,
        fullName,
        graduationYear: graduationYear || null,
        requestedAt: new Date().toISOString(),
        status: "pending",
      })

      const response = await fetch("/api/send-access-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userName: fullName,
          userEmail: normalizedEmail,
          graduationYear: graduationYear || undefined,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to send request")
      }

      setRequested(true)
      toast({
        title: "Access Requested",
        description: "Your request has been submitted. The Hanhala will review it shortly.",
      })
    } catch (error: any) {
      toast({
        title: "Unable to submit request",
        description: getUserFriendlyError(error),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  if (checkingStatus) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <p className="text-navy">Loading...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4">
      <Card className="w-full max-w-md border-gold/20 bg-white shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="font-serif text-3xl text-navy">Access Pending</CardTitle>
          <CardDescription className="text-navy/70">Your account is awaiting approval from the Hanhala</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-navy/80 text-center">
            Welcome! Your account ({user?.email}) has been created but requires approval to access the alumni portal.
          </p>

          {!requested ? (
            <form onSubmit={handleRequest} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Moshe"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Cohen"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="graduationYear">Graduation Year (Optional)</Label>
                <Input
                  id="graduationYear"
                  value={graduationYear}
                  onChange={(e) => setGraduationYear(e.target.value)}
                  placeholder="e.g., 2015"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-navy text-cream hover:bg-navy/90">
                {loading ? "Sending..." : "Request Access"}
              </Button>
            </form>
          ) : (
            <div className="p-4 bg-gold/10 rounded-lg border border-gold/20 text-center">
              <p className="text-navy font-medium">Request Submitted</p>
              {existingRequest?.fullName && (
                <p className="text-sm text-navy/80 mt-1">Name: {existingRequest.fullName}</p>
              )}
              <p className="text-sm text-navy/70 mt-1">You will receive an email once your access is approved.</p>
            </div>
          )}

          <Button onClick={() => signOut()} variant="outline" className="w-full border-gold text-navy hover:bg-gold/10">
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
