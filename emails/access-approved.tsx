interface AccessApprovedEmailProps {
  userName: string
}

export const AccessApprovedEmail = ({ userName }: AccessApprovedEmailProps) => (
  <html>
    <body style={{ fontFamily: "Arial, sans-serif", lineHeight: "1.6", color: "#0C1A35" }}>
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
        <div style={{ borderBottom: "3px solid #C9A44E", paddingBottom: "20px", marginBottom: "20px" }}>
          <h1 style={{ color: "#0C1A35", fontFamily: "Georgia, serif" }}>Yeshiva Toras Chaim Alumni Portal</h1>
        </div>

        <h2 style={{ color: "#C9A44E" }}>Access Approved!</h2>

        <p>Dear {userName || "Alumni"},</p>

        <p>Great news! Your request for access to the Yeshiva Toras Chaim Alumni Portal has been approved.</p>

        <div style={{ backgroundColor: "#F8F5EF", padding: "15px", borderRadius: "5px", margin: "20px 0" }}>
          <p style={{ margin: 0 }}>You can now log in and access all alumni features including:</p>
          <ul style={{ marginTop: "10px" }}>
            <li>Alumni Directory</li>
            <li>Shiurim Library</li>
            <li>Events and Simchas</li>
            <li>Contact Information</li>
          </ul>
        </div>

        <p>
          <a
            href="https://alumni.ytchaim.com/login"
            style={{
              display: "inline-block",
              backgroundColor: "#0C1A35",
              color: "#F8F5EF",
              padding: "12px 24px",
              textDecoration: "none",
              borderRadius: "5px",
              fontWeight: "bold",
            }}
          >
            Log In Now
          </a>
        </p>

        <p style={{ marginTop: "20px" }}>Welcome to our alumni community!</p>

        <div
          style={{
            marginTop: "30px",
            paddingTop: "20px",
            borderTop: "1px solid #C9A44E",
            fontSize: "12px",
            color: "#666",
          }}
        >
          <p>Yeshiva Toras Chaim Alumni Portal</p>
        </div>
      </div>
    </body>
  </html>
)
