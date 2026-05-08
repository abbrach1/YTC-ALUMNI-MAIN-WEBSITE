import { NextResponse } from "next/server"
import { getResend, FROM_EMAIL, REPLY_TO_EMAIL } from "@/lib/resend"
import { collection, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { NewShiurNotificationEmail } from "@/emails/new-shiur-notification"

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

    if (matched.length === 0) {
      return NextResponse.json({ success: true, sent: 0, totalSubscribers: subsSnapshot.size })
    }

    const shiurUrl = shiurId ? `${SITE_URL}/shiurim?play=${encodeURIComponent(shiurId)}` : `${SITE_URL}/shiurim`
    const manageSubscriptionsUrl = `${SITE_URL}/subscriptions`

    const resend = getResend()
    const results = await Promise.allSettled(
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

    const sent = results.filter((r) => r.status === "fulfilled").length
    const failed = results.length - sent

    if (failed > 0) {
      console.error(
        "[notify-new-shiur] Some emails failed:",
        results.filter((r) => r.status === "rejected").map((r: any) => r.reason),
      )
    }

    return NextResponse.json({ success: true, sent, failed, matched: matched.length })
  } catch (error: any) {
    console.error("[notify-new-shiur] Error:", error)
    return NextResponse.json({ error: error.message || "Failed to send notifications" }, { status: 500 })
  }
}
