import { NextResponse } from "next/server"

export async function POST() {
  try {
    const keyId = process.env.B2_KEY_ID
    const applicationKey = process.env.B2_APPLICATION_KEY
    const bucketName = process.env.B2_BUCKET_NAME

    if (!keyId || !applicationKey || !bucketName) {
      return NextResponse.json({ error: "B2 credentials not configured" }, { status: 500 })
    }

    // Step 1: Authorize with B2
    const authResponse = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
      method: "GET",
      headers: {
        Authorization: "Basic " + Buffer.from(`${keyId}:${applicationKey}`).toString("base64"),
      },
    })

    if (!authResponse.ok) {
      const error = await authResponse.text()
      return NextResponse.json({ error: `B2 authorization failed: ${error}` }, { status: 500 })
    }

    const authData = await authResponse.json()
    const { apiUrl, authorizationToken, allowed } = authData
    const bucketId = allowed?.bucketId

    if (!bucketId) {
      return NextResponse.json({ error: "No bucket ID found in authorization" }, { status: 500 })
    }

    // Step 2: Update bucket with CORS rules
    const corsRules = [
      {
        corsRuleName: "allowUploads",
        allowedOrigins: ["*"],
        allowedHeaders: ["*"],
        allowedOperations: [
          "s3_delete",
          "s3_get",
          "s3_head",
          "s3_post",
          "s3_put",
          "b2_upload_file",
          "b2_download_file_by_name",
        ],
        exposeHeaders: ["ETag", "x-bz-content-sha1", "x-amz-meta-custom-header"],
        maxAgeSeconds: 86400,
      },
    ]

    const updateResponse = await fetch(`${apiUrl}/b2api/v2/b2_update_bucket`, {
      method: "POST",
      headers: {
        Authorization: authorizationToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accountId: authData.accountId,
        bucketId: bucketId,
        corsRules: corsRules,
      }),
    })

    if (!updateResponse.ok) {
      const error = await updateResponse.text()
      return NextResponse.json({ error: `Failed to update CORS: ${error}` }, { status: 500 })
    }

    const updateData = await updateResponse.json()
    return NextResponse.json({
      success: true,
      message: "CORS rules configured successfully",
      bucketName: updateData.bucketName,
      corsRules: updateData.corsRules,
    })
  } catch (error) {
    console.error("CORS setup error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: "POST to this endpoint to configure CORS on your B2 bucket",
  })
}
