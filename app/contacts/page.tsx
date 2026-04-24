import type { Metadata } from "next"
import ContactsContent from "./contacts-content"

export const metadata: Metadata = {
  title: "Contact Directory | Alumni & Rebbeim",
  description:
    "Connect with Yeshiva Toras Chaim Rebbeim and fellow alumni. Search our directory to find and reach out to members of our community.",
  keywords: ["Yeshiva contacts", "alumni directory", "Rebbeim contact", "Jewish networking", "Yeshiva community"],
  openGraph: {
    title: "Contact Directory | Yeshiva Toras Chaim Alumni",
    description: "Connect with Rebbeim and fellow alumni from Yeshiva Toras Chaim.",
    type: "website",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "Yeshiva Toras Chaim Contact Directory" }],
  },
  alternates: {
    canonical: "https://ytcalumni.com/contacts",
  },
}

export default function ContactsPage() {
  return <ContactsContent />
}
