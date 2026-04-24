import type * as React from "react"

interface ShiurReminderEmailProps {
  shiurTitle: string
  rebbe: string
  date: string
  time: string
  zoomLink: string
  description?: string
}

export const ShiurReminderEmail: React.FC<ShiurReminderEmailProps> = ({
  shiurTitle,
  rebbe,
  date,
  time,
  zoomLink,
  description,
}) => (
  <div style={{ fontFamily: "Georgia, serif", maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
    <div style={{ textAlign: "center", marginBottom: "30px" }}>
      <h1 style={{ color: "#0C1A35", fontSize: "28px", marginBottom: "10px" }}>Shiur Reminder</h1>
      <div style={{ width: "60px", height: "3px", backgroundColor: "#C9A44E", margin: "0 auto" }} />
    </div>

    <div
      style={{
        backgroundColor: "#F8F5EF",
        borderRadius: "8px",
        padding: "24px",
        border: "1px solid #C9A44E",
        marginBottom: "24px",
      }}
    >
      <h2 style={{ color: "#0C1A35", fontSize: "24px", marginBottom: "8px" }}>{shiurTitle}</h2>
      <p style={{ color: "#0C1A35", opacity: 0.7, marginBottom: "16px" }}>By {rebbe}</p>

      <div style={{ marginBottom: "16px" }}>
        <p style={{ color: "#0C1A35", margin: "4px 0" }}>
          <strong>Date:</strong> {date}
        </p>
        <p style={{ color: "#0C1A35", margin: "4px 0" }}>
          <strong>Time:</strong> {time}
        </p>
      </div>

      {description && (
        <p style={{ color: "#0C1A35", opacity: 0.8, marginBottom: "16px", lineHeight: "1.6" }}>{description}</p>
      )}

      <a
        href={zoomLink}
        style={{
          display: "inline-block",
          backgroundColor: "#0C1A35",
          color: "#F8F5EF",
          padding: "12px 24px",
          borderRadius: "6px",
          textDecoration: "none",
          fontWeight: "bold",
        }}
      >
        Join via Zoom
      </a>
    </div>

    <div style={{ textAlign: "center", color: "#0C1A35", opacity: 0.6, fontSize: "14px" }}>
      <p>Yeshiva Toras Chaim Alumni Network</p>
      <p style={{ fontSize: "12px", marginTop: "8px" }}>
        You received this email because you signed up for shiur reminders.
      </p>
    </div>
  </div>
)

export default ShiurReminderEmail
