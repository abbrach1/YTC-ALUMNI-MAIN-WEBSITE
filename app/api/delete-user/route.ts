import { NextResponse } from "next/server"
import { getAdminAuth } from "@/lib/firebase-admin"

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const auth = getAdminAuth()
    
    if (!auth) {
      // Firebase Admin not configured - return success but note it was skipped
      return NextResponse.json({ 
        success: true, 
        skipped: true, 
        message: "Firebase Admin SDK not configured. User removed from database only." 
      })
    }

    try {
      // Get the user by email
      const userRecord = await auth.getUserByEmail(email)
      
      // Delete the user from Firebase Auth
      await auth.deleteUser(userRecord.uid)
      
      return NextResponse.json({ 
        success: true, 
        message: "User deleted from Firebase Authentication" 
      })
    } catch (authError: any) {
      if (authError.code === "auth/user-not-found") {
        // User doesn't exist in Auth - that's fine, just continue
        return NextResponse.json({ 
          success: true, 
          message: "User not found in Firebase Auth (may have already been deleted)" 
        })
      }
      throw authError
    }
  } catch (error: any) {
    console.error("Error deleting user:", error)
    return NextResponse.json({ 
      error: error.message || "Failed to delete user" 
    }, { status: 500 })
  }
}
