"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Send, ExternalLink, CheckCircle2, Gift } from "lucide-react"
import { CampaignProgress } from "@/components/campaign-progress"
import { CampaignCountdown } from "@/components/campaign-countdown"
import { doc, getDoc, setDoc, collection, addDoc, getDocs, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { getUserFriendlyError } from "@/lib/utils"
import {
  FUNDRAISER_SETTINGS_DOC,
  FUNDRAISER_SIGNUPS_COLLECTION,
  FUNDRAISER_DEFAULTS,
  type FundraiserSettings,
} from "@/lib/fundraiser"

/**
 * Home-page call-to-action for the alumni fundraiser. Self-gating: it reads
 * settings/{FUNDRAISER_SETTINGS_DOC} and renders nothing unless the campaign is
 * enabled, so the home page can drop in `<CampaignSignup />` unconditionally.
 */
export function CampaignSignup() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [settings, setSettings] = useState<FundraiserSettings | null>(null)
  const [open, setOpen] = useState(false)
  const [incentivesOpen, setIncentivesOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [alreadySubmitted, setAlreadySubmitted] = useState(false)
  const [showResubmitConfirm, setShowResubmitConfirm] = useState(false)
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    pageTitle: "",
    goalAmount: "",
    message: "",
  })

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const snap = await getDoc(doc(db, "settings", FUNDRAISER_SETTINGS_DOC))
        if (!snap.exists()) return
        const data = snap.data() as Partial<FundraiserSettings>
        if (!data.enabled) return
        setSettings({ ...FUNDRAISER_DEFAULTS, ...data, enabled: true })
      } catch (e) {
        // A missing/blocked settings doc just hides the section — never crash the home page.
        console.error("[fundraiser] failed to load campaign settings", e)
      }
    }
    fetchSettings()
  }, [])

  // Prefill name/email/phone from the logged-in account + their alumni contact
  // record (the same source the Profile page uses) once settings load.
  useEffect(() => {
    if (!settings || !user) return
    let cancelled = false
    const prefill = async () => {
      // Pre-fill goal + message from the admin-configured campaign defaults.
      setFormData((prev) => ({
        ...prev,
        goalAmount: prev.goalAmount || settings.defaultGoal || "$1,800",
        message: prev.message || settings.defaultMessage || "",
      }))

      let name = user.displayName || ""
      let phone = ""
      try {
        if (user.email) {
          const snap = await getDocs(
            query(collection(db, "alumniContactSubmissions"), where("email", "==", user.email)),
          )
          const rec = snap.docs[0]?.data() as { name?: string; phone?: string } | undefined
          if (rec?.name) name = rec.name
          if (rec?.phone) phone = rec.phone
        }
      } catch (e) {
        console.error("[fundraiser] failed to prefill from contact record", e)
      }

      // Has this user already created a page? (cross-device marker)
      try {
        const marker = await getDoc(doc(db, "users", user.uid, "preferences", "fundraiserSignup"))
        if (!cancelled && marker.exists() && marker.data()?.signedUp) {
          setAlreadySubmitted(true)
        }
      } catch (e) {
        console.error("[fundraiser] failed to check prior signup", e)
      }

      if (cancelled) return
      setFormData((prev) => ({
        ...prev,
        fullName: prev.fullName || name,
        email: prev.email || user.email || "",
        phone: prev.phone || phone,
      }))
    }
    prefill()
    return () => {
      cancelled = true
    }
  }, [settings, user])

  if (!settings) return null

  const deadlineLabel = (() => {
    if (!settings.deadline) return null
    const d = new Date(`${settings.deadline}T00:00:00`)
    if (Number.isNaN(d.getTime())) return null
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
  })()

  const doSubmit = async () => {
    setSubmitting(true)

    const payload = {
      fullName: formData.fullName.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      pageTitle: formData.pageTitle.trim(),
      goalAmount: formData.goalAmount.trim(),
      message: formData.message.trim(),
    }

    try {
      await addDoc(collection(db, FUNDRAISER_SIGNUPS_COLLECTION), {
        ...payload,
        submittedBy: user?.email ?? null,
        submittedAt: new Date().toISOString(),
        status: "new",
      })

      // Mark this user as having created a page (cross-device; gates the re-submit confirm).
      if (user) {
        try {
          await setDoc(
            doc(db, "users", user.uid, "preferences", "fundraiserSignup"),
            { signedUp: true, lastSignupAt: Date.now() },
            { merge: true },
          )
        } catch (markerErr) {
          console.error("[fundraiser] marker write failed", markerErr)
        }
      }
      setAlreadySubmitted(true)

      // Notify the office — best-effort; a mail failure shouldn't lose the saved sign-up.
      try {
        await fetch("/api/send-campaign-signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            campaignName: settings.campaignName,
            submittedBy: user?.email ?? "",
          }),
        })
      } catch (mailErr) {
        console.error("[fundraiser] notification email failed", mailErr)
      }

      setSubmitted(true)
      toast({
        title: "Page created!",
        description: "We'll email you with the details when the campaign goes live.",
      })
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void doSubmit()
  }

  // Tapping the home-page CTA: if they've already created a page, confirm before
  // opening the form again; otherwise open it straight away.
  const handleCreateClick = () => {
    if (alreadySubmitted) {
      setShowResubmitConfirm(true)
    } else {
      setOpen(true)
    }
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    // Reset the success state after the dialog finishes closing.
    if (!next) setTimeout(() => setSubmitted(false), 200)
  }

  return (
    <section>
      <Card className="border-navy/10 bg-navy shadow-md overflow-hidden">
        <CardContent className="p-8 sm:p-10">
          <div className="flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1">
              {settings.campaignName && (
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gold">
                  {settings.campaignName}
                </p>
              )}
              <h2 className="font-serif text-3xl font-bold text-cream sm:text-4xl">{settings.headline}</h2>
              <p className="mt-3 max-w-2xl leading-relaxed text-cream/80 whitespace-pre-wrap">
                {settings.description}
              </p>
              {deadlineLabel && (
                <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-cream/60">
                  <span>Campaign ends {deadlineLabel}</span>
                  {settings.showCountdown && settings.deadline && (
                    <CampaignCountdown deadline={settings.deadline} variant="dark" />
                  )}
                </p>
              )}
              {settings.showCampaignStatus && (settings.statusUrl || settings.campaignUrl) && (
                <CampaignProgress
                  campaignUrl={settings.statusUrl || settings.campaignUrl}
                  variant="dark"
                  className="mt-6 max-w-xl"
                />
              )}
            </div>
            <div className="flex flex-shrink-0 flex-col items-stretch gap-3">
              <Button
                onClick={handleCreateClick}
                className="h-12 bg-gold px-8 text-base font-semibold text-navy hover:bg-gold-light"
              >
                Create Your Page
              </Button>
              {settings.showIncentives && settings.incentivesImageUrl && (
                <Button
                  onClick={() => setIncentivesOpen(true)}
                  variant="outline"
                  className="h-12 border-cream/30 bg-transparent px-8 text-base font-semibold text-cream hover:bg-cream/10 hover:text-cream"
                >
                  <Gift className="mr-2 h-4 w-4" />
                  See the Incentives
                </Button>
              )}
              {settings.showLinkOnHome && settings.campaignUrl && (
                <Button
                  asChild
                  variant="outline"
                  className="h-12 border-cream/30 bg-transparent px-8 text-base font-semibold text-cream hover:bg-cream/10 hover:text-cream"
                >
                  <a href={settings.campaignUrl} target="_blank" rel="noopener noreferrer">
                    Visit the Campaign
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {submitted ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <CheckCircle2 className="h-14 w-14 text-green-600" />
              <DialogHeader>
                <DialogTitle className="text-center text-navy">Your page has been created!</DialogTitle>
                <DialogDescription className="text-center">
                  You&apos;ll get an email with all the info when the campaign goes live.
                </DialogDescription>
              </DialogHeader>
              {settings.showLinkOnSubmit && settings.campaignUrl && (
                <Button asChild className="bg-navy text-cream hover:bg-navy/90">
                  <a href={settings.campaignUrl} target="_blank" rel="noopener noreferrer">
                    Visit the Campaign
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              )}
              <Button variant="ghost" onClick={() => handleOpenChange(false)} className="text-navy/60">
                Close
              </Button>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-navy">Create Your Fundraising Page</DialogTitle>
                <DialogDescription>
                  Tell us a few details and our office will set up your personal campaign page.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="cs-fullName" className="text-sm font-medium text-navy">
                      Full Name
                    </Label>
                    <Input
                      id="cs-fullName"
                      required
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      placeholder="Your name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cs-email" className="text-sm font-medium text-navy">
                      Email
                    </Label>
                    <Input
                      id="cs-email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="you@example.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cs-phone" className="text-sm font-medium text-navy">
                      Phone <span className="font-normal text-navy/40">(optional)</span>
                    </Label>
                    <Input
                      id="cs-phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="(555) 555-5555"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cs-pageTitle" className="text-sm font-medium text-navy">
                      Page / Team Title <span className="font-normal text-navy/40">(optional)</span>
                    </Label>
                    <Input
                      id="cs-pageTitle"
                      value={formData.pageTitle}
                      onChange={(e) => setFormData({ ...formData, pageTitle: e.target.value })}
                      placeholder="e.g. The Cohen Family"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cs-goal" className="text-sm font-medium text-navy">
                    Fundraising Goal
                  </Label>
                  <Input
                    id="cs-goal"
                    required
                    value={formData.goalAmount}
                    onChange={(e) => setFormData({ ...formData, goalAmount: e.target.value })}
                    placeholder="e.g. $1,800"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cs-message" className="text-sm font-medium text-navy">
                    Personal Message <span className="font-normal text-navy/40">(optional)</span>
                  </Label>
                  <Textarea
                    id="cs-message"
                    rows={3}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Why you're raising, a dedication, etc."
                    className="resize-none"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-12 w-full bg-navy text-base font-medium text-cream hover:bg-navy/90"
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-cream/30 border-t-cream" />
                      Submitting...
                    </span>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Submit
                    </>
                  )}
                </Button>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={incentivesOpen} onOpenChange={setIncentivesOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto p-2 sm:max-w-3xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Campaign Incentives</DialogTitle>
            <DialogDescription>The incentives for this campaign.</DialogDescription>
          </DialogHeader>
          {settings.incentivesImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={settings.incentivesImageUrl}
              alt="Campaign incentives"
              className="h-auto w-full rounded-lg object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showResubmitConfirm} onOpenChange={setShowResubmitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>You&apos;ve already created a page</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to create another fundraising page?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowResubmitConfirm(false)
                setOpen(true)
              }}
              className="bg-navy text-cream hover:bg-navy/90"
            >
              Create Another
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
