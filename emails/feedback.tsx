interface FeedbackEmailProps {
  category: string
  subject: string
  message: string
  submittedBy: string
  source: string
  appVersion?: string
}

export const FeedbackEmail = ({
  category,
  subject,
  message,
  submittedBy,
  source,
  appVersion,
}: FeedbackEmailProps) => (
  <html>
    <body style={{ fontFamily: "Arial, sans-serif", lineHeight: "1.6", color: "#0C1A35" }}>
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
        <div style={{ borderBottom: "3px solid #C9A44E", paddingBottom: "20px", marginBottom: "20px" }}>
          <h1 style={{ color: "#0C1A35", fontFamily: "Georgia, serif" }}>Yeshiva Toras Chaim Alumni Portal</h1>
        </div>

        <h2 style={{ color: "#C9A44E" }}>New Feedback</h2>

        <div style={{ backgroundColor: "#F8F5EF", padding: "15px", borderRadius: "5px", margin: "20px 0" }}>
          <p>
            <strong>Category:</strong> {category}
          </p>
          <p>
            <strong>Subject:</strong> {subject}
          </p>
          <div>
            <p>
              <strong>Message:</strong>
            </p>
            <p style={{ whiteSpace: "pre-wrap" }}>{message}</p>
          </div>
          <p style={{ marginTop: "15px", fontSize: "12px", color: "#666" }}>
            <strong>From:</strong> {submittedBy}
            <br />
            <strong>Source:</strong> {source}
            {appVersion ? (
              <>
                <br />
                <strong>App version:</strong> {appVersion}
              </>
            ) : null}
          </p>
        </div>

        <p>Reply directly to this email to respond to the sender.</p>

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
