import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Privacy Policy | Yeshiva Toras Chaim Alumni",
  description: "Privacy Policy for the Yeshiva Toras Chaim Alumni Network.",
  robots: { index: true, follow: false },
}

export default function PrivacyPolicyPage() {
  const lastUpdated = "March 2026"

  return (
    <div className="min-h-screen bg-[#FAF8F3]">
      {/* Header */}
      <div className="bg-[#0C1A35] py-12">
        <div className="max-w-3xl mx-auto px-6">
          <p className="text-[#C9A44E] text-sm font-medium uppercase tracking-widest mb-3">
            Yeshiva Toras Chaim Alumni Network
          </p>
          <h1 className="text-3xl font-bold text-[#FAF8F3] font-serif">Privacy Policy</h1>
          <p className="text-[#FAF8F3]/50 mt-2 text-sm">Last updated: {lastUpdated}</p>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="space-y-10 text-[#0C1A35]">

          <section className="space-y-3">
            <h2 className="text-xl font-semibold font-serif text-[#0C1A35] border-b border-[#C9A44E]/30 pb-2">
              1. Introduction
            </h2>
            <p className="text-[#0C1A35]/80 leading-relaxed">
              The Yeshiva Toras Chaim Alumni Network (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) operates the alumni portal at{" "}
              <span className="text-[#C9A44E] font-medium">alumni.ytchaim.com</span> (the &ldquo;Site&rdquo;).
              This Privacy Policy explains how we collect, use, and protect your personal information when you use our Site.
              By accessing or using the Site you agree to the terms of this Privacy Policy.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold font-serif text-[#0C1A35] border-b border-[#C9A44E]/30 pb-2">
              2. Information We Collect
            </h2>
            <p className="text-[#0C1A35]/80 leading-relaxed">We may collect the following types of information:</p>
            <ul className="list-none space-y-3 pl-0">
              {[
                {
                  title: "Account Information",
                  body: "When you sign in or register, we collect your name and email address through Google Authentication (Firebase Auth).",
                },
                {
                  title: "Contact Directory Information",
                  body: "If you voluntarily submit your contact details to the alumni directory, we collect information such as your name, phone number, address, occupation, and family details.",
                },
                {
                  title: "Usage Data",
                  body: "We collect information about how you interact with the Site, including shiurim you listen to, pages you visit, and features you use, to improve the experience for all alumni.",
                },
                {
                  title: "Communications",
                  body: "If you sign up for shiur reminders or email updates, we store your email address for that purpose.",
                },
              ].map((item) => (
                <li
                  key={item.title}
                  className="flex gap-3 bg-white rounded-lg p-4 border border-[#C9A44E]/15 shadow-sm"
                >
                  <span className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-[#C9A44E] mt-2" />
                  <span className="text-[#0C1A35]/80 leading-relaxed">
                    <strong className="text-[#0C1A35] font-semibold">{item.title}: </strong>
                    {item.body}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold font-serif text-[#0C1A35] border-b border-[#C9A44E]/30 pb-2">
              3. How We Use Your Information
            </h2>
            <p className="text-[#0C1A35]/80 leading-relaxed">We use the information we collect to:</p>
            <ul className="space-y-2 pl-4">
              {[
                "Provide access to the alumni portal and its features",
                "Display your contact information in the alumni directory (only if you submitted it)",
                "Send shiur reminders and alumni update emails you have opted into",
                "Improve the Site and understand how alumni use it",
                "Communicate important updates about the yeshiva and alumni community",
                "Maintain the security and integrity of the Site",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-[#0C1A35]/80 leading-relaxed">
                  <span className="text-[#C9A44E] font-bold mt-0.5">&#8212;</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold font-serif text-[#0C1A35] border-b border-[#C9A44E]/30 pb-2">
              4. Information Sharing
            </h2>
            <p className="text-[#0C1A35]/80 leading-relaxed">
              We do not sell, trade, or rent your personal information to third parties. Your information may be shared only in the following limited circumstances:
            </p>
            <ul className="space-y-2 pl-4">
              {[
                "With other verified alumni via the alumni directory, but only information you have chosen to submit",
                "With service providers who help operate the Site (Firebase, Resend email service), under confidentiality agreements",
                "If required by law or to protect the rights and safety of our community",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-[#0C1A35]/80 leading-relaxed">
                  <span className="text-[#C9A44E] font-bold mt-0.5">&#8212;</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold font-serif text-[#0C1A35] border-b border-[#C9A44E]/30 pb-2">
              5. Data Storage and Security
            </h2>
            <p className="text-[#0C1A35]/80 leading-relaxed">
              Your data is stored securely using Google Firebase, which employs industry-standard security measures including
              encryption in transit and at rest. Access to the Site is restricted to verified alumni via approved email addresses.
              We implement appropriate technical and organizational measures to protect your personal information against unauthorized
              access, alteration, disclosure, or destruction. However, no method of transmission over the Internet is 100% secure.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold font-serif text-[#0C1A35] border-b border-[#C9A44E]/30 pb-2">
              6. Cookies and Tracking
            </h2>
            <p className="text-[#0C1A35]/80 leading-relaxed">
              The Site uses Firebase Authentication which may set cookies or use local storage to maintain your login session.
              We also collect basic analytics on shiur playback and page usage to improve the alumni experience.
              We do not use third-party advertising trackers or sell your browsing data.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold font-serif text-[#0C1A35] border-b border-[#C9A44E]/30 pb-2">
              7. Your Rights and Choices
            </h2>
            <p className="text-[#0C1A35]/80 leading-relaxed">You have the right to:</p>
            <ul className="space-y-2 pl-4">
              {[
                "Request access to the personal information we hold about you",
                "Request correction of inaccurate information in the alumni directory",
                "Request removal of your contact information from the alumni directory",
                "Opt out of email communications at any time by contacting us",
                "Request deletion of your account",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-[#0C1A35]/80 leading-relaxed">
                  <span className="text-[#C9A44E] font-bold mt-0.5">&#8212;</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-[#0C1A35]/80 leading-relaxed">
              To exercise any of these rights, please contact us using the details in Section 9 below.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold font-serif text-[#0C1A35] border-b border-[#C9A44E]/30 pb-2">
              8. Children&apos;s Privacy
            </h2>
            <p className="text-[#0C1A35]/80 leading-relaxed">
              The Site is intended for use by alumni of Yeshiva Toras Chaim and is not directed to children under the age of 13.
              We do not knowingly collect personal information from children under 13. If you believe a child has provided us with
              personal information, please contact us and we will take steps to delete it.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold font-serif text-[#0C1A35] border-b border-[#C9A44E]/30 pb-2">
              9. Contact Us
            </h2>
            <p className="text-[#0C1A35]/80 leading-relaxed">
              If you have any questions, concerns, or requests regarding this Privacy Policy or your personal data, please contact us at:
            </p>
            <div className="bg-white border border-[#C9A44E]/20 rounded-lg p-5 space-y-1">
              <p className="font-semibold text-[#0C1A35]">Yeshiva Toras Chaim</p>
              <p className="text-[#0C1A35]/70 text-sm">Alumni Network Administration</p>
              <p className="text-[#0C1A35]/70 text-sm">
                Website:{" "}
                <a href="https://alumni.ytchaim.com" className="text-[#C9A44E] hover:underline">
                  alumni.ytchaim.com
                </a>
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold font-serif text-[#0C1A35] border-b border-[#C9A44E]/30 pb-2">
              10. Changes to This Policy
            </h2>
            <p className="text-[#0C1A35]/80 leading-relaxed">
              We may update this Privacy Policy from time to time. When we do, we will update the &ldquo;Last updated&rdquo; date at the top
              of this page. We encourage you to review this policy periodically. Continued use of the Site after changes
              constitutes acceptance of the updated policy.
            </p>
          </section>

        </div>

        {/* Footer link back */}
        <div className="mt-14 pt-8 border-t border-[#C9A44E]/20 text-center">
          <p className="text-[#0C1A35]/40 text-sm">
            &copy; {new Date().getFullYear()} Yeshiva Toras Chaim Alumni Network. All rights reserved.
          </p>
          <Link
            href="/"
            className="inline-block mt-3 text-sm text-[#C9A44E] hover:underline"
          >
            Back to Alumni Portal
          </Link>
        </div>
      </main>
    </div>
  )
}
