import type React from "react"
import type { Metadata, Viewport } from "next"
import { Merriweather, Inter, Heebo, Frank_Ruhl_Libre } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { AuthProvider } from "@/lib/auth-context"
import { Toaster } from "@/components/ui/toaster"
import { Footer } from "@/components/footer"
import { ScrollToTop } from "@/components/scroll-to-top"
import { AnalyticsTracker } from "@/components/analytics-tracker"
import { FirstLoginPopup } from "@/components/first-login-popup"
import { RebbeimPortalAnnouncement } from "@/components/rebbeim-portal-announcement"
import "./globals.css"

const merriweather = Merriweather({
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
  variable: "--font-serif",
})

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
})

const heebo = Heebo({
  subsets: ["latin", "hebrew"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-hebrew",
})

const frankRuhlLibre = Frank_Ruhl_Libre({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-frank-ruhl-libre",
})

export const metadata: Metadata = {
  metadataBase: new URL("https://ytcalumni.com"),
  title: {
    default: "Yeshiva Toras Chaim Alumni Network | Connecting Talmidim & Rebbeim",
    template: "%s | Yeshiva Toras Chaim Alumni",
  },
  description:
    "The official alumni network for Yeshiva Toras Chaim. Access shiurim, connect with Rebbeim and fellow alumni, stay updated on simchos and events, and support Torah learning.",
  keywords: [
    "Yeshiva Toras Chaim",
    "YTC Alumni",
    "Torah shiurim",
    "Jewish education",
    "Yeshiva alumni network",
    "Torah learning",
    "Rebbeim",
    "Talmidim",
    "Jewish community",
    "Simchos",
    "Torah classes",
    "Kollel",
  ],
  authors: [{ name: "AB Brachfeld" }],
  creator: "AB Brachfeld",
  publisher: "Yeshiva Toras Chaim",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://ytcalumni.com",
    siteName: "Yeshiva Toras Chaim Alumni",
    title: "Yeshiva Toras Chaim Alumni Network",
    description:
      "Connecting Talmidim, Rebbeim, and Friends of the Yeshiva. Access shiurim, events, and stay connected with the YTC community.",
    images: [
      {
        url: "/yeshiva-logo.png",
        width: 400,
        height: 400,
        alt: "Yeshiva Toras Chaim Logo",
      },
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Yeshiva Toras Chaim Alumni Network",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Yeshiva Toras Chaim Alumni Network",
    description:
      "Connecting Talmidim, Rebbeim, and Friends of the Yeshiva. Access shiurim, events, and stay connected.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: [{ url: "/favicon.ico" }],
  },
  manifest: "/manifest.json",
  alternates: {
    canonical: "https://ytcalumni.com",
  },
  generator: "v0.app",
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0C1A35" },
    { media: "(prefers-color-scheme: dark)", color: "#0C1A35" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "EducationalOrganization",
              name: "Yeshiva Toras Chaim",
              alternateName: "YTC",
              description:
                "Yeshiva Toras Chaim Alumni Network - Connecting Talmidim, Rebbeim, and Friends of the Yeshiva. Access Torah shiurim, community events, and alumni resources.",
              url: "https://ytcalumni.com",
              logo: "https://ytcalumni.com/yeshiva-logo.png",
              image: "https://ytcalumni.com/og-image.jpg",
              address: {
                "@type": "PostalAddress",
                addressLocality: "Denver",
                addressRegion: "CO",
                addressCountry: "US",
              },
              sameAs: [],
              contactPoint: {
                "@type": "ContactPoint",
                contactType: "alumni relations",
                email: "ytcalumni@abbrachfeld.com",
              },
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Yeshiva Toras Chaim Alumni",
              url: "https://ytcalumni.com",
              potentialAction: {
                "@type": "SearchAction",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate: "https://ytcalumni.com/shiurim?search={search_term_string}",
                },
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: "https://ytcalumni.com" },
                { "@type": "ListItem", position: 2, name: "Shiurim", item: "https://ytcalumni.com/shiurim" },
                { "@type": "ListItem", position: 3, name: "Events", item: "https://ytcalumni.com/events" },
                { "@type": "ListItem", position: 4, name: "Contacts", item: "https://ytcalumni.com/contacts" },
                { "@type": "ListItem", position: 5, name: "Support", item: "https://ytcalumni.com/support" },
              ],
            }),
          }}
        />
      </head>
      <body className={`${inter.variable} ${merriweather.variable} ${heebo.variable} font-sans antialiased`}>
        <AuthProvider>
          <div className="flex min-h-screen flex-col">
            <div className="flex-1">{children}</div>
            <Footer />
          </div>
          <Toaster />
          <ScrollToTop />
          <AnalyticsTracker />
          <FirstLoginPopup />
          <RebbeimPortalAnnouncement />
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
