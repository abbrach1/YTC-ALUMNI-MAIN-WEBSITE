import { type NextRequest, NextResponse } from "next/server"
import type { Buffer } from "buffer"
import crypto from "crypto"

const B2_KEY_ID = process.env.B2_KEY_ID
const B2_APPLICATION_KEY = process.env.B2_APPLICATION_KEY
const B2_BUCKET_NAME = process.env.B2_BUCKET_NAME || "ALUMNI"

function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string): Buffer {
  const kDate = crypto
    .createHmac("sha256", "AWS4" + key)
    .update(dateStamp)
    .digest()
  const kRegion = crypto.createHmac("sha256", kDate).update(regionName).digest()
  const kService = crypto.createHmac("sha256", kRegion).update(serviceName).digest()
  const kSigning = crypto.createHmac("sha256", kService).update("aws4_request").digest()
  return kSigning
}

function generatePresignedUrl(
  bucketName: string,
  fileName: string,
  contentType: string,
  keyId: string,
  appKey: string,
  expiresIn = 3600,
): string {
  const region = "us-east-005" // B2 region
  const service = "s3"
  const host = `s3.${region}.backblazeb2.com`
  const endpoint = `https://${host}`

  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "")
  const dateStamp = amzDate.slice(0, 8)

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const encodedFileName = fileName.split("/").map(encodeURIComponent).join("/")

  const canonicalQueryString = [
    `X-Amz-Algorithm=AWS4-HMAC-SHA256`,
    `X-Amz-Credential=${encodeURIComponent(`${keyId}/${credentialScope}`)}`,
    `X-Amz-Date=${amzDate}`,
    `X-Amz-Expires=${expiresIn}`,
    `X-Amz-SignedHeaders=content-type%3Bhost`,
  ]
    .sort()
    .join("&")

  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\n`
  const signedHeaders = "content-type;host"

  const canonicalRequest = [
    "PUT",
    `/${bucketName}/${encodedFileName}`,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n")

  const canonicalRequestHash = crypto.createHash("sha256").update(canonicalRequest).digest("hex")

  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, canonicalRequestHash].join("\n")

  const signingKey = getSignatureKey(appKey, dateStamp, region, service)
  const signature = crypto.createHmac("sha256", signingKey).update(stringToSign).digest("hex")

  return `${endpoint}/${bucketName}/${encodedFileName}?${canonicalQueryString}&X-Amz-Signature=${signature}`
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  // Debug endpoint
  if (searchParams.get("debug") === "true") {
    return NextResponse.json({
      hasKeyId: !!B2_KEY_ID,
      keyIdPrefix: B2_KEY_ID ? B2_KEY_ID.substring(0, 12) + "..." : null,
      hasAppKey: !!B2_APPLICATION_KEY,
      appKeyLength: B2_APPLICATION_KEY?.length || 0,
      bucketName: B2_BUCKET_NAME,
    })
  }

  // Get presigned URL for direct S3 upload
  const fileName = searchParams.get("fileName")
  const contentType = searchParams.get("contentType") || "audio/mpeg"
  const folder = searchParams.get("folder") || "shiurim/audio"

  if (!fileName) {
    return NextResponse.json({ error: "fileName is required" }, { status: 400 })
  }

  if (!B2_KEY_ID || !B2_APPLICATION_KEY) {
    return NextResponse.json({ error: "B2 credentials not configured", useFirebase: true }, { status: 503 })
  }

  try {
    // Generate safe filename
    const timestamp = Date.now()
    const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_")
    const fullPath = `${folder}/${timestamp}-${safeName}`

    // Generate presigned URL for S3-compatible API
    const presignedUrl = generatePresignedUrl(B2_BUCKET_NAME, fullPath, contentType, B2_KEY_ID, B2_APPLICATION_KEY)

    const downloadUrl = `https://f005.backblazeb2.com/file/${B2_BUCKET_NAME}/${fullPath}`

    return NextResponse.json({
      uploadUrl: presignedUrl,
      fileName: fullPath,
      downloadUrl,
      contentType,
    })
  } catch (error) {
    console.error("[v0] B2 presign error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get upload URL" },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!B2_KEY_ID || !B2_APPLICATION_KEY) {
      return NextResponse.json({ error: "B2 credentials not configured", useFirebase: true }, { status: 503 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File
    const folder = (formData.get("folder") as string) || "shiurim/audio"

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Generate filename
    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
    const fullPath = `${folder}/${timestamp}-${safeName}`

    // Generate presigned URL
    const presignedUrl = generatePresignedUrl(
      B2_BUCKET_NAME,
      fullPath,
      file.type || "application/octet-stream",
      B2_KEY_ID,
      B2_APPLICATION_KEY,
    )

    // Upload directly to B2 S3
    const arrayBuffer = await file.arrayBuffer()
    const uploadResponse = await fetch(presignedUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
      },
      body: arrayBuffer,
    })

    if (!uploadResponse.ok) {
      const error = await uploadResponse.text()
      throw new Error(`B2 upload failed: ${error}`)
    }

    const publicUrl = `https://f005.backblazeb2.com/file/${B2_BUCKET_NAME}/${fullPath}`

    return NextResponse.json({
      success: true,
      url: publicUrl,
    })
  } catch (error) {
    console.error("[v0] B2 upload error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 500 })
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 60,
}
