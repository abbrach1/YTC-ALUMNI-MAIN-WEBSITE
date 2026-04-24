import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

const BACKBLAZE_KEY_ID = "0057ff2de81b0a30000000001"
const BACKBLAZE_APP_KEY = "K005n49X5LnpjwKFfHofrqn4K+jPmXc"
const BACKBLAZE_ENDPOINT = "https://s3.us-east-005.backblazeb2.com"
const BACKBLAZE_BUCKET = "ALUMNI"

// Initialize S3 client for Backblaze B2
const s3Client = new S3Client({
  endpoint: BACKBLAZE_ENDPOINT,
  region: "us-east-005",
  credentials: {
    accessKeyId: BACKBLAZE_KEY_ID,
    secretAccessKey: BACKBLAZE_APP_KEY,
  },
  forcePathStyle: true,
})

export interface UploadResult {
  url: string
  key: string
}

/**
 * Upload a file to Backblaze B2
 */
export async function uploadToB2(file: File, folder: "audio" | "pdf"): Promise<UploadResult> {
  try {
    console.log("[v0] Converting file to buffer...")
    const buffer = Buffer.from(await file.arrayBuffer())
    const key = `${folder}/${Date.now()}-${file.name}`

    console.log("[v0] Uploading to B2:", key)

    const command = new PutObjectCommand({
      Bucket: BACKBLAZE_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    })

    console.log("[v0] Sending command to S3 client...")
    await s3Client.send(command)

    console.log("[v0] Upload complete!")

    // Generate public URL
    const url = `${BACKBLAZE_ENDPOINT}/${BACKBLAZE_BUCKET}/${key}`

    return { url, key }
  } catch (error: any) {
    console.error("[v0] B2 Upload Error:", error.message)
    console.error("[v0] Error code:", error.Code || error.code)
    console.error("[v0] Error details:", error)
    throw error
  }
}

/**
 * Get a presigned URL for a private file (optional, if you want temporary access)
 */
export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BACKBLAZE_BUCKET,
    Key: key,
  })

  return await getSignedUrl(s3Client, command, { expiresIn })
}

/**
 * Delete a file from Backblaze B2
 */
export async function deleteFromB2(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BACKBLAZE_BUCKET,
    Key: key,
  })

  await s3Client.send(command)
}

/**
 * Extract key from full URL
 */
export function getKeyFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)
    const pathParts = urlObj.pathname.split("/")
    // Remove empty first element and bucket name
    return pathParts.slice(2).join("/")
  } catch {
    return null
  }
}
