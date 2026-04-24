import { NextResponse } from "next/server"
import { getResend, FROM_EMAIL, REPLY_TO_EMAIL } from "@/lib/resend"
import { collection, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"

export async function POST(request: Request) {
  try {
    const {
      subject,
      greeting,
      bodyHtml,
      shiurLinks,
      ctaText,
      ctaUrl,
      closing,
      audience,
      testEmail,
    } = await request.json()

    if (!subject || !bodyHtml) {
      return NextResponse.json({ error: "Subject and body are required" }, { status: 400 })
    }

    // Collect recipient emails based on audience selection
    const emails: Set<string> = new Set()

    if (audience === "test" && testEmail) {
      // Send test to a single email
      emails.add(testEmail.toLowerCase().trim())
    } else if (audience === "subscribers") {
      // Get shiur reminder subscribers
      const subscribersSnapshot = await getDocs(collection(db, "shiurSubscribers"))
      subscribersSnapshot.forEach((doc) => {
        const data = doc.data()
        if (data.email) {
          emails.add(data.email.toLowerCase().trim())
        }
      })
    } else if (audience === "approved_contacts") {
      // Get approved alumni contact submissions
      const contactsSnapshot = await getDocs(collection(db, "alumniContactSubmissions"))
      contactsSnapshot.forEach((doc) => {
        const data = doc.data()
        if (data.email && data.status === "approved") {
          emails.add(data.email.toLowerCase().trim())
        }
      })
    } else if (audience === "all_except_contacts") {
      // Get auto-approved emails minus anyone who submitted contact info
      const [approvedSnapshot, contactsSnapshot] = await Promise.all([
        getDocs(collection(db, "approvedEmails")),
        getDocs(collection(db, "alumniContactSubmissions")),
      ])
      const contactEmails = new Set<string>()
      contactsSnapshot.forEach((docSnap) => {
        const data = docSnap.data()
        if (data.email) contactEmails.add(data.email.toLowerCase().trim())
      })
      approvedSnapshot.forEach((docSnap) => {
        const data = docSnap.data()
        const email = (data.email || docSnap.id).toLowerCase().trim()
        if (email && !contactEmails.has(email)) {
          emails.add(email)
        }
      })
    } else if (audience === "all") {
      // Get all auto-approved alumni emails from the approvedEmails collection
      const approvedSnapshot = await getDocs(collection(db, "approvedEmails"))
      approvedSnapshot.forEach((docSnap) => {
        // doc.id is the email, but also check the email field
        const data = docSnap.data()
        const email = data.email || docSnap.id
        if (email) {
          emails.add(email.toLowerCase().trim())
        }
      })
    }

    const emailList = Array.from(emails)

    if (emailList.length === 0) {
      return NextResponse.json({ error: "No recipients found for selected audience" }, { status: 404 })
    }

    // Build shiur links HTML
    const shiurLinksHtml =
      shiurLinks && shiurLinks.length > 0
        ? `<div style="margin: 28px 0;">
            <h3 style="color: #0C1A35; font-family: Georgia, serif; font-size: 18px; margin-bottom: 12px; border-bottom: 2px solid #C9A44E; padding-bottom: 8px;">
              ${shiurLinks.length === 1 ? "New Shiur" : "New Shiurim"}
            </h3>
            ${shiurLinks
              .map(
                (s: { title: string; rebbe: string; url: string }) => `
              <div style="background-color: #F8F5EF; border-radius: 6px; padding: 16px; margin-bottom: 10px; border-left: 3px solid #C9A44E;">
                <a href="${s.url}" style="color: #0C1A35; font-weight: bold; font-size: 16px; text-decoration: none;">${s.title}</a>
                <p style="color: #0C1A35; opacity: 0.6; margin: 4px 0 8px 0; font-size: 14px;">By ${s.rebbe}</p>
                <a href="${s.url}" style="display: inline-block; background-color: #0C1A35; color: #F8F5EF; padding: 8px 16px; border-radius: 4px; text-decoration: none; font-size: 13px; font-weight: bold;">Listen Now</a>
              </div>
            `,
              )
              .join("")}
          </div>`
        : ""

    // Build CTA HTML
    const ctaHtml =
      ctaText && ctaUrl
        ? `<div style="margin: 28px 0; text-align: center;">
            <a href="${ctaUrl}" style="display: inline-block; background-color: #C9A44E; color: #0C1A35; padding: 14px 32px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">${ctaText}</a>
          </div>`
        : ""

    // Build full email HTML
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0C1A35; margin: 0; padding: 0; background-color: #f5f5f0;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e5e0d5;">
            <div style="background-color: #0C1A35; padding: 28px 32px; border-bottom: 3px solid #C9A44E;">
              <h1 style="color: #C9A44E; font-family: Georgia, serif; margin: 0; font-size: 22px;">Yeshiva Toras Chaim</h1>
              <p style="color: #F8F5EF; margin: 4px 0 0 0; font-size: 14px; opacity: 0.8;">Alumni Portal Update</p>
            </div>
            <div style="padding: 32px;">
              <h2 style="color: #0C1A35; font-family: Georgia, serif; font-size: 24px; margin-top: 0; margin-bottom: 20px;">${subject}</h2>
              <p style="font-size: 16px; margin-bottom: 16px;">${greeting || "Dear Alumni"},</p>
              <div style="font-size: 16px; line-height: 1.7;">${bodyHtml}</div>
              ${shiurLinksHtml}
              ${ctaHtml}
              <p style="font-size: 16px; margin-top: 28px; white-space: pre-line;">${closing || "Hazlacha,\nThe YTC Alumni Team"}</p>
            </div>
            <div style="background-color: #f9f7f3; padding: 20px 32px; border-top: 1px solid #e5e0d5; font-size: 12px; color: #666;">
              <p style="margin: 0 0 4px 0;">Yeshiva Toras Chaim Alumni Portal</p>
              <p style="margin: 0 0 4px 0;"><a href="https://alumni.ytchaim.com" style="color: #C9A44E;">alumni.ytchaim.com</a></p>
              <p style="margin: 8px 0 0 0; font-size: 11px; color: #999;">You are receiving this email as a member of the YTC Alumni community.</p>
            </div>
          </div>
        </div>
      </div>
    `

    const resend = getResend()
    const batchSize = 49 // Resend BCC limit
    let successCount = 0
    let failCount = 0

    for (let i = 0; i < emailList.length; i += batchSize) {
      const batch = emailList.slice(i, i + batchSize)
      try {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: FROM_EMAIL, // Send to self
          bcc: batch,
          replyTo: REPLY_TO_EMAIL,
          subject,
          html,
        })
        successCount += batch.length
      } catch (err) {
        console.error(`Batch ${Math.floor(i / batchSize) + 1} failed:`, err)
        failCount += batch.length
      }
    }

    return NextResponse.json({
      success: true,
      totalRecipients: emailList.length,
      sent: successCount,
      failed: failCount,
    })
  } catch (error: any) {
    console.error("Failed to send alumni update:", error)
    return NextResponse.json({ error: error.message || "Failed to send" }, { status: 500 })
  }
}
