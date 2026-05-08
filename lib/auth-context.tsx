"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import {
  type User,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth"
import { doc, getDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore"
import { auth, db } from "./firebase"
import { SUPER_ADMIN_EMAIL } from "./admin-pages"

interface UserProfile {
  firstName: string
  lastName: string
  graduationYear?: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  isApproved: boolean
  isAdmin: boolean
  isSuperAdmin: boolean
  /**
   * The list of admin page hrefs this admin may access. `null` means no
   * restriction (full access — used for the super-admin and for legacy
   * admins whose Firestore doc has no `pages` field).
   */
  allowedAdminPages: string[] | null
  checkingApproval: boolean
  signInWithGoogle: () => Promise<{ isApproved: boolean; isAdmin: boolean }>
  signInWithEmail: (email: string, password: string) => Promise<{ isApproved: boolean; isAdmin: boolean }>
  signUpWithEmail: (email: string, password: string, profile: UserProfile) => Promise<{ isApproved: boolean; isAdmin: boolean }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

async function checkUserApproval(email: string): Promise<{
  approved: boolean
  admin: boolean
  superAdmin: boolean
  allowedAdminPages: string[] | null
  approvalSource?: string
}> {
  const normalizedEmail = email.toLowerCase()

  let approved = false
  let approvalSource: string | undefined

  // Check if email exists in alumni database
  const alumniRef = doc(db, "alumniDatabase", normalizedEmail)
  const alumniSnap = await getDoc(alumniRef)

  if (alumniSnap.exists()) {
    approved = true
    approvalSource = "Alumni Database"
  } else {
    // Fallback: Check old approvedEmails collection
    const approvedRef = doc(db, "approvedEmails", normalizedEmail)
    const approvedSnap = await getDoc(approvedRef)

    if (approvedSnap.exists()) {
      approved = true
      approvalSource = "Approved Emails List"
    } else {
      const approvedQuery = query(collection(db, "approvedEmails"), where("email", "==", normalizedEmail))
      const approvedQuerySnap = await getDocs(approvedQuery)
      if (!approvedQuerySnap.empty) {
        approved = true
        approvalSource = "Approved Emails List"
      }
    }
  }

  // Check admin status. We try the email-keyed doc first because that's
  // what /admin/permissions writes; fall back to the legacy email-field
  // query so admins added via older flows still resolve.
  let admin = false
  let allowedAdminPages: string[] | null = null
  const adminRef = doc(db, "admins", normalizedEmail)
  const adminSnap = await getDoc(adminRef)

  if (adminSnap.exists()) {
    admin = true
    const data = adminSnap.data()
    if (Array.isArray(data?.pages)) {
      allowedAdminPages = data.pages.filter((p: unknown): p is string => typeof p === "string")
    }
  } else {
    const adminQuery = query(collection(db, "admins"), where("email", "==", normalizedEmail))
    const adminQuerySnap = await getDocs(adminQuery)
    if (!adminQuerySnap.empty) {
      admin = true
      const data = adminQuerySnap.docs[0].data()
      if (Array.isArray(data?.pages)) {
        allowedAdminPages = data.pages.filter((p: unknown): p is string => typeof p === "string")
      }
    }
  }

  // Super-admin always has full access regardless of any pages field.
  const superAdmin = admin && normalizedEmail === SUPER_ADMIN_EMAIL.toLowerCase()
  if (superAdmin) allowedAdminPages = null

  return { approved, admin, superAdmin, allowedAdminPages, approvalSource }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isApproved, setIsApproved] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [allowedAdminPages, setAllowedAdminPages] = useState<string[] | null>(null)
  const [checkingApproval, setCheckingApproval] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user)
      setCheckingApproval(true)

      if (user && user.email) {
        const { approved, admin, superAdmin, allowedAdminPages } = await checkUserApproval(user.email)
        setIsApproved(approved)
        setIsAdmin(admin)
        setIsSuperAdmin(superAdmin)
        setAllowedAdminPages(allowedAdminPages)
      } else {
        setIsApproved(false)
        setIsAdmin(false)
        setIsSuperAdmin(false)
        setAllowedAdminPages(null)
      }

      setCheckingApproval(false)
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider()
    const result = await signInWithPopup(auth, provider)
    if (result.user.email) {
      const { approved, admin, superAdmin, allowedAdminPages } = await checkUserApproval(result.user.email)
      setIsApproved(approved)
      setIsAdmin(admin)
      setIsSuperAdmin(superAdmin)
      setAllowedAdminPages(allowedAdminPages)
      return { isApproved: approved, isAdmin: admin }
    }
    return { isApproved: false, isAdmin: false }
  }

  const signInWithEmail = async (email: string, password: string) => {
    const result = await signInWithEmailAndPassword(auth, email, password)
    if (result.user.email) {
      const { approved, admin, superAdmin, allowedAdminPages } = await checkUserApproval(result.user.email)
      setIsApproved(approved)
      setIsAdmin(admin)
      setIsSuperAdmin(superAdmin)
      setAllowedAdminPages(allowedAdminPages)
      return { isApproved: approved, isAdmin: admin }
    }
    return { isApproved: false, isAdmin: false }
  }

  const signUpWithEmail = async (email: string, password: string, profile: UserProfile) => {
    const result = await createUserWithEmailAndPassword(auth, email, password)
    if (result.user.email) {
      const normalizedEmail = result.user.email.toLowerCase()
      const { approved, admin, superAdmin, allowedAdminPages, approvalSource } = await checkUserApproval(normalizedEmail)
      setIsApproved(approved)
      setIsAdmin(admin)
      setIsSuperAdmin(superAdmin)
      setAllowedAdminPages(allowedAdminPages)
      
      const fullName = `${profile.firstName} ${profile.lastName}`
      
      // Create access request record so user shows up in admin users list
      try {
        await setDoc(doc(db, "accessRequests", normalizedEmail), {
          email: normalizedEmail,
          firstName: profile.firstName,
          lastName: profile.lastName,
          fullName,
          graduationYear: profile.graduationYear || null,
          requestedAt: new Date().toISOString(),
          status: approved ? "approved" : "pending",
          approvalSource: approvalSource || null,
          autoApproved: approved,
        })
      } catch (error) {
        console.error("Failed to create access request record:", error)
      }
      
      // Send signup notification email to admin
      try {
        await fetch("/api/send-signup-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userEmail: normalizedEmail,
            userName: fullName,
            graduationYear: profile.graduationYear,
            isApproved: approved,
            isAdmin: admin,
            approvalSource,
          }),
        })
      } catch (error) {
        console.error("Failed to send signup notification:", error)
      }
      
      // Send welcome email to auto-approved users
      if (approved) {
        try {
          await fetch("/api/send-welcome-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: normalizedEmail,
              userName: fullName,
            }),
          })
        } catch (error) {
          console.error("Failed to send welcome email:", error)
        }
      }
      
      return { isApproved: approved, isAdmin: admin }
    }
    return { isApproved: false, isAdmin: false }
  }

  const signOut = async () => {
    await firebaseSignOut(auth)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isApproved,
        isAdmin,
        isSuperAdmin,
        allowedAdminPages,
        checkingApproval,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
