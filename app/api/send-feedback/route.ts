import { NextResponse } from "next/server"
import { getResend, ADMIN_EMAIL, FROM_EMAIL } from "@/lib/resend"
import { FeedbackEmail } from "@/emails/feedback"

// Generic user-feedback endpoint, called by the iOS app's in-app feedback
// form and (optionally) any future website feedback widget. Sends to
// ADMIN_EMAIL with replyTo set to the submitter so admins can reply
// directly from their inbox.
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const category = String(body.category ?? "General").slice(0, 80)
    const subject = String(body.subject ?? "").trim().slice(0, 200)
    const message = String(body.message ?? "").trim().slice(0, 5000)
    const submittedBy = String(body.submittedBy ?? "").trim().slice(0, 200)
    const source = String(body.source ?? "unknown").slice(0, 40)
    const appVersion = body.appVersion ? String(body.appVersion).slice(0, 40) : undefined

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    const emailSubject = `Feedback (${category}): ${subject || "(no subject)"}`

    const { data, error } = await getResend().emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      // Reply goes back to the user who sent the feedback, not the shared
      // admin inbox — admins can hit Reply and address the user directly.
      replyTo: submittedBy || ADMIN_EMAIL,
      subject: emailSubject,
      react: FeedbackEmail({
        category,
        subject,
        message,
        submittedBy: submittedBy || "(not provided)",
        source,
        appVersion,
      }),
    })

    if (error) {
      return NextResponse.json({ error }, { status: 400 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ error: "Failed to send feedback" }, { status: 500 })
  }
}
