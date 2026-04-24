import { db } from "@/lib/firebase"
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore"

/**
 * Firebase Saved Shiurim Management
 * 
 * Structure:
 * /users/{uid}/preferences/savedShiurim
 * {
 *   savedShiurIds: ["shiur_001", "shiur_042"],
 *   lastUpdated: timestamp,
 *   syncedAt: timestamp
 * }
 */

interface SavedShiurimData {
  savedShiurIds: string[]
  lastUpdated: number
  syncedAt: number
}

const SAVED_SHIURIM_KEY = "saved-shiurim-firebase"
const LOCAL_SYNC_KEY = "saved-shiurim-sync-state"

/**
 * Get saved shiurim from Firebase for a user
 * Falls back to localStorage if user is not authenticated
 */
export async function getSavedShiurimFromFirebase(uid: string): Promise<string[]> {
  try {
    const docRef = doc(db, "users", uid, "preferences", "savedShiurim")
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      const data = docSnap.data() as SavedShiurimData
      console.log("[v0] Loaded saved shiurim from Firebase:", data.savedShiurIds.length)
      return data.savedShiurIds || []
    }

    console.log("[v0] No saved shiurim found in Firebase for user:", uid)
    return []
  } catch (error) {
    console.error("[v0] Error fetching saved shiurim from Firebase:", error)
    return []
  }
}

/**
 * Add a shiur to user's saved list in Firebase
 */
export async function addSavedShiurToFirebase(uid: string, shiurId: string): Promise<boolean> {
  try {
    const docRef = doc(db, "users", uid, "preferences", "savedShiurim")
    const docSnap = await getDoc(docRef)

    const now = Date.now()

    if (docSnap.exists()) {
      // Document exists, add to array if not already there
      const data = docSnap.data() as SavedShiurimData
      if (!data.savedShiurIds.includes(shiurId)) {
        await updateDoc(docRef, {
          savedShiurIds: arrayUnion(shiurId),
          lastUpdated: now,
          syncedAt: now,
        })
      }
    } else {
      // Create new document
      await setDoc(docRef, {
        savedShiurIds: [shiurId],
        lastUpdated: now,
        syncedAt: now,
      })
    }

    console.log("[v0] Added shiur to saved in Firebase:", shiurId)
    return true
  } catch (error) {
    console.error("[v0] Error adding saved shiur to Firebase:", error)
    return false
  }
}

/**
 * Remove a shiur from user's saved list in Firebase
 */
export async function removeSavedShiurFromFirebase(uid: string, shiurId: string): Promise<boolean> {
  try {
    const docRef = doc(db, "users", uid, "preferences", "savedShiurim")
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      await updateDoc(docRef, {
        savedShiurIds: arrayRemove(shiurId),
        lastUpdated: Date.now(),
        syncedAt: Date.now(),
      })
      console.log("[v0] Removed shiur from saved in Firebase:", shiurId)
      return true
    }

    return false
  } catch (error) {
    console.error("[v0] Error removing saved shiur from Firebase:", error)
    return false
  }
}

/**
 * Hybrid approach: Use localStorage for speed, sync with Firebase
 * Returns saved shiurim from cache, syncs in background
 */
export function getSavedShiurimLocal(): string[] {
  try {
    return JSON.parse(localStorage.getItem("saved-shiurim") || "[]")
  } catch (e) {
    return []
  }
}

/**
 * Store saved shiurim in localStorage (for immediate UI update)
 */
export function saveSavedShiurimLocal(shiurIds: string[]): void {
  try {
    localStorage.setItem("saved-shiurim", JSON.stringify(shiurIds))
    localStorage.setItem(LOCAL_SYNC_KEY, JSON.stringify({
      lastSync: Date.now(),
      count: shiurIds.length,
    }))
  } catch (e) {
    console.error("[v0] Error saving to localStorage:", e)
  }
}

/**
 * Toggle saved status locally and sync to Firebase
 * Uses optimistic updates for better UX
 */
export async function toggleSavedShiurHybrid(
  shiurId: string,
  onLocalUpdate: (saved: string[]) => void,
  uid: string | null
): Promise<string[]> {
  // Step 1: Update localStorage immediately (optimistic update)
  const localSaved = getSavedShiurimLocal()
  const index = localSaved.indexOf(shiurId)
  
  if (index > -1) {
    localSaved.splice(index, 1)
  } else {
    localSaved.push(shiurId)
  }

  saveSavedShiurimLocal(localSaved)
  onLocalUpdate(localSaved)

  console.log("[v0] Updated local saved shiurim:", localSaved)

  // Step 2: Sync to Firebase if user is logged in
  if (uid) {
    try {
      const isAdding = index === -1 // If we removed it from local array, we're removing it
      
      if (isAdding) {
        await addSavedShiurToFirebase(uid, shiurId)
      } else {
        await removeSavedShiurFromFirebase(uid, shiurId)
      }
      
      console.log("[v0] Synced with Firebase successfully")
    } catch (error) {
      console.error("[v0] Error syncing with Firebase, will retry later:", error)
      // Data is still saved locally, will sync next time
    }
  } else {
    console.log("[v0] User not authenticated, saved locally only")
  }

  return localSaved
}

/**
 * Sync local saved shiurim with Firebase on app load
 * Merges local and Firebase data
 */
export async function syncSavedShiurimOnLoad(uid: string): Promise<string[]> {
  try {
    console.log("[v0] Starting sync of saved shiurim...")

    // Get both local and Firebase versions
    const localSaved = getSavedShiurimLocal()
    const firebaseSaved = await getSavedShiurimFromFirebase(uid)

    // Merge: Firebase is source of truth, add any local-only items
    const merged = Array.from(new Set([...firebaseSaved, ...localSaved]))

    // Update local if needed
    if (JSON.stringify(merged.sort()) !== JSON.stringify(localSaved.sort())) {
      saveSavedShiurimLocal(merged)
      console.log("[v0] Synced local with Firebase, merged count:", merged.length)
    }

    // Update Firebase if local had new items
    if (merged.length !== firebaseSaved.length) {
      const docRef = doc(db, "users", uid, "preferences", "savedShiurim")
      await setDoc(docRef, {
        savedShiurIds: merged,
        lastUpdated: Date.now(),
        syncedAt: Date.now(),
      }, { merge: true })
      console.log("[v0] Updated Firebase with merged data")
    }

    return merged
  } catch (error) {
    console.error("[v0] Error syncing saved shiurim:", error)
    // Return local as fallback
    return getSavedShiurimLocal()
  }
}
