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
  checkingApproval: boolean
  signInWithGoogle: () => Promise<{ isApproved: boolean; isAdmin: boolean }>
  signInWithEmail: (email: string, password: string) => Promise<{ isApproved: boolean; isAdmin: boolean }>
  signUpWithEmail: (email: string, password: string, profile: UserProfile) => Promise<{ isApproved: boolean; isAdmin: boolean }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

async function checkUserApproval(email: string): Promise<{ approved: boolean; admin: boolean; approvalSource?: string }> {
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

  // Check admin status
  let admin = false
  const adminRef = doc(db, "admins", normalizedEmail)
  const adminSnap = await getDoc(adminRef)

  if (adminSnap.exists()) {
    admin = true
  } else {
    const adminQuery = query(collection(db, "admins"), where("email", "==", normalizedEmail))
    const adminQuerySnap = await getDocs(adminQuery)
    if (!adminQuerySnap.empty) {
      admin = true
    }
  }

  return { approved, admin, approvalSource }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isApproved, setIsApproved] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingApproval, setCheckingApproval] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user)
      setCheckingApproval(true)

      if (user && user.email) {
        const { approved, admin } = await checkUserApproval(user.email)
        setIsApproved(approved)
        setIsAdmin(admin)
      } else {
        setIsApproved(false)
        setIsAdmin(false)
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
      const { approved, admin } = await checkUserApproval(result.user.email)
      setIsApproved(approved)
      setIsAdmin(admin)
      return { isApproved: approved, isAdmin: admin }
    }
    return { isApproved: false, isAdmin: false }
  }

  const signInWithEmail = async (email: string, password: string) => {
    const result = await signInWithEmailAndPassword(auth, email, password)
    if (result.user.email) {
      const { approved, admin } = await checkUserApproval(result.user.email)
      setIsApproved(approved)
      setIsAdmin(admin)
      return { isApproved: approved, isAdmin: admin }
    }
    return { isApproved: false, isAdmin: false }
  }

  const signUpWithEmail = async (email: string, password: string, profile: UserProfile) => {
    const result = await createUserWithEmailAndPassword(auth, email, password)
    if (result.user.email) {
      const normalizedEmail = result.user.email.toLowerCase()
      const { approved, admin, approvalSource } = await checkUserApproval(normalizedEmail)
      setIsApproved(approved)
      setIsAdmin(admin)
      
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
