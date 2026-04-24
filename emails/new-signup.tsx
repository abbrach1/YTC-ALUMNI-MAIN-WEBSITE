interface NewSignupEmailProps {
  userEmail: string
  isApproved: boolean
  isAdmin: boolean
  approvalSource?: string
}

export const NewSignupEmail = ({ userEmail, isApproved, isAdmin, approvalSource }: NewSignupEmailProps) => (
  <html>
    <body style={{ fontFamily: "Arial, sans-serif", lineHeight: "1.6", color: "#0C1A35" }}>
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
        <div style={{ borderBottom: "3px solid #C9A44E", paddingBottom: "20px", marginBottom: "20px" }}>
          <h1 style={{ color: "#0C1A35", fontFamily: "Georgia, serif" }}>Yeshiva Toras Chaim Alumni Portal</h1>
        </div>

        <h2 style={{ color: "#C9A44E" }}>New User Signup</h2>

        <p>A new user has created an account on the alumni portal:</p>

        <div style={{ backgroundColor: "#F8F5EF", padding: "15px", borderRadius: "5px", margin: "20px 0" }}>
          <p>
            <strong>Email:</strong> {userEmail}
          </p>
          <p>
            <strong>Status:</strong>{" "}
            <span
              style={{
                color: isAdmin ? "#7C3AED" : isApproved ? "#16A34A" : "#DC2626",
                fontWeight: "bold",
              }}
            >
              {isAdmin ? "Admin" : isApproved ? "Approved" : "Pending Approval"}
            </span>
          </p>
          {isApproved && approvalSource && (
            <p>
              <strong>Approval Source:</strong> {approvalSource}
            </p>
          )}
        </div>

        {!isApproved && !isAdmin && (
          <p style={{ color: "#DC2626" }}>
            This user needs approval. Please review in the admin dashboard.
          </p>
        )}

        {isApproved && !isAdmin && (
          <p style={{ color: "#16A34A" }}>
            This user was automatically approved based on their email being in the {approvalSource || "approved list"}.
          </p>
        )}

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
