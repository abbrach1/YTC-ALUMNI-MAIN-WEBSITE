"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { collection, getDocs, query, where, doc, getDoc, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/lib/auth-context"
import {
  POPUPS_COLLECTION,
  POPUP_DISMISS_DOC,
  resolvePopupHref,
  type AdminPopup,
} from "@/lib/popups"

/**
 * Shows admin-authored one-time popups to logged-in users. Picks the oldest
 * enabled popup the user hasn't dismissed yet and shows it; dismissing (via
 * either button) records the dismissal per-user in Firestore so it never shows
 * again — on web or iOS. Mounted once in the root layout.
 */
export function AdminPopups() {
  const { user, loading } = useAuth()
  const [popup, setPopup] = useState<AdminPopup | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (loading || !user) return
    let cancelled = false

    const load = async () => {
      try {
        // Enabled popups, oldest first (so the earliest unseen one shows).
        const snap = await getDocs(
          query(collection(db, POPUPS_COLLECTION), where("enabled", "==", true)),
        )
        const popups: AdminPopup[] = []
        snap.forEach((d) => popups.push({ id: d.id, ...(d.data() as Omit<AdminPopup, "id">) }))
        popups.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""))
        if (popups.length === 0) return

        // Which has this user already dismissed?
        const markerSnap = await getDoc(
          doc(db, "users", user.uid, "preferences", POPUP_DISMISS_DOC),
        )
        const dismissed = (markerSnap.data()?.ids ?? {}) as Record<string, unknown>

        const next = popups.find((p) => p.id && !dismissed[p.id])
        if (!next || cancelled) return

        // Brief delay so it doesn't slam up during initial render.
        const timer = setTimeout(() => {
          if (!cancelled) {
            setPopup(next)
            setOpen(true)
          }
        }, 800)
        return () => clearTimeout(timer)
      } catch (e) {
        // A missing/blocked collection just means no popups — never crash the app.
        console.error("[popups] failed to load", e)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [user, loading])

  const dismiss = async () => {
    setOpen(false)
    const current = popup
    if (!current?.id || !user) return
    try {
      await setDoc(
        doc(db, "users", user.uid, "preferences", POPUP_DISMISS_DOC),
        { ids: { [current.id]: new Date().toISOString() } },
        { merge: true },
      )
    } catch (e) {
      console.error("[popups] failed to record dismissal", e)
    }
  }

  if (!popup) return null

  const href = resolvePopupHref(popup)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) void dismiss()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-navy text-xl">{popup.title}</DialogTitle>
          <DialogDescription className="text-navy/70 whitespace-pre-wrap">
            {popup.message}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void dismiss()}
            className="flex-1 border-navy/20 text-navy/70 hover:bg-navy/5"
          >
            {popup.dismissLabel || "Got it"}
          </Button>
          {href && popup.buttonLabel && (
            <Button asChild className="flex-1 bg-navy text-cream hover:bg-navy/90" onClick={() => void dismiss()}>
              {popup.target === "external" ? (
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {popup.buttonLabel}
                </a>
              ) : (
                <Link href={href}>{popup.buttonLabel}</Link>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
