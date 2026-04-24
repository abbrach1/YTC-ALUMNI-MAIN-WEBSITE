"use client"

import { useState } from "react"
import { doc, setDoc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const ADMIN_EMAILS = [
  { email: "abbrachfeld@gmail.com", name: "AB Brachfeld" },
  { email: "eliadmin@tc.com", name: "Eli Admin" },
]

export default function AdminSetupPage() {
  const [status, setStatus] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [verification, setVerification] = useState<string[]>([])

  const setupAdmin = async () => {
    setLoading(true)
    setStatus("Setting up admin access...")
    setVerification([])

    try {
      for (const admin of ADMIN_EMAILS) {
        const email = admin.email.toLowerCase()

        await setDoc(doc(db, "approvedEmails", email), {
          email: email,
          name: admin.name,
          addedAt: new Date().toISOString(),
          addedBy: "admin-setup",
        })
        console.log(`[v0] Added ${email} to approvedEmails`)

        await setDoc(doc(db, "admins", email), {
          email: email,
          name: admin.name,
          role: "super-admin",
          addedAt: new Date().toISOString(),
        })
        console.log(`[v0] Added ${email} to admins`)
      }

      setStatus(
        `Success! Admin access granted to: ${ADMIN_EMAILS.map((a) => a.email).join(", ")}. You can now go to /login to sign in.`,
      )
    } catch (error) {
      console.error("[v0] Error:", error)
      setStatus(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setLoading(false)
    }
  }

  const verifyAdmins = async () => {
    setLoading(true)
    const results: string[] = []

    for (const admin of ADMIN_EMAILS) {
      const email = admin.email.toLowerCase()

      const approvedSnap = await getDoc(doc(db, "approvedEmails", email))
      const adminSnap = await getDoc(doc(db, "admins", email))

      results.push(
        `${email}: approvedEmails=${approvedSnap.exists() ? "YES" : "NO"}, admins=${adminSnap.exists() ? "YES" : "NO"}`,
      )
    }

    setVerification(results)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Admin Setup</CardTitle>
          <CardDescription>Grant admin access to {ADMIN_EMAILS.length} accounts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-1">
            {ADMIN_EMAILS.map((admin) => (
              <div key={admin.email}>
                {admin.name} ({admin.email})
              </div>
            ))}
          </div>
          <Button onClick={setupAdmin} disabled={loading} className="w-full">
            {loading ? "Setting up..." : "Grant Admin Access"}
          </Button>
          <Button onClick={verifyAdmins} disabled={loading} variant="outline" className="w-full bg-transparent">
            {loading ? "Checking..." : "Verify Database Entries"}
          </Button>
          {verification.length > 0 && (
            <div className="p-4 rounded-lg bg-gray-50 text-sm font-mono space-y-1">
              {verification.map((v, i) => (
                <div key={i}>{v}</div>
              ))}
            </div>
          )}
          {status && (
            <div
              className={`p-4 rounded-lg ${
                status.includes("Success")
                  ? "bg-green-50 text-green-800"
                  : status.includes("Error")
                    ? "bg-red-50 text-red-800"
                    : "bg-blue-50 text-blue-800"
              }`}
            >
              {status}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
