import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Detect when an ad blocker / privacy extension is blocking Firebase requests
export function isBlockedByClient(error: any): boolean {
  const message = (error?.message || "").toLowerCase()
  const code = (error?.code || "").toLowerCase()
  return (
    message.includes("err_blocked_by_client") ||
    message.includes("blocked by client") ||
    message.includes("network request failed") ||
    code === "unavailable" ||
    code === "failed-precondition"
  )
}

// Quick non-intrusive check that Firestore is reachable from the browser.
// Returns true if reachable, false if blocked by ad blocker / network.
export async function checkFirestoreReachable(timeoutMs = 5000): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    // Hit the Firestore listen endpoint - if blocker is on, this will fail immediately
    const response = await fetch("https://firestore.googleapis.com/v1/projects/_/databases/(default)/documents", {
      method: "GET",
      mode: "cors",
      signal: controller.signal,
      cache: "no-store",
    }).catch(() => null)
    clearTimeout(timer)
    // Even a 401/403 response means the request reached Google's servers - that's fine.
    // Only a null response (network failure / blocked) is a problem.
    return response !== null
  } catch {
    return false
  }
}

// Convert Firebase/technical errors to user-friendly messages
export function getUserFriendlyError(error: any): string {
  const errorCode = error?.code || ''
  const errorMessage = error?.message || ''

  // Detect ad blocker / privacy extension blocking
  if (isBlockedByClient(error)) {
    return "It looks like a browser extension (such as an ad blocker or privacy extension) is blocking the upload. Please disable it for this site or try a different browser, then try again."
  }

  // Firebase Auth errors
  const firebaseErrorMap: Record<string, string> = {
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/user-disabled': 'This account has been disabled. Please contact support.',
    'auth/user-not-found': 'No account found with this email. Please sign up first.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-credential': 'Invalid email or password. Please check your credentials and try again.',
    'auth/email-already-in-use': 'An account with this email already exists. Please sign in instead.',
    'auth/weak-password': 'Password is too weak. Please use at least 6 characters.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled. Please contact support.',
    'auth/too-many-requests': 'Too many failed attempts. Please wait a few minutes and try again.',
    'auth/network-request-failed': 'Network error. Please check your internet connection and try again.',
    'auth/popup-closed-by-user': 'Sign-in was cancelled. Please try again.',
    'auth/requires-recent-login': 'Please sign out and sign back in to perform this action.',
    'auth/invalid-login-credentials': 'Invalid email or password. Please check your credentials and try again.',
  }
  
  // Check for Firebase error code
  if (errorCode && firebaseErrorMap[errorCode]) {
    return firebaseErrorMap[errorCode]
  }
  
  // Check if the error message contains Firebase-specific text
  if (errorMessage.toLowerCase().includes('firebase') || 
      errorMessage.toLowerCase().includes('auth/') ||
      errorMessage.toLowerCase().includes('firestore')) {
    return 'Something went wrong. Please try again later.'
  }
  
  // Check for network errors
  if (errorMessage.toLowerCase().includes('network') || 
      errorMessage.toLowerCase().includes('fetch')) {
    return 'Network error. Please check your internet connection and try again.'
  }
  
  // Check for permission errors
  if (errorMessage.toLowerCase().includes('permission') || 
      errorMessage.toLowerCase().includes('unauthorized')) {
    return 'You do not have permission to perform this action.'
  }
  
  // Return the original message if it seems user-friendly (short and no technical terms)
  if (errorMessage.length < 100 && 
      !errorMessage.includes('Error:') && 
      !errorMessage.includes('Exception')) {
    return errorMessage || 'Something went wrong. Please try again.'
  }
  
  // Default fallback
  return 'Something went wrong. Please try again later.'
}
