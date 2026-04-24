"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Home, BookOpen } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-[80vh] bg-cream/30 flex items-center justify-center px-4">
      <div className="text-center max-w-md mx-auto">
        {/* Logo */}
        <div className="mb-6">
          <Image
            src="/images/ytc-logo.png"
            alt="Yeshiva Toras Chaim"
            width={80}
            height={80}
            className="mx-auto opacity-50"
          />
        </div>

        {/* 404 */}
        <h1 className="text-6xl font-bold text-navy mb-2">404</h1>
        
        {/* Message */}
        <h2 className="text-xl font-semibold text-navy mb-2">Page Not Found</h2>
        <p className="text-navy/60 mb-8">
          This page doesn't exist. It may have been moved or removed.
        </p>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild className="bg-navy hover:bg-navy-light text-cream">
            <Link href="/">
              <Home className="w-4 h-4 mr-2" />
              Home
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-navy/20 text-navy hover:bg-navy/5 bg-transparent"
          >
            <Link href="/shiurim">
              <BookOpen className="w-4 h-4 mr-2" />
              Shiurim
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
