interface ContactUpdateEmailProps {
  fullName: string
  email: string
  phone: string
  phone2?: string
  address: string
  city: string
  occupation?: string
  additionalInfo?: string
}

export const ContactUpdateEmail = ({
  fullName,
  email,
  phone,
  phone2,
  address,
  city,
  occupation,
  additionalInfo,
}: ContactUpdateEmailProps) => (
  <html>
    <body style={{ fontFamily: "Arial, sans-serif", lineHeight: "1.6", color: "#0C1A35" }}>
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
        <div style={{ borderBottom: "3px solid #C9A44E", paddingBottom: "20px", marginBottom: "20px" }}>
          <h1 style={{ color: "#0C1A35", fontFamily: "Georgia, serif" }}>Yeshiva Toras Chaim Alumni Portal</h1>
        </div>

        <h2 style={{ color: "#C9A44E" }}>Contact Information Update</h2>

        <p>An alumnus has submitted updated contact information:</p>

        <div style={{ backgroundColor: "#F8F5EF", padding: "15px", borderRadius: "5px", margin: "20px 0" }}>
          <p>
            <strong>Full Name:</strong> {fullName}
          </p>
          <p>
            <strong>Email:</strong> {email}
          </p>
          <p>
            <strong>Phone:</strong> {phone}
          </p>
          {phone2 && phone2 !== "Not provided" && (
            <p>
              <strong>Second Phone:</strong> {phone2}
            </p>
          )}
          <p>
            <strong>Address:</strong> {address}
          </p>
          <p>
            <strong>City:</strong> {city}
          </p>
          {occupation && (
            <p>
              <strong>Occupation:</strong> {occupation}
            </p>
          )}
          {additionalInfo && (
            <div>
              <p>
                <strong>Additional Info:</strong>
              </p>
              <p>{additionalInfo}</p>
            </div>
          )}
        </div>

        <p>Please review and update the contact directory.</p>

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
