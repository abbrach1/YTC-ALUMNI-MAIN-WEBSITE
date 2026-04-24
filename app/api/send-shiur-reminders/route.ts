import { NextResponse } from "next/server"
import { getResend, FROM_EMAIL, REPLY_TO_EMAIL } from "@/lib/resend"
import { collection, getDocs, doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

export async function POST(request: Request) {
  try {
    let shiur: {
      title: string
      rebbe: string
      date: string
      time?: string
      description?: string
      zoomLink?: string
    }

    let customSubject: string | undefined
    let customMessage: string | undefined
    let customButtonText: string | undefined

    const contentType = request.headers.get("content-type")
    if (contentType?.includes("application/json")) {
      const body = await request.json()

      customSubject = body.customSubject
      customMessage = body.customMessage
      customButtonText = body.customButtonText

      if (body.shiurId) {
        // Sending reminder for a specific shiur from the archive
        const shiurDoc = await getDoc(doc(db, "shiurim", body.shiurId))
        if (!shiurDoc.exists()) {
          return NextResponse.json({ error: "Shiur not found" }, { status: 404 })
        }
        const shiurData = shiurDoc.data()
        shiur = {
          title: shiurData.title || body.title,
          rebbe: shiurData.rebbe || body.rebbe,
          date: shiurData.date || body.date,
          time: shiurData.time || "",
          description: shiurData.description || "",
          zoomLink: shiurData.zoomLink || shiurData.audioUrl || "",
        }
      } else {
        const shiurDoc = await getDoc(doc(db, "settings", "upcomingShiur"))
        if (!shiurDoc.exists()) {
          return NextResponse.json({ error: "No upcoming shiur found" }, { status: 404 })
        }
        shiur = shiurDoc.data() as typeof shiur
      }
    } else {
      // Default: Get the upcoming shiur details
      const shiurDoc = await getDoc(doc(db, "settings", "upcomingShiur"))
      if (!shiurDoc.exists()) {
        return NextResponse.json({ error: "No upcoming shiur found" }, { status: 404 })
      }
      shiur = shiurDoc.data() as typeof shiur
    }

    // Get all subscribers
    const subscribersSnapshot = await getDocs(collection(db, "shiurSubscribers"))
    const subscribers: string[] = []
    subscribersSnapshot.forEach((doc) => {
      const data = doc.data()
      if (data.email) {
        subscribers.push(data.email)
      }
    })

    if (subscribers.length === 0) {
      return NextResponse.json({ message: "No subscribers to notify", sentTo: 0 })
    }

    const emailSubject = customSubject || `Reminder: ${shiur.title} - Starting Soon!`
    const emailMessageText =
      customMessage || `The shiur "${shiur.title}" by ${shiur.rebbe} is starting soon! Don't miss it.`
    const buttonText = customButtonText || (shiur.zoomLink ? "Join via Zoom" : "View Details")

    const actionButton = shiur.zoomLink
      ? `<div style="text-align: center; margin-top: 20px;">
          <a href="${shiur.zoomLink}" style="display: inline-block; background-color: #0C1A35; color: #F8F5EF; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px;">
            ${buttonText}
          </a>
        </div>`
      : ""

    // Send reminder to all subscribers
    const emailPromises = subscribers.map((email) =>
      getResend().emails.send({
        from: FROM_EMAIL,
        to: email,
        replyTo: REPLY_TO_EMAIL,
        subject: emailSubject,
        html: `
          <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #0C1A35; font-size: 28px;">Shiur Reminder</h1>
              <div style="width: 60px; height: 3px; background-color: #C9A44E; margin: 0 auto;"></div>
            </div>
            
            <div style="background-color: #F8F5EF; border-radius: 8px; padding: 24px; border: 1px solid #C9A44E; margin: 24px 0;">
              <h2 style="color: #0C1A35; font-size: 24px; margin-bottom: 8px;">${shiur.title}</h2>
              <p style="color: #0C1A35; opacity: 0.7;">By ${shiur.rebbe}</p>
              
              <p style="color: #0C1A35; font-size: 16px; line-height: 1.6; margin-top: 16px; margin-bottom: 16px;">
                ${emailMessageText}
              </p>
              
              <p style="color: #0C1A35; margin-top: 12px;"><strong>Date:</strong> ${shiur.date}</p>
              ${shiur.time ? `<p style="color: #0C1A35;"><strong>Time:</strong> ${shiur.time}</p>` : ""}
              ${actionButton}
            </div>
            
            <div style="text-align: center; color: #0C1A35; opacity: 0.6; font-size: 14px; margin-top: 30px;">
              <p>Yeshiva Toras Chaim Alumni Network</p>
              <p style="font-size: 12px; margin-top: 8px;">
                You received this email because you signed up for shiur reminders.
              </p>
            </div>
          </div>
        `,
      }),
    )

    await Promise.all(emailPromises)

    return NextResponse.json({ success: true, sentTo: subscribers.length })
  } catch (error: any) {
    console.error("[v0] Error sending shiur reminders:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
