import type { Metadata } from "next"
import SupportContent from "./support-content"

export const metadata: Metadata = {
  title: "Support the Yeshiva | Donate & Give Back",
  description:
    "Support Yeshiva Toras Chaim and help sustain Torah learning for future generations. Donate to support student scholarships, facilities, and Torah programs.",
  keywords: ["donate to Yeshiva", "support Torah learning", "Jewish charity", "Yeshiva scholarships", "Torah education support"],
  openGraph: {
    title: "Support the Yeshiva | Yeshiva Toras Chaim Alumni",
    description: "Help sustain Torah learning for future generations at Yeshiva Toras Chaim.",
    type: "website",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "Support Yeshiva Toras Chaim" }],
  },
  alternates: {
    canonical: "https://ytcalumni.com/support",
  },
}

export default function SupportPage() {
  return <SupportContent />
}
