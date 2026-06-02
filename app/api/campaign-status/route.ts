import { type NextRequest, NextResponse } from "next/server"
import { deriveCampaignSlug, type CampaignStatus } from "@/lib/fundraiser"

// Proxies the CharityExtra public campaign API server-side so the browser never
// hits a cross-origin request, then normalizes the payload (adds a clamped
// `percent`) into our CampaignStatus shape. Pass either ?slug= or ?url=.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const slug = params.get("slug") || deriveCampaignSlug(params.get("url") || "")

  if (!slug) {
    return NextResponse.json({ error: "Missing campaign slug" }, { status: 400 })
  }

  const endpoint = `https://www.charityextra.com/api/${encodeURIComponent(slug)}/details`

  try {
    const res = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      // Cache for a minute so a busy home page doesn't hammer CharityExtra.
      next: { revalidate: 60 },
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: `CharityExtra returned ${res.status}` },
        { status: 502 },
      )
    }

    const raw = (await res.json()) as Partial<CampaignStatus>
    const goal = Number(raw.goal) || 0
    const amount = Number(raw.amount) || 0
    const percent = goal > 0 ? Math.max(0, Math.min(100, (amount / goal) * 100)) : 0

    const status: CampaignStatus = {
      goal,
      goalBonus: Number(raw.goalBonus) || 0,
      amount,
      donations: Number(raw.donations) || 0,
      multiplied: Number(raw.multiplied) || 1,
      currency: raw.currency || "USD",
      currencySymbol: raw.currencySymbol || "$",
      open: Boolean(raw.open),
      isLive: Boolean(raw.isLive),
      starts: Number(raw.starts) || 0,
      name: raw.name || slug,
      knownAs: raw.knownAs || "",
      percent,
    }

    return NextResponse.json(status, {
      headers: { "Cache-Control": "public, max-age=60" },
    })
  } catch (error) {
    console.error("[campaign-status] fetch failed", error)
    return NextResponse.json({ error: "Failed to fetch campaign status" }, { status: 500 })
  }
}
