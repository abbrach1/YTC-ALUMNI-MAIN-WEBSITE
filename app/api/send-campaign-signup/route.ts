import { NextResponse } from "next/server"
import { getResend, ADMIN_EMAIL, FROM_EMAIL, REPLY_TO_EMAIL } from "@/lib/resend"
import { CampaignSignupEmail } from "@/emails/campaign-signup"

export async function POST(request: Request) {
  try {
    const { fullName, email, phone, pageTitle, goalAmount, message, campaignName, submittedBy } =
      await request.json()

    const { data, error } = await getResend().emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      // Reply goes straight to the alumnus when we have their email.
      replyTo: email || REPLY_TO_EMAIL,
      subject: `New Campaign Page Request${campaignName ? ` — ${campaignName}` : ""} - Yeshiva Toras Chaim Alumni Portal`,
      react: CampaignSignupEmail({
        fullName,
        email,
        phone,
        pageTitle,
        goalAmount,
        message,
        campaignName,
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
