interface WelcomeEmailProps {
  userName: string
}

export const WelcomeEmail = ({ userName }: WelcomeEmailProps) => (
  <html>
    <body style={{ fontFamily: "Arial, sans-serif", lineHeight: "1.6", color: "#0C1A35" }}>
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
        <div style={{ borderBottom: "3px solid #C9A44E", paddingBottom: "20px", marginBottom: "20px" }}>
          <h1 style={{ color: "#0C1A35", fontFamily: "Georgia, serif" }}>Yeshiva Toras Chaim Alumni Portal</h1>
        </div>

        <h2 style={{ color: "#C9A44E" }}>Welcome to the Alumni Community!</h2>

        <p>Dear {userName || "Alumni"},</p>

        <p>
          Welcome to the Yeshiva Toras Chaim Alumni Portal! Your account has been automatically approved and you now
          have full access to all alumni features.
        </p>

        <div style={{ backgroundColor: "#F8F5EF", padding: "20px", borderRadius: "5px", margin: "20px 0" }}>
          <h3 style={{ color: "#0C1A35", marginTop: 0 }}>What you can do:</h3>
          <ul style={{ marginBottom: 0, paddingLeft: "20px" }}>
            <li style={{ marginBottom: "8px" }}>
              <strong>Alumni Directory</strong> (Coming soon!) - Connect with fellow alumni and find old friends
            </li>
            <li style={{ marginBottom: "8px" }}>
              <strong>Shiurim Library</strong> - Access our collection of Torah shiurim
            </li>
            <li style={{ marginBottom: "8px" }}>
              <strong>Events</strong> - Stay updated on alumni gatherings and reunions
            </li>
            <li style={{ marginBottom: "8px" }}>
              <strong>Simchas</strong> - Share simchas with your fellow alumni and rebbeim.
            </li>
            <li style={{ marginBottom: "8px" }}>
              <strong>Contact Updates</strong> - Keep your information current so alumni can reach you
            </li>
          </ul>
        </div>

        <p>
          <a
            href="https://alumni.ytchaim.com"
            style={{
              display: "inline-block",
              backgroundColor: "#C9A44E",
              color: "#0C1A35",
              padding: "12px 24px",
              textDecoration: "none",
              borderRadius: "5px",
              fontWeight: "bold",
            }}
          >
            Visit the Portal
          </a>
        </p>

        <p style={{ marginTop: "20px" }}>
          If you have any questions or need assistance, feel free to reply to this email or contact us at{" "}
          <a href="mailto:alumni@ytchaim.com" style={{ color: "#C9A44E" }}>
            alumni@ytchaim.com
          </a>
          .
        </p>

        <p style={{ marginTop: "20px" }}>Hazlacha,<br />The YTC Alumni Team</p>

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
          <p style={{ margin: "5px 0" }}>
            <a href="https://alumni.ytchaim.com" style={{ color: "#C9A44E" }}>
              alumni.ytchaim.com
            </a>
          </p>
        </div>
      </div>
    </body>
  </html>
)
