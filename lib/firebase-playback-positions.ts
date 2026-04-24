/**
 * Firebase Playback Position Sync
 * Hybrid approach: localStorage for speed + Firebase for persistence
 */

import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

/**
 * Data structure for playback positions
 */
export interface PlaybackPositions {
  [shiurId: string]: number // shiurId: seconds
}

export interface PlaybackPositionData {
  positions: PlaybackPositions
  lastUpdated: number
  syncedAt?: number
}

const LOCAL_STORAGE_KEY = "shiur-positions"

/**
 * Get playback positions from localStorage (fast cache)
 */
export function getPlaybackPositionsLocal(): PlaybackPositions {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!stored) return {}
    return JSON.parse(stored) as PlaybackPositions
  } catch (e) {
    console.error("[v0] Error reading local playback positions:", e)
    return {}
  }
}

/**
 * Save playback positions to localStorage
 */
export function savePlaybackPositionsLocal(positions: PlaybackPositions): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(positions))
  } catch (e) {
    console.error("[v0] Error saving local playback positions:", e)
  }
}

/**
 * Get single playback position from localStorage
 */
export function getPlaybackPositionLocal(shiurId: string): number {
  const positions = getPlaybackPositionsLocal()
  return positions[shiurId] || 0
}

/**
 * Save single playback position to localStorage
 */
export function savePlaybackPositionLocal(shiurId: string, seconds: number): void {
  const positions = getPlaybackPositionsLocal()
  positions[shiurId] = seconds
  savePlaybackPositionsLocal(positions)
}

/**
 * Clear single playback position from localStorage
 */
export function clearPlaybackPositionLocal(shiurId: string): void {
  const positions = getPlaybackPositionsLocal()
  delete positions[shiurId]
  savePlaybackPositionsLocal(positions)
}

/**
 * Get playback positions from Firebase
 */
export async function getPlaybackPositionsFromFirebase(uid: string): Promise<PlaybackPositions> {
  try {
    const docRef = doc(db, "users", uid, "preferences", "playbackPositions")
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      const data = docSnap.data() as PlaybackPositionData
      console.log("[v0] Fetched playback positions from Firebase:", Object.keys(data.positions).length, "shiurim")
      return data.positions || {}
    }

    return {}
  } catch (error) {
    console.error("[v0] Error fetching playback positions from Firebase:", error)
    return {}
  }
}

/**
 * Save playback positions to Firebase
 */
export async function savePlaybackPositionsToFirebase(
  uid: string,
  positions: PlaybackPositions
): Promise<void> {
  try {
    const docRef = doc(db, "users", uid, "preferences", "playbackPositions")
    const data: PlaybackPositionData = {
      positions,
      lastUpdated: Date.now(),
      syncedAt: Date.now(),
    }

    await setDoc(docRef, data, { merge: true })
    console.log("[v0] Saved playback positions to Firebase")
  } catch (error) {
    console.error("[v0] Error saving playback positions to Firebase:", error)
    throw error
  }
}

/**
 * Save single playback position to Firebase
 */
export async function savePlaybackPositionToFirebase(
  uid: string,
  shiurId: string,
  seconds: number
): Promise<void> {
  try {
    const docRef = doc(db, "users", uid, "preferences", "playbackPositions")
    
    // Update just this one position
    await updateDoc(docRef, {
      [`positions.${shiurId}`]: seconds,
      lastUpdated: Date.now(),
    })
    
    console.log(`[v0] Saved playback position for ${shiurId}: ${seconds}s to Firebase`)
  } catch (error) {
    // If document doesn't exist, create it
    if ((error as any).code === "not-found") {
      const positions: PlaybackPositions = { [shiurId]: seconds }
      await savePlaybackPositionsToFirebase(uid, positions)
    } else {
      console.error("[v0] Error saving single playback position to Firebase:", error)
      throw error
    }
  }
}

/**
 * Remove single playback position from Firebase
 */
