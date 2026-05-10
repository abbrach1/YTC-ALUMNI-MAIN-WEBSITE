import { NextResponse } from "next/server"
import { getResend, FROM_EMAIL, REPLY_TO_EMAIL } from "@/lib/resend"
import { collection, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { getAdminMessaging } from "@/lib/firebase-admin"
import { NewShiurNotificationEmail } from "@/emails/new-shiur-notification"
import { rebbeTopic, tagTopic } from "@/lib/fcm-topics"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://alumni.ytchaim.com"

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

    // Build the unique sets of rebbeim AND tags to push to, gated on whether
    // any subscriber matched. iOS / Android devices subscribe to both
    // rebbe_<sanitized> and tag_<sanitized> FCM topics based on the user's
    // picks in subscriptions/{uid}; this server-side fan-out delivers the
    // push for every topic that has at least one matching subscriber.
    //
    // Dedupe caveat: a user subscribed to BOTH the shiur's rebbe AND one of
    // its tags will receive two pushes (one per topic). Acceptable for v1;
    // harden later with FCM condition expressions if needed.
    const uniqueRebbeim = new Set<string>()
    const uniqueTags = new Set<string>()
    for (const m of matched) {
      if (m.matchedRebbe) uniqueRebbeim.add(rebbe)
      for (const t of m.matchedTags) uniqueTags.add(t)
    }

    if (matched.length === 0 && uniqueRebbeim.size === 0 && uniqueTags.size === 0) {
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
    type PushTarget =
      | { kind: "rebbe"; name: string; topic: string }
      | { kind: "tag"; name: string; topic: string }

    const messaging = getAdminMessaging()
    const targetsToPush: PushTarget[] = [
      ...Array.from(uniqueRebbeim).map<PushTarget>((name) => ({
        kind: "rebbe",
        name,
        topic: rebbeTopic(name),
      })),
      ...Array.from(uniqueTags).map<PushTarget>((name) => ({
        kind: "tag",
        name,
        topic: tagTopic(name),
      })),
    ]
    const pushNotificationTitle = "New shiur uploaded"
    const pushTimestamp = new Date().toISOString()

    const pushPromise: Promise<
      Array<PromiseSettledResult<{ topic: string; kind: PushTarget["kind"]; messageId: string }>>
    > = messaging
      ? Promise.allSettled(
          targetsToPush.map(async (t) => {
            // Body: "<shiur title> — <rebbe>" for rebbe pushes, "<shiur
            // title> — #<tag>" for tag pushes, so the user can tell at a
            // glance why they got the push.
            const bodySuffix = t.kind === "rebbe" ? t.name : `#${t.name}`
            const body = `${title} — ${bodySuffix}`
            const messageId = await messaging.send({
              notification: { title: pushNotificationTitle, body },
              data: {
                type: "new_shiur",
                shiurId: shiurId ?? "",
                rebbe,
                matchKind: t.kind,
                matchName: t.name,
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
              topic: t.topic,
            })
            return { topic: t.topic, kind: t.kind, messageId }
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
    const pushErrors: Array<{ kind: PushTarget["kind"]; name: string; error: string }> = []
    pushResults.forEach((res, i) => {
      if (res.status === "fulfilled") {
        pushTopics.push(res.value.topic)
      } else {
        pushErrors.push({
          kind: targetsToPush[i].kind,
          name: targetsToPush[i].name,
          error: res.reason?.message || String(res.reason),
        })
      }
    })

    if (!messaging && targetsToPush.length > 0) {
      console.warn(
        "[notify-new-shiur] FCM: skipped — Firebase Admin not configured (FIREBASE_SERVICE_ACCOUNT_KEY missing)",
      )
    }

    if (pushErrors.length > 0) {
      for (const err of pushErrors) {
        console.error(
          `[notify-new-shiur] FCM: failed to push to ${err.kind}="${err.name}": ${err.error}`,
        )
      }
    }

    console.log(
      `[notify-new-shiur] FCM: pushed to ${pushTopics.length} topic(s) — ${uniqueRebbeim.size} rebbe + ${uniqueTags.size} tag — ${pushTopics.join(", ")}`,
    )

    return NextResponse.json({
      success: true,
      sent,
      failed,
      matched: matched.length,
      pushSent: pushTopics.length,
      pushTopics,
      pushBreakdown: {
        rebbeim: uniqueRebbeim.size,
        tags: uniqueTags.size,
      },
    })
  } catch (error: any) {
    console.error("[notify-new-shiur] Error:", error)
    return NextResponse.json({ error: error.message || "Failed to send notifications" }, { status: 500 })
  }
}
