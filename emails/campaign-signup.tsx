interface CampaignSignupEmailProps {
  fullName: string
  email: string
  phone: string
  pageTitle: string
  goalAmount?: string
  message?: string
  campaignName?: string
  submittedBy?: string
}

export const CampaignSignupEmail = ({
  fullName,
  email,
  phone,
  pageTitle,
  goalAmount,
  message,
  campaignName,
  submittedBy,
}: CampaignSignupEmailProps) => (
  <html>
    <body style={{ fontFamily: "Arial, sans-serif", lineHeight: "1.6", color: "#0C1A35" }}>
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
        <div style={{ borderBottom: "3px solid #C9A44E", paddingBottom: "20px", marginBottom: "20px" }}>
          <h1 style={{ color: "#0C1A35", fontFamily: "Georgia, serif" }}>Yeshiva Toras Chaim Alumni Portal</h1>
        </div>

        <h2 style={{ color: "#C9A44E" }}>
          New Campaign Page Request{campaignName ? ` — ${campaignName}` : ""}
        </h2>

        <div style={{ backgroundColor: "#F8F5EF", padding: "15px", borderRadius: "5px", margin: "20px 0" }}>
          <p>
            <strong>Name:</strong> {fullName}
          </p>
          <p>
            <strong>Email:</strong> {email}
          </p>
          <p>
            <strong>Phone:</strong> {phone}
          </p>
          <p>
            <strong>Page / Team Title:</strong> {pageTitle}
          </p>
          {goalAmount ? (
            <p>
              <strong>Fundraising Goal:</strong> {goalAmount}
            </p>
          ) : null}
          {message ? (
            <div>
              <p>
                <strong>Message:</strong>
              </p>
              <p>{message}</p>
            </div>
          ) : null}
          {submittedBy ? (
            <p style={{ marginTop: "15px", fontSize: "12px", color: "#666" }}>
              <strong>Submitted by (account):</strong> {submittedBy}
            </p>
          ) : null}
        </div>

        <p>Review this request and set up the campaign page from the admin Fundraiser tab.</p>

        <div
          style={{
            marginTop: "30px",
            paddingTop: "20px",
            borderTop: "1px solid #C9A44E",
            fontSize: "12px",
            color: "#666",
          }}
        >
          <p>Yeshiva Toras Chaim Alumni Portal — Admin Notification</p>
        </div>
      </div>
    </body>
  </html>
)
