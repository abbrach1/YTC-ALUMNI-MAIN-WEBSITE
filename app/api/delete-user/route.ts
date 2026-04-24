import { NextResponse } from "next/server"
import { initializeApp, getApps, cert } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"

// Initialize Firebase Admin if not already initialized
function getFirebaseAdmin() {
  if (getApps().length === 0) {
    // Check for service account credentials
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    
    if (serviceAccount) {
      try {
        const parsedServiceAccount = JSON.parse(serviceAccount)
        initializeApp({
          credential: cert(parsedServiceAccount),
        })
      } catch (error) {
        console.error("Failed to parse Firebase service account:", error)
        return null
      }
    } else {
      console.log("FIREBASE_SERVICE_ACCOUNT_KEY not configured")
      return null
    }
  }
  return getAuth()
}

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const auth = getFirebaseAdmin()
    
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
