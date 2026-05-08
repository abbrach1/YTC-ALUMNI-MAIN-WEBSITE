// Platform detection for analytics.
//
// Priority:
//   1. window.__YTC_PLATFORM__ - set explicitly by a native wrapper
//      (Capacitor, Android WebView, etc.) before the page loads.
//   2. Capacitor's built-in detection if @capacitor/core is present at runtime.
//   3. User-Agent string sniffing as a fallback.
//
// We distinguish between native apps and mobile browsers on the same OS:
// "ios-app" vs "ios-web", "android-app" vs "android-web", etc. Bare values
// ("ios", "android", "ipados") are kept as legacy types so old data still
// renders, but new events should always use the explicit -app / -web suffix.

export type Platform =
  | "ios-app"
  | "ios-web"
  | "ipados-app"
  | "ipados-web"
  | "android-app"
  | "android-web"
  | "web-mobile"
  | "web-desktop"
  // Legacy values retained for back-compat reading of older analytics data.
  | "ios"
  | "ipados"
  | "android"
  | "unknown"

declare global {
  interface Window {
    __YTC_PLATFORM__?: Platform
    Capacitor?: {
      getPlatform?: () => string
      isNativePlatform?: () => boolean
    }
  }
}

type OSGuess = "ios" | "ipados" | "android" | "web-mobile" | "web-desktop"

function detectOS(): OSGuess {
  const ua = (typeof navigator !== "undefined" ? navigator.userAgent : "") || ""
  const uaLower = ua.toLowerCase()

  if (/android/.test(uaLower)) return "android"
  if (/iphone|ipod/.test(uaLower)) return "ios"
  // iPads on iPadOS 13+ report as Mac; check touch points to disambiguate
  if (
    /ipad/.test(uaLower) ||
    (uaLower.includes("macintosh") &&
      typeof navigator !== "undefined" &&
      navigator.maxTouchPoints > 1)
  ) {
    return "ipados"
  }
  if (/mobile|tablet/.test(uaLower)) return "web-mobile"
  return "web-desktop"
}

export function getPlatform(): Platform {
  if (typeof window === "undefined") return "unknown"

  // 1. Native wrapper override (most reliable - we set this ourselves)
  const explicit = window.__YTC_PLATFORM__
  if (explicit) {
    // Already in the new explicit form? Pass through unchanged.
    if (
      explicit === "ios-app" ||
      explicit === "ios-web" ||
      explicit === "ipados-app" ||
      explicit === "ipados-web" ||
      explicit === "android-app" ||
      explicit === "android-web" ||
      explicit === "web-mobile" ||
      explicit === "web-desktop" ||
      explicit === "unknown"
    ) {
      return explicit
    }
    // Bare legacy values from a wrapper mean "this IS the native app" by convention.
    if (explicit === "ios") return "ios-app"
    if (explicit === "ipados") return "ipados-app"
    if (explicit === "android") return "android-app"
  }

  // 2. Capacitor runtime detection — if the page is running inside the
  // native shell, mark it as the *-app variant.
  let isNative = false
  try {
    const cap = window.Capacitor
    if (cap?.isNativePlatform?.()) {
      isNative = true
    } else if (cap?.getPlatform) {
      const p = cap.getPlatform()
      // Capacitor returns "web" when running in a browser, "ios"/"android" in native.
      if (p === "ios" || p === "android") isNative = true
    }
  } catch {
    // ignore
  }

  // 3. User-Agent sniffing
  const os = detectOS()

  if (isNative) {
    if (os === "ios") return "ios-app"
    if (os === "ipados") return "ipados-app"
    if (os === "android") return "android-app"
    return os // unlikely fallback
  }

  // Browser on a known mobile OS → -web variant
  if (os === "ios") return "ios-web"
  if (os === "ipados") return "ipados-web"
  if (os === "android") return "android-web"
  return os
}

// Friendly label for displaying in admin UIs
export function platformLabel(p: Platform | string | null | undefined): string {
  switch (p) {
    case "ios-app":
      return "iOS App"
    case "ios-web":
      return "iOS Web"
    case "ipados-app":
      return "iPad App"
    case "ipados-web":
      return "iPad Web"
    case "android-app":
      return "Android App"
    case "android-web":
      return "Android Web"
    case "web-mobile":
      return "Mobile Web"
    case "web-desktop":
      return "Desktop"
    // Legacy
    case "ios":
      return "iPhone"
    case "ipados":
      return "iPad"
    case "android":
      return "Android"
    default:
      return "Unknown"
  }
}
