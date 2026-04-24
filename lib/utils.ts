import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Convert Firebase/technical errors to user-friendly messages
export function getUserFriendlyError(error: any): string {
  const errorCode = error?.code || ''
  const errorMessage = error?.message || ''
  
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
