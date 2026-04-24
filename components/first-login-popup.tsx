"use client"

import { useEffect, useState } from "react"
import { doc, getDoc, setDoc, addDoc, collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { getUserFriendlyError } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Send } from "lucide-react"

export function FirstLoginPopup() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    phone2: "",
    locationType: "",
    locationOther: "",
  })
  const { user, isApproved } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    const checkFirstLogin = async () => {
      if (!user?.email || !isApproved) {
        setLoading(false)
        return
      }

      try {
        const userEmail = user.email.toLowerCase()
        const userProfileRef = doc(db, "userProfiles", userEmail)
        const profileSnap = await getDoc(userProfileRef)

        // Check if user already marked as completed
        if (profileSnap.exists() && profileSnap.data()?.hasCompletedContactForm) {
          setLoading(false)
          return
        }

        // Also check if user has already submitted contact info (for users who submitted before the flag existed)
        const submissionsQuery = query(
          collection(db, "alumniContactSubmissions"),
          where("submittedBy", "==", userEmail)
        )
        const submissionsSnap = await getDocs(submissionsQuery)

        if (!submissionsSnap.empty) {
          // User already submitted, update their profile to mark as completed
          await setDoc(userProfileRef, {
            hasCompletedContactForm: true,
            completedAt: new Date().toISOString(),
          }, { merge: true })
          setLoading(false)
          return
        }

        // No submission found, show the popup
        setOpen(true)
      } catch (error) {
        console.error("Error checking first login status:", error)
      } finally {
        setLoading(false)
      }
    }

    checkFirstLogin()
  }, [user?.email, isApproved])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const locationValue = formData.locationType === "Other" ? formData.locationOther : formData.locationType

      // Save contact submission
      await addDoc(collection(db, "alumniContactSubmissions"), {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        phone2: formData.phone2 || null,
        location: locationValue,
        submittedBy: user?.email,
        submittedAt: new Date().toISOString(),
        status: "pending",
      })

      // Mark user as having completed the form
      await setDoc(doc(db, "userProfiles", user!.email!.toLowerCase()), {
        hasCompletedContactForm: true,
        completedAt: new Date().toISOString(),
      }, { merge: true })

      // Send notification email
      await fetch("/api/send-contact-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: formData.name,
          email: formData.email || "Not provided",
          phone: formData.phone || "Not provided",
          phone2: formData.phone2 || "Not provided",
          city: locationValue,
        }),
      })

      toast({
        title: "Welcome!",
        description: "Thank you for submitting your contact information.",
      })

      setOpen(false)
    } catch (error: any) {
      toast({
        title: "Unable to submit",
        description: getUserFriendlyError(error),
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleSkip = async () => {
    try {
      // Mark as skipped so we don't show again
      await setDoc(doc(db, "userProfiles", user!.email!.toLowerCase()), {
        hasCompletedContactForm: true,
        skippedAt: new Date().toISOString(),
      }, { merge: true })
    } catch (error) {
      console.error("Error marking form as skipped:", error)
    }
    setOpen(false)
  }

  if (loading || !user || !isApproved) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-navy text-xl">Add Your Contact Info</DialogTitle>
          <DialogDescription className="text-navy/70">
            Submit your details to be listed in the alumni directory.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="popup-name" className="text-navy font-medium">
              Full Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="popup-name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="border-navy/20"
              placeholder="Enter your full name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="popup-email" className="text-navy font-medium">
              Email <span className="text-navy/50">(Optional)</span>
            </Label>
            <Input
              id="popup-email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="border-navy/20"
              placeholder="your.email@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="popup-phone" className="text-navy font-medium">
              Phone Number <span className="text-navy/50">(Optional)</span>
            </Label>
            <Input
              id="popup-phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="border-navy/20"
              placeholder="(555) 123-4567"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="popup-phone2" className="text-navy font-medium">
              Second Phone Number <span className="text-navy/50">(Optional)</span>
            </Label>
            <Input
              id="popup-phone2"
              type="tel"
              value={formData.phone2}
              onChange={(e) => setFormData({ ...formData, phone2: e.target.value })}
              className="border-navy/20"
              placeholder="(555) 987-6543"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="popup-location" className="text-navy font-medium">
              Current Location <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.locationType}
              onValueChange={(value) => setFormData({ ...formData, locationType: value, locationOther: value !== "Other" ? "" : formData.locationOther })}
              required
            >
              <SelectTrigger className="border-navy/20">
                <SelectValue placeholder="Select your location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Eretz Yisroel">Eretz Yisroel</SelectItem>
                <SelectItem value="Chutz Laaretz">Chutz Laaretz</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.locationType === "Other" && (
            <div className="space-y-2">
              <Label htmlFor="popup-locationOther" className="text-navy font-medium">
                Please specify location <span className="text-red-500">*</span>
              </Label>
              <Input
                id="popup-locationOther"
                required
                value={formData.locationOther}
                onChange={(e) => setFormData({ ...formData, locationOther: e.target.value })}
                className="border-navy/20"
                placeholder="Enter your location"
              />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleSkip}
              className="flex-1 border-navy/20 text-navy/70 hover:bg-navy/5"
            >
              Skip for now
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-navy text-cream hover:bg-navy/90"
            >
              {submitting ? "Submitting..." : "Submit"}
              <Send className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
