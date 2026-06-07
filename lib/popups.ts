// Admin-authored one-time popups, shown once per user on web + iOS. The admin
// creates a popup (title/message + an optional "go to page" button); it shows
// when a logged-in user opens the app, and once they dismiss it (either button)
// it never shows again for that account. Dismissals are stored per-user so they
// sync across web and the iOS app.

/** Collection holding one doc per admin popup. */
export const POPUPS_COLLECTION = "popups"

/**
 * Per-user dismissal marker. Stored at
 * `users/{uid}/preferences/{POPUP_DISMISS_DOC}` as `{ ids: { [popupId]: iso } }`,
 * merged — the same path the iOS app reads/writes, so a dismissal on one
 * platform hides the popup on the other.
 */
export const POPUP_DISMISS_DOC = "dismissedPopups"

/**
 * Where the popup's action button sends the user. Kept as a small enum so the
 * same target resolves to a web route here and to a tab in the iOS app.
 */
export type PopupTarget = "none" | "home" | "shiurim" | "events" | "contacts" | "external"

export interface AdminPopup {
  id?: string
  /** Master on/off switch for this popup. */
  enabled: boolean
  /** Headline. */
  title: string
  /** Body copy. */
  message: string
  /** Label for the "go to page" button. Blank hides the button (dismiss-only). */
  buttonLabel: string
  /** Label for the dismiss button. */
  dismissLabel: string
  /** Destination for the action button. */
  target: PopupTarget
  /** External URL, used only when target is "external". */
  externalUrl: string
  /** ISO timestamp — controls ordering (oldest active popup shows first). */
  createdAt: string
}

export const POPUP_DEFAULTS: Omit<AdminPopup, "id" | "createdAt"> = {
  enabled: true,
  title: "",
  message: "",
  buttonLabel: "",
  dismissLabel: "Got it",
  target: "none",
  externalUrl: "",
}

/** Human labels for the target dropdown in the admin UI. */
export const POPUP_TARGET_LABELS: Record<PopupTarget, string> = {
  none: "No button (dismiss only)",
  home: "Home",
  shiurim: "Shiurim",
  events: "Events",
  contacts: "Rebbeim Directory (Contacts)",
  external: "External link",
}

export const POPUP_TARGETS: PopupTarget[] = ["none", "home", "shiurim", "events", "contacts", "external"]

/**
 * Resolve a popup's action button to a web URL. Returns null when there's no
 * navigable destination (target "none", or "external" without a URL).
 */
export function resolvePopupHref(popup: Pick<AdminPopup, "target" | "externalUrl">): string | null {
  switch (popup.target) {
    case "home":
      return "/"
    case "shiurim":
      return "/shiurim"
    case "events":
      return "/events"
    case "contacts":
      return "/contacts?tab=rebbeim"
    case "external":
      return popup.externalUrl.trim() || null
    default:
      return null
  }
}
