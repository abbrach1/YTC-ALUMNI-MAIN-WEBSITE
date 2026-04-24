import { NextResponse } from "next/server"
import { getResend, FROM_EMAIL, REPLY_TO_EMAIL } from "@/lib/resend"
import { WelcomeEmail } from "@/emails/welcome"

export async function POST(request: Request) {
  try {
    const { email, userName } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const { data, error } = await getResend().emails.send({
      from: FROM_EMAIL,
      to: email,
      replyTo: REPLY_TO_EMAIL,
      subject: "Welcome to the YTC Alumni Portal!",
      react: WelcomeEmail({ userName: userName || "Alumni" }),
    })

    if (error) {
      console.error("[v0] Resend error:", JSON.stringify(error, null, 2))
      return NextResponse.json({ error: error.message || error, details: error }, { status: 400 })
    }

    console.log("[v0] Welcome email sent successfully to:", email)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("[v0] Error sending welcome email:", error)
    return NextResponse.json({ error: "Failed to send welcome email" }, { status: 500 })
  }
}
