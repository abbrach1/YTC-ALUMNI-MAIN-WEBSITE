// Shared types + Firestore locations for the alumni fundraiser campaign feature.
//
// Admin manages the campaign at settings/{FUNDRAISER_SETTINGS_DOC} (toggle it
// on/off + edit the copy shown on the home page). Alumni sign-ups land in the
// {FUNDRAISER_SIGNUPS_COLLECTION} collection, are emailed to the office, and
// show up in the /admin/fundraiser tab with an Excel export.

/** Doc id under the `settings` collection holding the campaign config. */
export const FUNDRAISER_SETTINGS_DOC = "fundraiserCampaign"

/** Collection holding one doc per alumni campaign-page sign-up. */
export const FUNDRAISER_SIGNUPS_COLLECTION = "campaignSignups"

export type CampaignSignupStatus = "new" | "contacted" | "live" | "archived"

export interface FundraiserSettings {
  /** Master on/off switch for the home-page sign-up section. */
  enabled: boolean
  /** Internal campaign name, e.g. "2026 Annual Campaign". */
  campaignName: string
  /** Link to the live CharityExtra campaign (shown to alumni after they submit). */
  campaignUrl: string
  /**
   * Source link for the live progress stats. Accepts either the public campaign
   * link (`charityextra.com/{slug}`) or the API link
   * (`charityextra.com/api/{slug}/details`). Falls back to `campaignUrl` when blank.
   */
  statusUrl: string
  /** Master on/off switch for the live progress bar (amount raised / goal / donors). */
  showCampaignStatus: boolean
  /** Show a live "time left" countdown to the deadline. */
  showCountdown: boolean
  /** Headline shown on the home-page call-to-action. */
  headline: string
  /** Supporting copy shown on the home-page call-to-action. */
  description: string
  /** Optional ISO date (yyyy-mm-dd) the campaign ends — shown on the CTA. */
  deadline: string | null
  /** Pre-filled fundraising goal in the sign-up form (the alumnus can edit it). */
  defaultGoal: string
  /** Pre-filled personal message in the sign-up form (the alumnus can edit it). */
  defaultMessage: string
  /** Show the "Visit the Campaign" link on the home-page CTA (turn on once the page is live). */
  showLinkOnHome: boolean
  /** Show the "Visit the Campaign" link on the success screen after an alumnus submits. */
  showLinkOnSubmit: boolean
  /** ISO timestamp of the last admin edit. */
  updatedAt?: string
}

export interface CampaignSignup {
  id?: string
  fullName: string
  email: string
  phone: string
  /** Title the alumnus wants on their personal CharityExtra page. */
  pageTitle: string
  /** Personal fundraising goal — free text (e.g. "$1,800"). */
  goalAmount: string
  /** Personal message / dedication for their page. */
  message: string
  /** Logged-in account email that submitted (may differ from the contact email). */
  submittedBy: string | null
  /** ISO timestamp. */
  submittedAt: string
  status: CampaignSignupStatus
}

/** Defaults used when the settings doc doesn't exist yet. */
export const FUNDRAISER_DEFAULTS: FundraiserSettings = {
  enabled: false,
  campaignName: "",
  campaignUrl: "",
  statusUrl: "",
  showCampaignStatus: true,
  showCountdown: true,
  headline: "Be Part of Our Campaign",
  description:
    "Create your own fundraising page and help us reach our goal. Fill out the form and our office will set up your personal campaign page on CharityExtra.",
  deadline: null,
  defaultGoal: "",
  defaultMessage: "",
  showLinkOnHome: false,
  showLinkOnSubmit: true,
}

export const CAMPAIGN_STATUS_LABELS: Record<CampaignSignupStatus, string> = {
  new: "New",
  contacted: "Contacted",
  live: "Page Live",
  archived: "Archived",
}

export const CAMPAIGN_STATUSES: CampaignSignupStatus[] = ["new", "contacted", "live", "archived"]

/**
 * Live campaign stats from the CharityExtra public API
 * (`https://www.charityextra.com/api/{slug}/details`). Fetched server-side via
 * `/api/campaign-status` to dodge CORS, normalized to the fields below.
 */
export interface CampaignStatus {
  /** Fundraising target. */
  goal: number
  /** Stretch / bonus target (matched-funds ceiling), if any. */
  goalBonus: number
  /** Total raised so far. */
  amount: number
  /** Number of donations. */
  donations: number
  /** Matching multiplier, e.g. 2 means donations are doubled (1 = no match). */
  multiplied: number
  /** ISO 4217 currency code, e.g. "GBP", "USD". */
  currency: string
  /** Display symbol, e.g. "£", "$". */
  currencySymbol: string
  /** Campaign is accepting donations. */
  open: boolean
  /** Campaign is currently live (within its run window). */
  isLive: boolean
  /** Unix (seconds) start time. */
  starts: number
  /** CharityExtra campaign slug. */
  name: string
  /** Charity display name. */
  knownAs: string
  /** Raised as a % of goal, clamped 0–100 (computed by our API route). */
  percent: number
}

/**
 * CharityExtra campaign pages live at `charityextra.com/{slug}` and their API at
 * `charityextra.com/api/{slug}/details`. Pull the slug out of either form so the
 * admin only ever has to paste the public campaign link.
 */
export function deriveCampaignSlug(campaignUrl: string): string | null {
  if (!campaignUrl) return null
  try {
    const u = new URL(campaignUrl.trim())
    const parts = u.pathname.split("/").filter(Boolean)
    if (parts.length === 0) return null
    // API form: /api/{slug}/details
    if (parts[0] === "api" && parts.length >= 2) return parts[1]
    // Public form: /{slug}
    return parts[0]
  } catch {
    return null
  }
}
