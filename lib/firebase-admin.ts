import { initializeApp, getApps, cert, type App } from "firebase-admin/app"
import { getAuth, type Auth } from "firebase-admin/auth"
import { getFirestore, type Firestore } from "firebase-admin/firestore"

let _app: App | null = null

/**
 * Initialize the Firebase Admin SDK once and return the app instance.
 * Returns null if FIREBASE_SERVICE_ACCOUNT_KEY is not configured - callers
 * must handle the "not configured" case themselves.
 */
export function getAdminApp(): App | null {
  if (_app) return _app

  const existing = getApps()
  if (existing.length > 0) {
    _app = existing[0]
    return _app
  }

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  if (!serviceAccount) {
    console.log("[v0] FIREBASE_SERVICE_ACCOUNT_KEY not configured")
    return null
  }

  try {
    const parsed = JSON.parse(serviceAccount)
    _app = initializeApp({ credential: cert(parsed) })
    return _app
  } catch (err) {
    console.error("[v0] Failed to parse Firebase service account:", err)
    return null
  }
}

export function getAdminAuth(): Auth | null {
  const app = getAdminApp()
  if (!app) return null
  return getAuth(app)
}

export function getAdminDb(): Firestore | null {
  const app = getAdminApp()
  if (!app) return null
  return getFirestore(app)
}

/**
 * Verifies a Firebase ID token from an `Authorization: Bearer <token>` header.
 * Returns null if no token, an invalid token, or if Admin SDK is not configured.
 * Callers MUST treat a null result as "anonymous request" rather than an error.
 */
export async function verifyAuthHeader(authHeader: string | null): Promise<{
  uid: string
  email: string | null
  name: string | null
} | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null
  const token = authHeader.slice("Bearer ".length).trim()
  if (!token) return null

  const auth = getAdminAuth()
  if (!auth) return null

  try {
    const decoded = await auth.verifyIdToken(token)
    return {
      uid: decoded.uid,
      email: decoded.email || null,
      name: (decoded.name as string) || null,
    }
  } catch (err) {
    console.error("[v0] verifyAuthHeader failed:", err)
    return null
  }
}
