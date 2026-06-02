"use client"

import { useEffect, useState } from "react"
import { Users, TrendingUp } from "lucide-react"
import { deriveCampaignSlug, type CampaignStatus } from "@/lib/fundraiser"

interface CampaignProgressProps {
  /** Public CharityExtra campaign link (slug is derived from it). */
  campaignUrl: string
  /**
   * "dark" for the navy home-page CTA (cream/gold text), "light" for the admin
   * card on a white background.
   */
  variant?: "dark" | "light"
  className?: string
}

function formatAmount(symbol: string, value: number) {
  // Whole units only — donation totals don't need cents on a progress bar.
  return `${symbol}${Math.round(value).toLocaleString()}`
}

/**
 * Live fundraising progress for the active CharityExtra campaign. Self-gating:
 * renders nothing until the status loads, and stays hidden if the campaign URL
 * has no derivable slug or the API errors — so callers can drop it in safely.
 */
export function CampaignProgress({ campaignUrl, variant = "dark", className }: CampaignProgressProps) {
  const [status, setStatus] = useState<CampaignStatus | null>(null)

  useEffect(() => {
    const slug = deriveCampaignSlug(campaignUrl)
    if (!slug) {
      setStatus(null)
      return
    }
    let cancelled = false
    fetch(`/api/campaign-status?slug=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`))))
      .then((data: CampaignStatus) => {
        if (!cancelled) setStatus(data)
      })
      .catch((e) => {
        // A failed/blocked status just hides the bar — never break the page.
        console.error("[campaign-progress] failed to load status", e)
      })
    return () => {
      cancelled = true
    }
  }, [campaignUrl])

  if (!status || status.goal <= 0) return null

  const dark = variant === "dark"
  const sym = status.currencySymbol
  const muted = dark ? "text-cream/70" : "text-navy/60"
  const strong = dark ? "text-cream" : "text-navy"
  const trackBg = dark ? "bg-cream/15" : "bg-navy/10"

  return (
    <div className={className}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <span className={`text-2xl font-bold sm:text-3xl ${dark ? "text-gold" : "text-navy"}`}>
            {formatAmount(sym, status.amount)}
          </span>
          <span className={`ml-2 text-sm ${muted}`}>raised of {formatAmount(sym, status.goal)} goal</span>
        </div>
        <span className={`text-sm font-semibold ${strong}`}>{Math.round(status.percent)}%</span>
      </div>

      <div className={`mt-2 h-2.5 w-full overflow-hidden rounded-full ${trackBg}`}>
        <div
          className="h-full rounded-full bg-gold transition-all"
          style={{ width: `${status.percent}%` }}
        />
      </div>

      <div className={`mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm ${muted}`}>
        <span className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          {status.donations.toLocaleString()} donation{status.donations === 1 ? "" : "s"}
        </span>
        {status.multiplied > 1 && (
          <span className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            Donations matched {status.multiplied}x
          </span>
        )}
      </div>
    </div>
  )
}