export async function clearPlaybackPositionFromFirebase(
  uid: string,
  shiurId: string
): Promise<void> {
  try {
    const docRef = doc(db, "users", uid, "preferences", "playbackPositions")
    
    // Remove this position by setting to null (Firestore deletes null fields)
    await updateDoc(docRef, {
      [`positions.${shiurId}`]: null,
      lastUpdated: Date.now(),
    })
    
    console.log(`[v0] Cleared playback position for ${shiurId} from Firebase`)
  } catch (error) {
    console.error("[v0] Error clearing playback position from Firebase:", error)
  }
}

/**
 * Sync playback positions on app load
 * Merges localStorage and Firebase data
 */
export async function syncPlaybackPositionsOnLoad(uid: string): Promise<PlaybackPositions> {
  try {
    // Step 1: Get localStorage positions (cache)
    const localPositions = getPlaybackPositionsLocal()
    console.log("[v0] Local playback positions:", Object.keys(localPositions).length, "shiurim")

    // Step 2: Get Firebase positions (source of truth)
    const firebasePositions = await getPlaybackPositionsFromFirebase(uid)
    console.log("[v0] Firebase playback positions:", Object.keys(firebasePositions).length, "shiurim")

    // Step 3: Merge both datasets (Firebase takes priority for conflicts)
    const merged: PlaybackPositions = { ...localPositions }
    let hasChanges = false

    // Add/update from Firebase
    for (const [shiurId, seconds] of Object.entries(firebasePositions)) {
      if (merged[shiurId] !== seconds) {
        merged[shiurId] = seconds
        hasChanges = true
      }
    }

    // Check if local has positions not in Firebase (sync them up)
    for (const [shiurId, seconds] of Object.entries(localPositions)) {
      if (!(shiurId in firebasePositions)) {
        hasChanges = true
      }
    }

    // Step 4: Save merged data to both locations
    if (hasChanges) {
      savePlaybackPositionsLocal(merged)
      await savePlaybackPositionsToFirebase(uid, merged)
      console.log("[v0] Merged and synced playback positions")
    } else {
      console.log("[v0] Playback positions already in sync")
    }

    return merged
  } catch (error) {
    console.error("[v0] Error syncing playback positions:", error)
    // Fall back to local data
    return getPlaybackPositionsLocal()
  }
}

/**
 * Save playback position with hybrid sync
 * Updates localStorage immediately, syncs to Firebase in background
 */
export async function savePlaybackPositionHybrid(
  shiurId: string,
  seconds: number,
  uid: string | null
): Promise<void> {
  // Step 1: Save to localStorage immediately (instant)
  savePlaybackPositionLocal(shiurId, seconds)

  // Step 2: Sync to Firebase in background if user is logged in
  if (uid) {
    try {
      await savePlaybackPositionToFirebase(uid, shiurId, seconds)
    } catch (error) {
      console.error("[v0] Error syncing playback position to Firebase, will retry later:", error)
      // Data is still saved locally
    }
  }
}

/**
 * Clear playback position with hybrid sync
 */
export async function clearPlaybackPositionHybrid(
  shiurId: string,
  uid: string | null
): Promise<void> {
  // Step 1: Clear from localStorage immediately
  clearPlaybackPositionLocal(shiurId)

  // Step 2: Clear from Firebase in background if user is logged in
  if (uid) {
    try {
      await clearPlaybackPositionFromFirebase(uid, shiurId)
    } catch (error) {
      console.error("[v0] Error clearing playback position from Firebase:", error)
      // Local data is still cleared
    }
  }
}

/**
 * Get playback position with fallback
 * Tries localStorage first, then Firebase if needed
 */
export async function getPlaybackPositionHybrid(
  shiurId: string,
  uid: string | null
): Promise<number> {
  // Try localStorage first (fast)
  const localPosition = getPlaybackPositionLocal(shiurId)
  
  if (localPosition > 0) {
    return localPosition
  }

  // If not found locally and user is logged in, try Firebase
  if (uid) {
    try {
      const firebasePositions = await getPlaybackPositionsFromFirebase(uid)
      const firebasePosition = firebasePositions[shiurId] || 0
      
      if (firebasePosition > 0) {
        // Cache it locally for next time
        savePlaybackPositionLocal(shiurId, firebasePosition)
        return firebasePosition
      }
    } catch (error) {
      console.error("[v0] Error fetching playback position from Firebase:", error)
    }
  }

  return 0
}
