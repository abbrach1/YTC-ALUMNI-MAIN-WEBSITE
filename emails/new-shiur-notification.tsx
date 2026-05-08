import type * as React from "react"

interface NewShiurNotificationEmailProps {
  shiurTitle: string
  rebbe: string
  date: string
  description?: string
  tags?: string[]
  matchedRebbe?: boolean
  matchedTags?: string[]
  shiurUrl: string
  audioUrl?: string
  pdfUrl?: string
  manageSubscriptionsUrl: string
}

const NAVY = "#0C1A35"
const GOLD = "#C9A44E"
const CREAM = "#F8F5EF"
const MUTED = "#5C6B85"

const formatDate = (raw: string): string => {
  if (!raw) return ""
  const d = new Date(raw)
  if (isNaN(d.getTime())) return raw
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export const NewShiurNotificationEmail: React.FC<NewShiurNotificationEmailProps> = ({
  shiurTitle,
  rebbe,
  date,
  description,
  tags,
  matchedRebbe,
  matchedTags,
  shiurUrl,
  pdfUrl,
  manageSubscriptionsUrl,
}) => {
  const matchReason = (() => {
    if (matchedRebbe && matchedTags && matchedTags.length > 0) {
      return (
        <>
          You're subscribed to <strong>{rebbe}</strong> and to{" "}
          <strong>{matchedTags.join(", ")}</strong>.
        </>
      )
    }
    if (matchedRebbe) {
      return (
        <>
          You're subscribed to <strong>{rebbe}</strong>.
        </>
      )
    }
    if (matchedTags && matchedTags.length > 0) {
      return (
        <>
          You're subscribed to <strong>{matchedTags.join(", ")}</strong>.
        </>
      )
    }
    return <>You're subscribed to new shiur notifications.</>
  })()

  return (
    <html>
      <body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: "#EFEAE0",
          fontFamily: "Georgia, 'Times New Roman', serif",
          color: NAVY,
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <div
          style={{
            maxWidth: "600px",
            margin: "0 auto",
            padding: "32px 16px 48px",
          }}
        >
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "8px" }}>
            <p
              style={{
                margin: 0,
                fontSize: "11px",
                letterSpacing: "3px",
                textTransform: "uppercase",
                color: GOLD,
                fontFamily: "Arial, sans-serif",
                fontWeight: 700,
              }}
            >
              Yeshiva Toras Chaim
            </p>
            <p
              style={{
                margin: "2px 0 0",
                fontSize: "11px",
                letterSpacing: "2px",
                textTransform: "uppercase",
                color: MUTED,
                fontFamily: "Arial, sans-serif",
              }}
            >
              Alumni Network
            </p>
          </div>

          {/* Card */}
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "10px",
              border: `1px solid ${GOLD}33`,
              boxShadow: "0 1px 3px rgba(12, 26, 53, 0.06)",
              overflow: "hidden",
              marginTop: "20px",
            }}
          >
            {/* Top accent bar */}
            <div style={{ height: "4px", backgroundColor: GOLD }} />

            <div style={{ padding: "32px 32px 28px" }}>
              {/* Eyebrow */}
              <p
                style={{
                  margin: 0,
                  fontSize: "12px",
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  color: GOLD,
                  fontFamily: "Arial, sans-serif",
                  fontWeight: 700,
                }}
              >
                New Shiur Uploaded
              </p>

              {/* Title */}
              <h1
                style={{
                  margin: "10px 0 6px",
                  fontSize: "26px",
                  lineHeight: 1.25,
                  color: NAVY,
                  fontFamily: "Georgia, serif",
                }}
              >
                {shiurTitle}
              </h1>

              {/* Rebbe */}
              <p
                style={{
                  margin: "0 0 20px",
                  fontSize: "16px",
                  color: MUTED,
                  fontFamily: "Georgia, serif",
                  fontStyle: "italic",
                }}
              >
                by {rebbe}
              </p>

              {/* Meta block */}
              <div
                style={{
                  backgroundColor: CREAM,
                  borderRadius: "6px",
                  padding: "14px 18px",
                  marginBottom: "20px",
                  fontFamily: "Arial, sans-serif",
                  fontSize: "14px",
                }}
              >
                <p style={{ margin: 0, color: NAVY }}>
                  <span style={{ color: MUTED, marginRight: "8px" }}>Date</span>
                  <strong>{formatDate(date)}</strong>
                </p>
                {tags && tags.length > 0 && (
                  <p style={{ margin: "8px 0 0", color: NAVY }}>
                    <span style={{ color: MUTED, marginRight: "8px" }}>Topics</span>
                    {tags.map((t, i) => (
                      <span
                        key={t}
                        style={{
                          display: "inline-block",
                          backgroundColor: "#FFFFFF",
                          border: `1px solid ${GOLD}55`,
                          borderRadius: "999px",
                          padding: "2px 10px",
                          marginRight: "6px",
                          marginTop: i === 0 ? 0 : "4px",
                          fontSize: "12px",
                          color: NAVY,
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </p>
                )}
              </div>

              {/* Description */}
              {description && (
                <p
                  style={{
                    margin: "0 0 24px",
                    fontSize: "15px",
                    lineHeight: 1.6,
                    color: NAVY,
                    fontFamily: "Georgia, serif",
                  }}
                >
                  {description}
                </p>
              )}

              {/* CTA */}
              <table cellPadding={0} cellSpacing={0} role="presentation" style={{ borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td style={{ paddingRight: "10px" }}>
                      <a
                        href={shiurUrl}
                        style={{
                          display: "inline-block",
                          backgroundColor: NAVY,
                          color: CREAM,
                          padding: "12px 26px",
                          borderRadius: "6px",
                          textDecoration: "none",
                          fontWeight: 700,
                          fontSize: "15px",
                          fontFamily: "Arial, sans-serif",
                        }}
                      >
                        Listen Now
                      </a>
                    </td>
                    {pdfUrl && (
                      <td>
                        <a
                          href={pdfUrl}
                          style={{
                            display: "inline-block",
                            backgroundColor: "transparent",
                            color: NAVY,
                            padding: "11px 24px",
                            borderRadius: "6px",
                            textDecoration: "none",
                            fontWeight: 700,
                            fontSize: "15px",
                            fontFamily: "Arial, sans-serif",
                            border: `1px solid ${NAVY}`,
                          }}
                        >
                          View Mareh Mekomos
                        </a>
                      </td>
                    )}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Match reason */}
          <p
            style={{
              margin: "20px 0 0",
              textAlign: "center",
              fontSize: "13px",
              lineHeight: 1.6,
              color: MUTED,
              fontFamily: "Arial, sans-serif",
            }}
          >
            {matchReason} You'll get an email like this whenever a matching shiur is uploaded.
          </p>

          {/* Footer */}
          <div
            style={{
              marginTop: "24px",
              paddingTop: "20px",
              borderTop: `1px solid ${GOLD}55`,
              textAlign: "center",
              fontSize: "12px",
              lineHeight: 1.6,
              color: MUTED,
              fontFamily: "Arial, sans-serif",
            }}
          >
            <p style={{ margin: 0 }}>Yeshiva Toras Chaim Alumni Network</p>
            <p style={{ margin: "6px 0 0" }}>
              <a href={manageSubscriptionsUrl} style={{ color: NAVY, textDecoration: "underline" }}>
                Manage subscriptions
              </a>{" "}
              ·{" "}
              <a href="https://alumni.ytchaim.com" style={{ color: NAVY, textDecoration: "underline" }}>
                alumni.ytchaim.com
              </a>
            </p>
          </div>
        </div>
      </body>
    </html>
  )
}

export default NewShiurNotificationEmail
