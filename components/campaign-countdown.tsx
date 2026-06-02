"use client"

import { useEffect, useState } from "react"
import { Clock } from "lucide-react"

interface CampaignCountdownProps {
  /** Campaign end date as ISO yyyy-mm-dd (counts down to the end of that day). */
  deadline: string
  /** "dark" for the navy home CTA, "light" for the admin card. */
  variant?: "dark" | "light"
  className?: string
}

function timeLeft(deadline: string): { label: string; ended: boolean } | null {
  const end = new Date(`${deadline}T23:59:59`).getTime()
  if (Number.isNaN(end)) return null

  const ms = end - Date.now()
  if (ms <= 0) return { label: "Campaign ended", ended: true }

  const mins = Math.floor(ms / 60000)
  const days = Math.floor(mins / (60 * 24))
  const hours = Math.floor((mins % (60 * 24)) / 60)
  const minutes = mins % 60

  if (days >= 1) {
    const h = hours > 0 ? `, ${hours} hr${hours === 1 ? "" : "s"}` : ""
    return { label: `${days} day${days === 1 ? "" : "s"}${h} left`, ended: false }
  }
  if (hours >= 1) return { label: `${hours} hr${hours === 1 ? "" : "s"}, ${minutes} min left`, ended: false }
  return { label: `${minutes} min left`, ended: false }
}

/**
 * Live "time left" countdown to the campaign deadline. Self-gating: renders
 * nothing if no/invalid deadline. Re-computes every minute.
 */
export function CampaignCountdown({ deadline, variant = "dark", className }: CampaignCountdownProps) {
  const [state, setState] = useState<{ label: string; ended: boolean } | null>(() =>
    deadline ? timeLeft(deadline) : null,
  )

  useEffect(() => {
    if (!deadline) {
      setState(null)
      return
    }
    setState(timeLeft(deadline))
    const id = setInterval(() => setState(timeLeft(deadline)), 60_000)
    return () => clearInterval(id)
  }, [deadline])

  if (!state) return null

  const dark = variant === "dark"
  const tone = state.ended
    ? dark
      ? "text-cream/60"
      : "text-navy/50"
    : dark
      ? "text-gold"
      : "text-navy"

  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${tone} ${className ?? ""}`}>
      <Clock className="h-4 w-4" />
      {state.label}
    </span>
  )
}
