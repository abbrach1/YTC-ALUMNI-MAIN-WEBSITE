"use client"

import { useState, useEffect } from "react"
import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-context"
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { User, Mail, Phone, MapPin, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [alumniRecord, setAlumniRecord] = useState<any>(null)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    location: "",
  })

  useEffect(() => {
    // Wait for auth to finish loading before checking user
    if (authLoading) return

    if (!user) {
      router.push("/login")
      return
    }

    const fetchAlumniInfo = async () => {
      try {
        const alumniRef = collection(db, "alumniContactSubmissions")
        const q = query(alumniRef, where("email", "==", user.email))
        const querySnapshot = await getDocs(q)

        if (!querySnapshot.empty) {
          const docData = querySnapshot.docs[0]
          const data = docData.data()
          setAlumniRecord({ id: docData.id, ...data })
          setFormData({
            name: data.name || "",
            email: data.email || "",
            phone: data.phone || "",
            location: data.location || "",
          })
        } else {
          setFormData({
            name: "",
            email: user.email || "",
            phone: "",
            location: "",
          })
        }
      } catch (error) {
        console.error("Error fetching alumni info:", error)
        toast({
          title: "Error",
          description: "Could not load your information",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchAlumniInfo()
  }, [user, authLoading, router, toast])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      if (alumniRecord?.id) {
        // Update existing record
        await updateDoc(doc(db, "alumniContactSubmissions", alumniRecord.id), {
          name: formData.name,
          phone: formData.phone,
          location: formData.location,
          updatedAt: new Date().toISOString(),
        })
        toast({
          title: "Success",
          description: "Your information has been updated",
        })
      } else {
        toast({
          title: "Not Found",
          description: "No alumni record found. Please contact the alumni office.",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error("Error updating info:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to update information",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading || loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-cream py-12 px-4">
          <div className="max-w-2xl mx-auto flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-navy" />
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-cream py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <Card className="border-gold/20 bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="text-navy flex items-center gap-2">
                <User className="h-5 w-5" />
                My Alumni Directory Information
              </CardTitle>
              <p className="text-sm text-navy/60 mt-2">
                Update your information in the alumni directory
                {alumniRecord?.status === "pending" && (
                  <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                    Pending Approval
                  </span>
                )}
                {alumniRecord?.status === "approved" && (
                  <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                    Approved & Visible
                  </span>
                )}
              </p>
            </CardHeader>
            <CardContent>
              {!alumniRecord ? (
                <div className="text-center py-8">
                  <User className="h-12 w-12 text-navy/30 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-navy mb-2">No Record Found</h3>
                  <p className="text-navy/60 mb-6">
                    You don't have an alumni directory entry yet. Please submit your information through the Contacts page.
                  </p>
                  <Button
                    onClick={() => router.push("/contacts")}
                    className="bg-navy text-cream hover:bg-navy/90"
                  >
                    Go to Contacts
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="flex items-center gap-2">
                      <User className="h-4 w-4 text-navy/60" />
                      Full Name *
                    </Label>
                    <Input
                      id="name"
                      required
                      placeholder="Your full name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="border-navy/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-navy/60" />
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      disabled
                      value={formData.email}
                      className="border-navy/20 bg-gray-50"
                    />
                    <p className="text-xs text-navy/50">Email cannot be changed</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-navy/60" />
                      Phone Number
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="(123) 456-7890"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="border-navy/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location" className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-navy/60" />
                      Location
                    </Label>
                    <Input
                      id="location"
                      placeholder="City, State"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="border-navy/20"
                    />
                  </div>

                  <div className="pt-4 border-t border-navy/10">
                    <Button
                      type="submit"
                      disabled={submitting}
                      className="w-full bg-navy text-cream hover:bg-navy/90"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        "Update Information"
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
