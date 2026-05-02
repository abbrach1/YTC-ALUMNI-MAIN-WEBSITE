"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { BookOpen, ArrowRight, Sparkles } from "lucide-react"
import { useAuth } from "@/lib/auth-context"

const STORAGE_KEY = "ytc-rebbeim-portal-announcement-v1-dismissed"

export function RebbeimPortalAnnouncement() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const { user, loading } = useAuth()

  useEffect(() => {
    // Wait for auth to resolve, only show to logged-in users
    if (loading) return
    if (!user) return

    // Don't show on the contacts page itself - they're already there
    if (pathname?.startsWith("/contacts")) return

    try {
      const dismissed = localStorage.getItem(STORAGE_KEY)
      if (!dismissed) {
        // Small delay so it doesn't fight with first-paint
        const timer = setTimeout(() => setOpen(true), 800)
        return () => clearTimeout(timer)
      }
    } catch {
      // localStorage unavailable (private mode etc.) - just don't show
    }
  }, [pathname, user, loading])

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString())
    } catch {
      // ignore
    }
    setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss()
      }}
    >
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-navy/10">
        {/* Header banner */}
        <div className="relative bg-navy text-cream px-6 pt-7 pb-6">
          <div className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-gold/20 px-2.5 py-0.5 text-xs font-semibold text-gold">
            <Sparkles className="h-3 w-3" />
            New
          </div>
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-gold/15 border border-gold/30 mx-auto mb-4">
            <BookOpen className="h-7 w-7 text-gold" />
          </div>
          <DialogHeader className="text-center space-y-2">
            <DialogTitle className="text-cream text-2xl text-balance">
              The Rebbeim Portal is Live
            </DialogTitle>
            <DialogDescription className="text-cream/70 text-pretty">
              The full Rebbeim directory is now available. Browse contact info for all the Rebbeim in one place.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Action area */}
        <div className="px-6 py-5 bg-white flex flex-col gap-2">
          <Button
            asChild
            className="w-full bg-navy text-cream hover:bg-navy/90 h-11"
            onClick={dismiss}
          >
            <Link href="/contacts?tab=rebbeim">
              Open Rebbeim Portal
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            className="w-full text-navy/60 hover:text-navy hover:bg-navy/5"
            onClick={dismiss}
          >
            Maybe later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
