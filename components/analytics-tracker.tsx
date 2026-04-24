"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { doc, setDoc, increment, arrayUnion } from "firebase/firestore"
import { db, auth } from "@/lib/firebase"
import { onAuthStateChanged } from "firebase/auth"

export function AnalyticsTracker() {
  const pathname = usePathname()
  const lastTrackedPath = useRef<string | null>(null)
  const userRef = useRef<{ email: string; name?: string } | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        userRef.current = {
          email: user.email || "Unknown",
          name: user.displayName || user.email?.split("@")[0] || "Unknown",
        }
      } else {
        userRef.current = null
      }
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    // Don't track admin pages
    if (pathname.startsWith("/admin")) return

    // Don't track the same page twice in a row
    if (lastTrackedPath.current === pathname) return
    lastTrackedPath.current = pathname

    const trackPageView = async () => {
      try {
        const today = new Date().toISOString().split("T")[0] // YYYY-MM-DD
        const pageKey = pathname === "/" ? "home" : pathname.replace(/\//g, "_").slice(1)

        // Track daily page views
        const dailyRef = doc(db, "analytics", "daily", today, pageKey)
        await setDoc(
          dailyRef,
          {
            path: pathname,
            views: increment(1),
            lastVisit: new Date().toISOString(),
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
            lastUpdated: new Date().toISOString(),
          },
          { merge: true },
        )

        if (userRef.current) {
          const dailyVisitorsRef = doc(db, "analytics", "daily", today, "_visitors")
          await setDoc(
            dailyVisitorsRef,
            {
              users: arrayUnion({
                email: userRef.current.email,
                name: userRef.current.name,
                lastSeen: new Date().toISOString(),
              }),
            },
            { merge: true },
          )
        }

        // Track unique visitors (using sessionStorage to avoid double counting)
        const sessionKey = `visited_${today}`
        if (!sessionStorage.getItem(sessionKey)) {
          sessionStorage.setItem(sessionKey, "true")
          await setDoc(
            totalRef,
            {
              uniqueVisitors: increment(1),
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
  }, [pathname])

  return null
}
