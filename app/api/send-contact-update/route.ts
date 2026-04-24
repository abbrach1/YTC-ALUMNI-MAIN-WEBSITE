import { NextResponse } from "next/server"
import { getResend, ADMIN_EMAIL, FROM_EMAIL, REPLY_TO_EMAIL } from "@/lib/resend"
import { ContactUpdateEmail } from "@/emails/contact-update"

export async function POST(request: Request) {
  try {
    const { fullName, email, phone, address, city, occupation, additionalInfo } = await request.json()

    const { data, error } = await getResend().emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      replyTo: REPLY_TO_EMAIL,
      subject: "Contact Information Update - Yeshiva Toras Chaim Alumni Portal",
      react: ContactUpdateEmail({
        fullName,
        email,
        phone,
        address,
        city,
        occupation,
        additionalInfo,
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
