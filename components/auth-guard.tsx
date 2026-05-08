"use client"

import type React from "react"

import { useAuth } from "@/lib/auth-context"
import { useRouter, usePathname } from "next/navigation"
import { useEffect } from "react"
import { canAccessAdminPath } from "@/lib/admin-pages"

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const {
    user,
    loading,
    isApproved,
    isAdmin,
    isSuperAdmin,
    allowedAdminPages,
    checkingApproval,
  } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (loading || checkingApproval) return

    // Public routes
    const publicRoutes = ["/login", "/request-access", "/admin-setup", "/upload-shiur"]
    if (publicRoutes.includes(pathname)) {
      // For /upload-shiur, require authentication but not approval
      if (pathname === "/upload-shiur" && !user) {
        router.push("/login")
      }
      return
    }

    // Check if user is logged in
    if (!user) {
      router.push("/login")
      return
    }

    // Admin route checks: must be admin AND have access to this specific path.
    if (pathname.startsWith("/admin")) {
      if (!isAdmin) {
        router.push("/access-denied")
        return
      }
      if (!canAccessAdminPath(pathname, isSuperAdmin, allowedAdminPages)) {
        router.push("/access-denied")
        return
      }
      return
    }

    // Check if user is approved (for non-admin routes)
    if (!isApproved && !isAdmin) {
      router.push("/request-access")
      return
    }
  }, [
    user,
    loading,
    isApproved,
    isAdmin,
    isSuperAdmin,
    allowedAdminPages,
    checkingApproval,
    pathname,
    router,
  ])

  if (loading || checkingApproval) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-navy border-t-transparent mx-auto mb-4" />
          <p className="text-navy font-serif">Loading...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
