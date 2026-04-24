import { type NextRequest, NextResponse } from "next/server"

const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE || "alumniytc"
const BUNNY_API_KEY = process.env.BUNNY_API_KEY
const BUNNY_STORAGE_HOSTNAME = process.env.BUNNY_STORAGE_HOSTNAME || "storage.bunnycdn.com"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const fileName = searchParams.get("fileName")
  const folder = searchParams.get("folder") || "shiurim"
  const debug = searchParams.get("debug")

  if (debug === "true") {
    return NextResponse.json({
      configured: !!BUNNY_API_KEY,
      storageZone: BUNNY_STORAGE_ZONE,
      hostname: BUNNY_STORAGE_HOSTNAME,
      keyLength: BUNNY_API_KEY?.length || 0,
    })
  }

  if (!BUNNY_API_KEY) {
    return NextResponse.json({ error: "Bunny.net API key not configured" }, { status: 500 })
  }

  if (!fileName) {
    return NextResponse.json({ error: "fileName is required" }, { status: 400 })
  }

  const timestamp = Date.now()
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_")
  const finalFileName = `${timestamp}-${sanitizedName}`
  const filePath = `${folder}/${finalFileName}`

  const uploadUrl = `https://${BUNNY_STORAGE_HOSTNAME}/${BUNNY_STORAGE_ZONE}/${filePath}`
  const cdnUrl = `https://${BUNNY_STORAGE_ZONE}.b-cdn.net/${filePath}`

  return NextResponse.json({
    uploadUrl,
    cdnUrl,
    accessKey: BUNNY_API_KEY,
    fileName: finalFileName,
  })
}

// Keep POST as fallback for smaller files
export async function POST(request: NextRequest) {
  try {
    if (!BUNNY_API_KEY) {
      return NextResponse.json({ error: "Bunny.net API key not configured" }, { status: 500 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File
    const folder = (formData.get("folder") as string) || "shiurim"

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const timestamp = Date.now()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const fileName = `${timestamp}-${sanitizedName}`
    const filePath = `${folder}/${fileName}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const uploadUrl = `https://${BUNNY_STORAGE_HOSTNAME}/${BUNNY_STORAGE_ZONE}/${filePath}`

    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        AccessKey: BUNNY_API_KEY,
        "Content-Type": "application/octet-stream",
      },
      body: buffer,
    })

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text()
      return NextResponse.json({ error: `Upload failed: ${errorText}` }, { status: 500 })
    }

    const cdnUrl = `https://${BUNNY_STORAGE_ZONE}.b-cdn.net/${filePath}`

    return NextResponse.json({
      success: true,
      url: cdnUrl,
      fileName: fileName,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 500 })
  }
}
