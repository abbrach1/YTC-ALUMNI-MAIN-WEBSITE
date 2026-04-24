import { NextResponse } from "next/server"
import { getResend, ADMIN_EMAIL, FROM_EMAIL, REPLY_TO_EMAIL } from "@/lib/resend"
import { NewSignupEmail } from "@/emails/new-signup"

export async function POST(request: Request) {
  try {
    const { userEmail, isApproved, isAdmin, approvalSource } = await request.json()

    const status = isAdmin ? "Admin" : isApproved ? "Auto-Approved" : "Pending"

    const { data, error } = await getResend().emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      replyTo: REPLY_TO_EMAIL,
      subject: `New Signup (${status}) - ${userEmail}`,
      react: NewSignupEmail({ userEmail, isApproved, isAdmin, approvalSource }),
    })

    if (error) {
      console.error("Resend error:", error)
      return NextResponse.json({ error: error.message || error }, { status: 400 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("Failed to send signup notification:", errorMessage, error)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
