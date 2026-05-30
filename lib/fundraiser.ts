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
  headline: "Be Part of Our Campaign",
  description:
    "Create your own fundraising page and help us reach our goal. Fill out the form and our office will set up your personal campaign page on CharityExtra.",
  deadline: null,
}

export const CAMPAIGN_STATUS_LABELS: Record<CampaignSignupStatus, string> = {
  new: "New",
  contacted: "Contacted",
  live: "Page Live",
  archived: "Archived",
}

export const CAMPAIGN_STATUSES: CampaignSignupStatus[] = ["new", "contacted", "live", "archived"]
