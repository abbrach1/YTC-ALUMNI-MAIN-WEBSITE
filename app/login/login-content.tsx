"use client"

import type React from "react"
import { useState } from "react"
import Image from "next/image"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { getUserFriendlyError } from "@/lib/utils"
import { Eye, EyeOff } from "lucide-react"

export default function LoginContent() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [isSignUp, setIsSignUp] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { signInWithEmail, signUpWithEmail } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (isSignUp && (!firstName.trim() || !lastName.trim())) {
      toast({
        title: "Missing Information",
        description: "Please enter your first and last name.",
        variant: "destructive",
      })
      return
    }
    
    if (isSignUp && password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive",
      })
      return
    }
    
    setIsLoading(true)
    try {
      if (isSignUp) {
        const { isApproved, isAdmin } = await signUpWithEmail(email, password, {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        })
        if (isAdmin) {
          toast({
            title: "Account created",
            description: "Welcome! You have been granted admin access.",
          })
          router.push("/admin")
        } else if (isApproved) {
          toast({
            title: "Account created",
            description: "Welcome! Your email was found in our alumni database.",
          })
          router.push("/")
        } else {
          toast({
            title: "Account created",
            description: "Your account has been created. Please wait for approval.",
          })
          router.push("/request-access")
        }
      } else {
        const { isApproved, isAdmin } = await signInWithEmail(email, password)
        if (isAdmin) {
          router.push("/admin")
        } else if (isApproved) {
          router.push("/")
        } else {
          router.push("/request-access")
        }
      }
    } catch (error: any) {
      toast({
        title: "Unable to sign in",
        description: getUserFriendlyError(error),
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4">
      <Card className="w-full max-w-md border-gold/20 bg-white shadow-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Image src="/yeshiva-logo.png" alt="Yeshiva Toras Chaim" width={80} height={80} className="h-20 w-20" />
          </div>
          <CardTitle className="font-serif text-3xl text-navy">Yeshiva Toras Chaim Alumni</CardTitle>
          <CardDescription className="text-navy/70">
            {isSignUp ? "Create your account" : "Sign in to access the alumni portal"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isSignUp && (
            <div className="bg-navy/5 border border-navy/10 rounded-lg p-4 text-sm text-navy/80">
              <p className="font-medium text-navy mb-2">How approval works:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>If your email is in our alumni database, you will be approved automatically</li>
                <li>Otherwise, your request will be reviewed by an administrator</li>
                <li>You will receive access once approved</li>
              </ul>
            </div>
          )}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            {isSignUp && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-navy">
                      First Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      className="border-gold/20"
                      disabled={isLoading}
                      placeholder="Moshe"
                      autoComplete="given-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-navy">
                      Last Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="lastName"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      className="border-gold/20"
                      disabled={isLoading}
                      placeholder="Cohen"
                      autoComplete="family-name"
                    />
                  </div>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-navy">
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-gold/20"
                disabled={isLoading}
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-navy">
                Password <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="border-gold/20 pr-10"
                  disabled={isLoading}
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-navy/50 hover:text-navy transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-navy">
                  Confirm Password <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="border-gold/20 pr-10"
                    disabled={isLoading}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-navy/50 hover:text-navy transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
            <Button type="submit" className="w-full bg-navy text-cream hover:bg-navy/90" disabled={isLoading}>
              {isLoading ? (
                <>
                  <div
                    className="h-4 w-4 animate-spin rounded-full border-2 border-cream border-t-transparent mr-2"
                    aria-hidden="true"
                  />
                  {isSignUp ? "Creating Account..." : "Signing In..."}
                </>
              ) : isSignUp ? (
                "Sign Up"
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="text-center text-sm">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-navy hover:text-gold transition-colors"
              disabled={isLoading}
            >
              {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
