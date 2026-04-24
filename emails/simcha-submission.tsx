interface SimchaSubmissionEmailProps {
  fullName: string
  simchaType: string
  date: string
  connection: string
  message?: string
  submittedBy: string
}

export const SimchaSubmissionEmail = ({
  fullName,
  simchaType,
  date,
  connection,
  message,
  submittedBy,
}: SimchaSubmissionEmailProps) => (
  <html>
    <body style={{ fontFamily: "Arial, sans-serif", lineHeight: "1.6", color: "#0C1A35" }}>
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
        <div style={{ borderBottom: "3px solid #C9A44E", paddingBottom: "20px", marginBottom: "20px" }}>
          <h1 style={{ color: "#0C1A35", fontFamily: "Georgia, serif" }}>Yeshiva Toras Chaim Alumni Portal</h1>
        </div>

        <h2 style={{ color: "#C9A44E" }}>New Simcha Submission</h2>

        <div style={{ backgroundColor: "#F8F5EF", padding: "15px", borderRadius: "5px", margin: "20px 0" }}>
          <p>
            <strong>Full Name:</strong> {fullName}
          </p>
          <p>
            <strong>Type of Simcha:</strong> {simchaType}
          </p>
          <p>
            <strong>Date:</strong> {date}
          </p>
          <p>
            <strong>Connection:</strong> {connection}
          </p>
          {message && (
            <div>
              <p>
                <strong>Message:</strong>
              </p>
              <p>{message}</p>
            </div>
          )}
          <p style={{ marginTop: "15px", fontSize: "12px", color: "#666" }}>
            <strong>Submitted by:</strong> {submittedBy}
          </p>
        </div>

        <p>Please review this submission in the admin dashboard.</p>

        <div
          style={{
            marginTop: "30px",
            paddingTop: "20px",
            borderTop: "1px solid #C9A44E",
            fontSize: "12px",
            color: "#666",
          }}
        >
          <p>Yeshiva Toras Chaim Alumni Portal - Admin Notification</p>
        </div>
      </div>
    </body>
  </html>
)
