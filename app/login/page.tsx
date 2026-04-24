import type { Metadata } from "next"
import LoginContent from "./login-content"

export const metadata: Metadata = {
  title: "Sign In",
  description:
    "Sign in to the Yeshiva Toras Chaim Alumni portal to access shiurim, connect with fellow alumni, and stay updated on community events.",
  robots: {
    index: false,
    follow: false,
  },
}

export default function LoginPage() {
  return <LoginContent />
}
