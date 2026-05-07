// Platform detection for analytics.
//
// Priority:
//   1. window.__YTC_PLATFORM__ - set explicitly by a native wrapper
//      (Capacitor, Android WebView, etc.) before the page loads.
//   2. Capacitor's built-in detection if @capacitor/core is present at runtime.
//   3. User-Agent string sniffing as a fallback.
//
// Possible values: "android" | "ios" | "ipados" | "web-mobile" | "web-desktop" | "unknown"

export type Platform = "android" | "ios" | "ipados" | "web-mobile" | "web-desktop" | "unknown"

declare global {
  interface Window {
    __YTC_PLATFORM__?: Platform
    Capacitor?: {
      getPlatform?: () => string
      isNativePlatform?: () => boolean
    }
  }
}

export function getPlatform(): Platform {
  if (typeof window === "undefined") return "unknown"

  // 1. Native wrapper override (most reliable - we set this ourselves)
  if (window.__YTC_PLATFORM__) return window.__YTC_PLATFORM__

  // 2. Capacitor runtime detection
  try {
    const cap = window.Capacitor
    if (cap?.getPlatform) {
      const p = cap.getPlatform()
      if (p === "android") return "android"
      if (p === "ios") return "ios"
    }
  } catch {
    // ignore
  }

  // 3. User-Agent sniffing (least reliable, but works for plain browsers)
  const ua = navigator.userAgent || ""
  const uaLower = ua.toLowerCase()

  if (/android/.test(uaLower)) return "android"
  if (/iphone|ipod/.test(uaLower)) return "ios"
  // iPads on iPadOS 13+ report as Mac; check touch points to disambiguate
  if (/ipad/.test(uaLower) || (uaLower.includes("macintosh") && navigator.maxTouchPoints > 1)) {
    return "ipados"
  }
  if (/mobile|tablet/.test(uaLower)) return "web-mobile"

  return "web-desktop"
}

// Friendly label for displaying in admin UIs
export function platformLabel(p: Platform | string | null | undefined): string {
  switch (p) {
    case "android":
      return "Android"
    case "ios":
      return "iPhone"
    case "ipados":
      return "iPad"
    case "web-mobile":
      return "Mobile Web"
    case "web-desktop":
      return "Desktop"
    default:
      return "Unknown"
  }
}
