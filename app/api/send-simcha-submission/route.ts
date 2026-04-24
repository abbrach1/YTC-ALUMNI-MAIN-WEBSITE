import { NextResponse } from "next/server"
import { getResend, ADMIN_EMAIL, FROM_EMAIL, REPLY_TO_EMAIL } from "@/lib/resend"
import { SimchaSubmissionEmail } from "@/emails/simcha-submission"

export async function POST(request: Request) {
  try {
    const { fullName, simchaType, date, connection, message, submittedBy } = await request.json()

    const { data, error } = await getResend().emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      replyTo: REPLY_TO_EMAIL,
      subject: "New Simcha Submission - Yeshiva Toras Chaim Alumni Portal",
      react: SimchaSubmissionEmail({
        fullName,
        simchaType,
        date,
        connection,
        message,
        submittedBy,
      }),
    })

    if (error) {
      return NextResponse.json({ error }, { status: 400 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
  }
}
