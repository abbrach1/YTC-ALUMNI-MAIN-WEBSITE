import { type NextRequest, NextResponse } from "next/server"
import { uploadToB2 } from "@/lib/backblaze"

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] Upload request received")
    const formData = await request.formData()
    const file = formData.get("file") as File
    const type = formData.get("type") as "audio" | "pdf"

    console.log("[v0] File:", file?.name, "Type:", type, "Size:", file?.size)

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!type || !["audio", "pdf"].includes(type)) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 })
    }

    console.log("[v0] Starting B2 upload to bucket: ALUMNI")
    console.log("[v0] Endpoint:", "https://s3.us-east-005.backblazeb2.com")

    const result = await uploadToB2(file, type)
    console.log("[v0] Upload successful:", result)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("[v0] Error uploading to B2:", error)
    console.error("[v0] Error message:", error.message)
    console.error("[v0] Error code:", error.Code || error.code || error.$metadata?.httpStatusCode)
    console.error("[v0] Full error:", JSON.stringify(error, null, 2))
    return NextResponse.json(
      {
        error: error.message || "Upload failed",
        code: error.Code || error.code,
        details: error.$metadata,
      },
      { status: 500 },
    )
  }
}
