import type { Metadata } from "next"
import ShiurimContent from "./shiurim-content"

export const metadata: Metadata = {
  title: "Shiurim Archive",
  description:
    "Access recordings and materials from Torah shiurim by Yeshiva Toras Chaim Rebbeim. Browse by topic, rebbe, or search our comprehensive archive of Torah learning.",
  keywords: ["Torah shiurim", "Yeshiva classes", "Torah learning", "Rebbeim shiurim", "Jewish education"],
  openGraph: {
    title: "Shiurim Archive | Yeshiva Toras Chaim Alumni",
    description: "Access recordings and materials from Torah shiurim by our Rebbeim.",
    type: "website",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "Yeshiva Toras Chaim Shiurim Archive" }],
  },
  alternates: {
    canonical: "https://ytcalumni.com/shiurim",
  },
}

export default function ShiurimPage() {
  return <ShiurimContent />
}
