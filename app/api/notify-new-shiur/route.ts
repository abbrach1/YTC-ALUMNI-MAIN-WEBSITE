import { NextResponse } from "next/server"
import { getResend, FROM_EMAIL, REPLY_TO_EMAIL } from "@/lib/resend"
import { collection, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { getAdminMessaging } from "@/lib/firebase-admin"
import { NewShiurNotificationEmail } from "@/emails/new-shiur-notification"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://alumni.ytchaim.com"

// Mirrors NotificationManager.sanitizeTopicName in the iOS app
// (repo abbrach1/ytcalumni1): lowercase, then replace every non-alphanumeric
// Unicode scalar with `_`. Multiple non-alnum chars in a row each become
// their own underscore (no collapsing).
function sanitizeTopicName(rebbe: string): string {
  return rebbe.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "_")
}

interface NotifyShiurBody {
  shiurId?: string
  title: string
  rebbe: string
  date: string
  tags?: string[]
  description?: string
  audioUrl?: string
  pdfUrl?: string
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as NotifyShiurBody

    const { title, rebbe, date, tags = [], description, audioUrl, pdfUrl, shiurId } = body

    if (!title || !rebbe) {
      return NextResponse.json({ error: "title and rebbe are required" }, { status: 400 })
    }

    // Fetch all subscriptions and filter in memory. Subscriber counts are modest,
    // and this matches the pattern used by other email routes in this project
    // (e.g. send-shiur-reminders) which avoid the Firebase Admin SDK.
    const subsSnapshot = await getDocs(collection(db, "subscriptions"))

    const tagSet = new Set(tags)
    // Keyed by lowercased email so a user with multiple subscription docs
    // (e.g. separate Google + email/password accounts) still gets one email.
    const matchedByEmail = new Map<
      string,
      {
        email: string
        matchedRebbe: boolean
        matchedTags: Set<string>
      }
    >()

    subsSnapshot.forEach((docSnap) => {
      const data = docSnap.data() as {
        email?: string
        rebbeim?: string[]
        tags?: string[]
      }
      if (!data.email) return

      const subscribedRebbeim = Array.isArray(data.rebbeim) ? data.rebbeim : []
      const subscribedTags = Array.isArray(data.tags) ? data.tags : []

      const matchedRebbe = subscribedRebbeim.includes(rebbe)
      const matchedTags = subscribedTags.filter((t) => tagSet.has(t))

      if (!matchedRebbe && matchedTags.length === 0) return

      const key = data.email.toLowerCase()
      const existing = matchedByEmail.get(key)
      if (existing) {
        existing.matchedRebbe = existing.matchedRebbe || matchedRebbe
        for (const t of matchedTags) existing.matchedTags.add(t)
      } else {
        matchedByEmail.set(key, {
          email: data.email,
          matchedRebbe,
          matchedTags: new Set(matchedTags),
        })
      }
    })

    const matched = Array.from(matchedByEmail.values()).map((m) => ({
      email: m.email,
      matchedRebbe: m.matchedRebbe,
      matchedTags: Array.from(m.matchedTags),
    }))

    console.log(
      `[notify-new-shiur] ${matched.length} of ${subsSnapshot.size} subscribers match (rebbe="${rebbe}", tags=[${tags.join(",")}])`,
    )

    // Build the unique set of rebbeim to push to from the matched subscribers'
    // rebbeim arrays. Only includes the shiur's rebbe if at least one
    // subscriber selected it — duplicates collapse via Set.
    // Note: tag-topic FCM fan-out is intentionally NOT implemented yet —
    // iOS does not subscribe to tag topics, only rebbe_<sanitized> topics.
    const uniqueRebbeim = new Set<string>()
    for (const m of matched) {
      if (m.matchedRebbe) uniqueRebbeim.add(rebbe)
    }

