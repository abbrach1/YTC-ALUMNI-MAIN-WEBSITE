import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")

  if (!url) {
    return NextResponse.json({ error: "Missing URL parameter" }, { status: 400 })
  }

  try {
    // Extract Google Drive file ID
    let fileId = ""
    const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
    const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)

    if (fileIdMatch) {
      fileId = fileIdMatch[1]
    } else if (idMatch) {
      fileId = idMatch[1]
    }

    if (!fileId) {
      return NextResponse.json({ error: "Invalid Google Drive URL" }, { status: 400 })
    }

    const urlsToTry = [
      `https://drive.google.com/uc?export=download&id=${fileId}`,
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      `https://drive.google.com/uc?id=${fileId}&export=download`,
    ]

    let audioResponse: Response | null = null
    let lastError: Error | null = null

    for (const downloadUrl of urlsToTry) {
      try {
        console.log("[v0] Trying URL:", downloadUrl)

        const response = await fetch(downloadUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept: "audio/*,*/*",
          },
          redirect: "follow",
        })

        console.log("[v0] Response status:", response.status)
        console.log("[v0] Content-Type:", response.headers.get("content-type"))

        // Check if response is HTML (error page) or actual audio
        const contentType = response.headers.get("content-type") || ""

        if (response.ok && !contentType.includes("text/html")) {
          audioResponse = response
          console.log("[v0] Found valid audio response")
          break
        }

        // If HTML, it might be a confirmation page for large files
        if (contentType.includes("text/html")) {
          const html = await response.text()
          console.log("[v0] Got HTML response, checking for confirm token")

          // Look for confirmation token
          const confirmMatch = html.match(/confirm=([0-9A-Za-z_-]+)/) || html.match(/&amp;confirm=([^&]+)/)

          if (confirmMatch) {
            console.log("[v0] Found confirm token:", confirmMatch[1])
            const confirmedUrl = `https://drive.google.com/uc?export=download&confirm=${confirmMatch[1]}&id=${fileId}`

            const confirmedResponse = await fetch(confirmedUrl, {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                Accept: "audio/*,*/*",
              },
              redirect: "follow",
            })

            if (confirmedResponse.ok) {
              const confirmedContentType = confirmedResponse.headers.get("content-type") || ""
              if (!confirmedContentType.includes("text/html")) {
                audioResponse = confirmedResponse
                console.log("[v0] Confirmed download successful")
                break
              }
            }
          }
        }
      } catch (e) {
        lastError = e as Error
        console.log("[v0] URL failed:", downloadUrl, e)
      }
    }

    if (!audioResponse) {
      console.log("[v0] All URLs failed")
      return NextResponse.json(
        {
          error: "Failed to fetch audio from Google Drive",
          details: lastError?.message,
        },
        { status: 500 },
      )
    }

    const contentType = audioResponse.headers.get("content-type") || "audio/mpeg"
    const contentLength = audioResponse.headers.get("content-length")

    const headers: HeadersInit = {
      "Content-Type": contentType.includes("audio") ? contentType : "audio/mpeg",
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    }

    if (contentLength) {
      headers["Content-Length"] = contentLength
    }

    return new NextResponse(audioResponse.body, {
      status: 200,
      headers,
    })
  } catch (error) {
    console.error("[v0] Proxy audio error:", error)
    return NextResponse.json({ error: "Failed to proxy audio" }, { status: 500 })
  }
}
