interface AccessRequestEmailProps {
  userName: string
  userEmail: string
}

export const AccessRequestEmail = ({ userName, userEmail }: AccessRequestEmailProps) => (
  <html>
    <body style={{ fontFamily: "Arial, sans-serif", lineHeight: "1.6", color: "#0C1A35" }}>
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
        <div style={{ borderBottom: "3px solid #C9A44E", paddingBottom: "20px", marginBottom: "20px" }}>
          <h1 style={{ color: "#0C1A35", fontFamily: "Georgia, serif" }}>Yeshiva Toras Chaim Alumni Portal</h1>
        </div>

        <h2 style={{ color: "#C9A44E" }}>New Access Request</h2>

        <p>A new user has requested access to the alumni portal:</p>

        <div style={{ backgroundColor: "#F8F5EF", padding: "15px", borderRadius: "5px", margin: "20px 0" }}>
          <p>
            <strong>Name:</strong> {userName}
          </p>
          <p>
            <strong>Email:</strong> {userEmail}
          </p>
        </div>

        <p>Please review this request in the admin dashboard.</p>

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
