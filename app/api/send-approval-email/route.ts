import { NextResponse } from "next/server"
import { getResend, FROM_EMAIL, REPLY_TO_EMAIL } from "@/lib/resend"
import { AccessApprovedEmail } from "@/emails/access-approved"

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
      subject: "Your Alumni Portal Access Has Been Approved!",
      react: AccessApprovedEmail({ userName: userName || "Alumni" }),
    })

    if (error) {
      console.error("Resend API error:", error)
      return NextResponse.json({ error: error.message || "Resend error", details: error }, { status: 400 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error("Failed to send approval email:", error)
    return NextResponse.json({ 
      error: "Failed to send email", 
      details: error?.message || String(error) 
    }, { status: 500 })
  }
}
