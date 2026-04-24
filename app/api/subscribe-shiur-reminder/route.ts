import { NextResponse } from "next/server"
import { getResend, ADMIN_EMAIL, FROM_EMAIL } from "@/lib/resend"

export async function POST(request: Request) {
  try {
    const { email, shiurTitle, rebbe, date, time } = await request.json()

    // Send confirmation to subscriber
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Shiur Reminder Signup: ${shiurTitle}`,
      html: `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #0C1A35; font-size: 28px;">You're Signed Up!</h1>
            <div style="width: 60px; height: 3px; background-color: #C9A44E; margin: 0 auto;"></div>
          </div>
          
          <p style="color: #0C1A35; line-height: 1.6;">
            Thank you for signing up for shiur reminders. We'll send you an email reminder before the upcoming shiur.
          </p>
          
          <div style="background-color: #F8F5EF; border-radius: 8px; padding: 24px; border: 1px solid #C9A44E; margin: 24px 0;">
            <h2 style="color: #0C1A35; font-size: 20px; margin-bottom: 8px;">${shiurTitle}</h2>
            <p style="color: #0C1A35; opacity: 0.7;">By ${rebbe}</p>
            <p style="color: #0C1A35; margin-top: 12px;"><strong>Date:</strong> ${date}</p>
            <p style="color: #0C1A35;"><strong>Time:</strong> ${time}</p>
          </div>
          
          <div style="text-align: center; color: #0C1A35; opacity: 0.6; font-size: 14px; margin-top: 30px;">
            <p>Yeshiva Toras Chaim Alumni Network</p>
          </div>
        </div>
      `,
    })

    // Notify admin of new signup
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `New Shiur Reminder Signup: ${email}`,
      html: `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #0C1A35;">New Shiur Reminder Signup</h1>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Shiur:</strong> ${shiurTitle}</p>
          <p><strong>Date:</strong> ${date} at ${time}</p>
        </div>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[v0] Error subscribing to shiur reminder:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
