import type * as React from "react"

interface ShiurLink {
  title: string
  rebbe: string
  url: string
}

interface AlumniUpdateEmailProps {
  subject: string
  greeting: string
  bodyHtml: string
  shiurLinks: ShiurLink[]
  ctaText?: string
  ctaUrl?: string
  closing: string
}

export const AlumniUpdateEmail: React.FC<AlumniUpdateEmailProps> = ({
  subject,
  greeting,
  bodyHtml,
  shiurLinks,
  ctaText,
  ctaUrl,
  closing,
}) => (
  <html>
    <body style={{ fontFamily: "Arial, sans-serif", lineHeight: "1.6", color: "#0C1A35", margin: 0, padding: 0, backgroundColor: "#f5f5f0" }}>
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
        <div style={{ backgroundColor: "#ffffff", borderRadius: "8px", overflow: "hidden", border: "1px solid #e5e0d5" }}>
          {/* Header */}
          <div style={{ backgroundColor: "#0C1A35", padding: "28px 32px", borderBottom: "3px solid #C9A44E" }}>
            <h1 style={{ color: "#C9A44E", fontFamily: "Georgia, serif", margin: 0, fontSize: "22px" }}>
              Yeshiva Toras Chaim
            </h1>
            <p style={{ color: "#F8F5EF", margin: "4px 0 0 0", fontSize: "14px", opacity: 0.8 }}>Alumni Portal Update</p>
          </div>

          {/* Body */}
          <div style={{ padding: "32px" }}>
            <h2 style={{ color: "#0C1A35", fontFamily: "Georgia, serif", fontSize: "24px", marginTop: 0, marginBottom: "20px" }}>
              {subject}
            </h2>

            <p style={{ fontSize: "16px", marginBottom: "16px" }}>{greeting},</p>

            <div style={{ fontSize: "16px", lineHeight: "1.7" }} dangerouslySetInnerHTML={{ __html: bodyHtml }} />

            {/* Shiur Links */}
            {shiurLinks.length > 0 && (
              <div style={{ margin: "28px 0" }}>
                <h3 style={{ color: "#0C1A35", fontFamily: "Georgia, serif", fontSize: "18px", marginBottom: "12px", borderBottom: "2px solid #C9A44E", paddingBottom: "8px" }}>
                  {shiurLinks.length === 1 ? "New Shiur" : "New Shiurim"}
                </h3>
                {shiurLinks.map((shiur, i) => (
                  <div key={i} style={{
                    backgroundColor: "#F8F5EF",
                    borderRadius: "6px",
                    padding: "16px",
                    marginBottom: "10px",
                    borderLeft: "3px solid #C9A44E",
                  }}>
                    <a href={shiur.url} style={{ color: "#0C1A35", fontWeight: "bold", fontSize: "16px", textDecoration: "none" }}>
                      {shiur.title}
                    </a>
                    <p style={{ color: "#0C1A35", opacity: 0.6, margin: "4px 0 8px 0", fontSize: "14px" }}>
                      By {shiur.rebbe}
                    </p>
                    <a href={shiur.url} style={{
                      display: "inline-block",
                      backgroundColor: "#0C1A35",
                      color: "#F8F5EF",
                      padding: "8px 16px",
                      borderRadius: "4px",
                      textDecoration: "none",
                      fontSize: "13px",
                      fontWeight: "bold",
                    }}>
                      Listen Now
                    </a>
                  </div>
                ))}
              </div>
            )}

            {/* Optional CTA */}
            {ctaText && ctaUrl && (
              <div style={{ margin: "28px 0", textAlign: "center" }}>
                <a href={ctaUrl} style={{
                  display: "inline-block",
                  backgroundColor: "#C9A44E",
                  color: "#0C1A35",
                  padding: "14px 32px",
                  textDecoration: "none",
                  borderRadius: "5px",
                  fontWeight: "bold",
                  fontSize: "16px",
                }}>
                  {ctaText}
                </a>
              </div>
            )}

            {/* Closing */}
            <p style={{ fontSize: "16px", marginTop: "28px", whiteSpace: "pre-line" }}>
              {closing}
            </p>
          </div>

          {/* Footer */}
          <div style={{ backgroundColor: "#f9f7f3", padding: "20px 32px", borderTop: "1px solid #e5e0d5", fontSize: "12px", color: "#666" }}>
            <p style={{ margin: "0 0 4px 0" }}>Yeshiva Toras Chaim Alumni Portal</p>
            <p style={{ margin: "0 0 4px 0" }}>
              <a href="https://alumni.ytchaim.com" style={{ color: "#C9A44E" }}>alumni.ytchaim.com</a>
            </p>
            <p style={{ margin: "8px 0 0 0", fontSize: "11px", color: "#999" }}>
              You are receiving this email as a member of the YTC Alumni community.
            </p>
          </div>
        </div>
      </div>
    </body>
  </html>
)

export default AlumniUpdateEmail