    if (matched.length === 0 && uniqueRebbeim.size === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        totalSubscribers: subsSnapshot.size,
        pushSent: 0,
        pushTopics: [],
      })
    }

    const shiurUrl = shiurId ? `${SITE_URL}/shiurim?play=${encodeURIComponent(shiurId)}` : `${SITE_URL}/shiurim`
    const manageSubscriptionsUrl = `${SITE_URL}/subscriptions`

    const resend = getResend()
    const emailPromise = Promise.allSettled(
      matched.map((sub) =>
        resend.emails.send({
          from: FROM_EMAIL,
          to: sub.email,
          replyTo: REPLY_TO_EMAIL,
          subject: `New shiur from ${rebbe}: ${title}`,
          react: NewShiurNotificationEmail({
            shiurTitle: title,
            rebbe,
            date,
            description,
            tags,
            matchedRebbe: sub.matchedRebbe,
            matchedTags: sub.matchedTags,
            shiurUrl,
            audioUrl,
            pdfUrl,
            manageSubscriptionsUrl,
          }),
        }),
      ),
    )

    // FCM fan-out — runs in parallel with email but its failures must not
    // block or fail the email send. Per-topic errors are logged below.
    const messaging = getAdminMessaging()
    const rebbeimToPush = Array.from(uniqueRebbeim)
    const pushNotificationTitle = "New shiur uploaded"
    const pushTimestamp = new Date().toISOString()

    const pushPromise: Promise<
      Array<PromiseSettledResult<{ topic: string; messageId: string }>>
    > = messaging
      ? Promise.allSettled(
          rebbeimToPush.map(async (r) => {
            const topic = `rebbe_${sanitizeTopicName(r)}`
            const body = `${title} — ${r}`
            const messageId = await messaging.send({
              notification: { title: pushNotificationTitle, body },
              data: {
                type: "new_shiur",
                shiurId: shiurId ?? "",
                rebbe: r,
                timestamp: pushTimestamp,
              },
              apns: {
                payload: {
                  aps: {
                    badge: 1,
                    sound: "default",
                    alert: { title: pushNotificationTitle, body },
                  },
                },
              },
              topic,
            })
            return { topic, messageId }
          }),
        )
      : Promise.resolve([])

    const [results, pushResults] = await Promise.all([emailPromise, pushPromise])

    const sent = results.filter((r) => r.status === "fulfilled").length
    const failed = results.length - sent

    if (failed > 0) {
      console.error(
        "[notify-new-shiur] Some emails failed:",
        results.filter((r) => r.status === "rejected").map((r: any) => r.reason),
      )
    }

    const pushTopics: string[] = []
    const pushErrors: Array<{ rebbe: string; error: string }> = []
    pushResults.forEach((res, i) => {
      if (res.status === "fulfilled") {
        pushTopics.push(res.value.topic)
      } else {
        pushErrors.push({
          rebbe: rebbeimToPush[i],
          error: res.reason?.message || String(res.reason),
        })
      }
    })

    if (!messaging && rebbeimToPush.length > 0) {
      console.warn(
        "[notify-new-shiur] FCM: skipped — Firebase Admin not configured (FIREBASE_SERVICE_ACCOUNT_KEY missing)",
      )
    }

    if (pushErrors.length > 0) {
      for (const err of pushErrors) {
        console.error(
          `[notify-new-shiur] FCM: failed to push to rebbe="${err.rebbe}": ${err.error}`,
        )
      }
    }

    console.log(
      `[notify-new-shiur] FCM: pushed to ${pushTopics.length} rebbe topic(s): ${pushTopics.join(", ")}`,
    )

    return NextResponse.json({
      success: true,
      sent,
      failed,
      matched: matched.length,
      pushSent: pushTopics.length,
      pushTopics,
    })
  } catch (error: any) {
    console.error("[notify-new-shiur] Error:", error)
    return NextResponse.json({ error: error.message || "Failed to send notifications" }, { status: 500 })
  }
}
