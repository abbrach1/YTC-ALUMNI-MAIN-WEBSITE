import { Resend } from "resend"

const RESEND_API_KEY = process.env.RESEND_API_KEY || "re_JwFzSVhC_63Ur8LJuuGQAkiipU22c61vx"

export function getResend(): Resend {
  return new Resend(RESEND_API_KEY)
}

export const ADMIN_EMAIL = "alumni@ytchaim.com"
export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "YTC Alumni <noreply@ytchaim-alumni.abstuff.org>"
export const REPLY_TO_EMAIL = "alumni@ytchaim.com"
