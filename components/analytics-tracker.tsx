"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { doc, setDoc, increment } from "firebase/firestore"
import { db, auth } from "@/lib/firebase"
import { onAuthStateChanged } from "firebase/auth"

type TrackedUser = { uid: string; email: string; name: string } | null

export function AnalyticsTracker() {
  const pathname = usePathname()
  const lastTrackedPath = useRef<string | null>(null)

  // Auth state lives in React state (not a ref) so the tracking effect
  // re-runs once auth has resolved — otherwise the very first navigation
  // is recorded as Anonymous before onAuthStateChanged fires.
  const [authReady, setAuthReady] = useState(false)
  const [trackedUser, setTrackedUser] = useState<TrackedUser>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setTrackedUser({
          uid: user.uid,
          email: user.email || "Unknown",
          name: user.displayName || user.email?.split("@")[0] || "Unknown",
        })
      } else {
        setTrackedUser(null)
      }
      setAuthReady(true)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    // Don't track admin pages
    if (pathname.startsWith("/admin")) return

    // Wait for auth to resolve before logging — avoids attributing the
    // first pageview to "Anonymous" when the user is actually signed in.
    if (!authReady) return

    // Don't track the same page twice in a row
    if (lastTrackedPath.current === pathname) return
    lastTrackedPath.current = pathname

    const trackPageView = async () => {
      try {
        const today = new Date().toISOString().split("T")[0] // YYYY-MM-DD
        const pageKey = pathname === "/" ? "home" : pathname.replace(/\//g, "_").slice(1)
        const nowIso = new Date().toISOString()

        // Track daily page views
        const dailyRef = doc(db, "analytics", "daily", today, pageKey)
        await setDoc(
          dailyRef,
          {
            path: pathname,
            views: increment(1),
            lastVisit: nowIso,
          },
          { merge: true },
        )

        // Track total page views
        const totalRef = doc(db, "analytics", "totals")
        await setDoc(
          totalRef,
          {
            [pageKey]: increment(1),
            totalPageViews: increment(1),
            lastUpdated: nowIso,
          },
          { merge: true },
        )

        // Record the visitor in today's visitor map. Keyed by uid so each user
        // appears exactly once per day; lastSeen overwrites instead of growing
        // an unbounded array. visits is incremented on every pageview so the
        // admin can show "Alice (3)" when she's hit three pages today.
        if (trackedUser) {
          const dailyVisitorsRef = doc(db, "analytics", "daily", today, "_visitors")
          await setDoc(
            dailyVisitorsRef,
            {
              users: {
                [trackedUser.uid]: {
                  uid: trackedUser.uid,
                  email: trackedUser.email,
                  name: trackedUser.name,
                  lastSeen: nowIso,
                  visits: increment(1),
                },
              },
            },
            { merge: true },
          )
        }
      } catch (error) {
        // Silently fail - analytics shouldn't break the site
        console.error("Analytics error:", error)
      }
    }

    trackPageView()
  }, [pathname, authReady, trackedUser])

  return null
}
