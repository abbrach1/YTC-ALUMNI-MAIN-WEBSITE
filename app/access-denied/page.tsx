"use client"

import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ShieldAlert } from "lucide-react"
import Link from "next/link"

export default function AccessDeniedPage() {
  const { signOut } = useAuth()

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4">
      <Card className="w-full max-w-md border-gold/20 bg-white shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <ShieldAlert className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="font-serif text-3xl text-navy">Access Denied</CardTitle>
          <CardDescription className="text-navy/70">You do not have permission to access this area</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-navy/80">This section is restricted to administrators only.</p>

          <div className="flex flex-col gap-2">
            <Button asChild className="w-full bg-navy text-cream hover:bg-navy/90">
              <Link href="/">Return to Home</Link>
            </Button>
            <Button
              onClick={() => signOut()}
              variant="outline"
              className="w-full border-gold text-navy hover:bg-gold/10"
            >
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
