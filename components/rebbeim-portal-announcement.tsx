"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"

const STORAGE_KEY = "ytc-rebbeim-portal-announcement-v1-dismissed"

export function RebbeimPortalAnnouncement() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    if (!user) return
    if (pathname?.startsWith("/contacts")) return

    try {
      const dismissed = localStorage.getItem(STORAGE_KEY)
      if (!dismissed) {
        const timer = setTimeout(() => setOpen(true), 800)
        return () => clearTimeout(timer)
      }
    } catch {
      // localStorage unavailable - skip
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-navy text-xl">Rebbeim Directory is up</DialogTitle>
          <DialogDescription className="text-navy/70">
            Contact info for the Rebbeim has been added to the directory. You can find phone numbers and emails on the contacts page.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={dismiss}
            className="flex-1 border-navy/20 text-navy/70 hover:bg-navy/5"
          >
            Got it
          </Button>
          <Button
            asChild
            className="flex-1 bg-navy text-cream hover:bg-navy/90"
            onClick={dismiss}
          >
            <Link href="/contacts?tab=rebbeim">View directory</Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
