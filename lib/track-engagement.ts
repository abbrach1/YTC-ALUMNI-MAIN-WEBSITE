import { addDoc, collection, doc, increment, serverTimestamp, updateDoc } from "firebase/firestore"
import type { User } from "firebase/auth"
import { db } from "./firebase"
import { getPlatform } from "./platform"

type EngagementUser = Pick<User, "uid" | "email" | "displayName"> | null | undefined

function buildEventBase(user: EngagementUser) {
  const platform = getPlatform()
  return {
    userId: user?.uid || null,
    userEmail: user?.email || null,
    userName: user?.displayName || null,
    platform,
    userAgent: typeof navigator !== "undefined" ? (navigator.userAgent || null) : null,
    timestamp: serverTimestamp(),
  }
}

/**
 * Logs a play event to the `shiurPlays` collection AND increments the shiur's playCount.
 * If user is null/anonymous, the event is still logged with an "Anonymous" label.
 */
export async function trackPlay(shiurId: string, user: EngagementUser): Promise<void> {
  if (!shiurId) return

  // Increment counter (best-effort, don't block on failure)
  updateDoc(doc(db, "shiurim", shiurId), {
    playCount: increment(1),
  }).catch((err) => {
    console.error("[v0] Error incrementing playCount:", err)
  })

  // Log who played - separate try/catch so a failure here doesn't block playback
  try {
    await addDoc(collection(db, "shiurPlays"), {
      shiurId,
      ...buildEventBase(user),
    })
  } catch (err) {
    console.error("[v0] Error logging play event:", err)
  }
}

/**
 * Logs a download event to the `shiurDownloads` collection AND increments the shiur's downloadCount.
 */
export async function trackDownload(shiurId: string, user: EngagementUser): Promise<void> {
  if (!shiurId) return

  updateDoc(doc(db, "shiurim", shiurId), {
    downloadCount: increment(1),
  }).catch((err) => {
    console.error("[v0] Error incrementing downloadCount:", err)
  })

  try {
    await addDoc(collection(db, "shiurDownloads"), {
      shiurId,
      ...buildEventBase(user),
    })
  } catch (err) {
    console.error("[v0] Error logging download event:", err)
  }
}
