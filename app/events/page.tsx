import type { Metadata } from "next"
import EventsContent from "./events-content"

export const metadata: Metadata = {
  title: "Events & Simchos | Community Celebrations",
  description:
    "View upcoming simchos and events from the Yeshiva Toras Chaim community. Celebrate weddings, bar mitzvahs, and special occasions with fellow alumni.",
  keywords: ["Jewish simchos", "Yeshiva events", "alumni celebrations", "weddings", "bar mitzvahs", "Jewish community events"],
  openGraph: {
    title: "Events & Simchos | Yeshiva Toras Chaim Alumni",
    description: "Celebrate simchos and special occasions with the Yeshiva community.",
    type: "website",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "Yeshiva Toras Chaim Events" }],
  },
  alternates: {
    canonical: "https://alumni.ytchaim.com/events",
  },
}

export default function EventsPage() {
  return <EventsContent />
}
