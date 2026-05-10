"use client"

import Link from "next/link"
import Image from "next/image"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Menu, User, Mail, Upload } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useState } from "react"
import { usePathname } from "next/navigation"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/shiurim", label: "Shiurim" },
  { href: "/events", label: "Events" },
  { href: "/contacts", label: "Contacts" },
]

export function Navbar() {
  const { user, signOut, isAdmin, canUploadShiurim } = useAuth()
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/"
    }
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Contact Banner */}
      <div className="bg-gold/90 text-navy py-1.5 px-4 text-center text-sm">
        <span className="inline-flex items-center gap-2 flex-wrap justify-center">
          <Mail className="h-3.5 w-3.5" />
          <span>Comments, mistakes, shiurim or feature requests?</span>
          <a 
            href="mailto:alumni@ytchaim.com" 
            className="font-semibold underline underline-offset-2 hover:text-navy/80 transition-colors"
          >
            alumni@ytchaim.com
          </a>
        </span>
      </div>
      <nav className="sticky top-0 z-50 border-b-2 border-gold/40 bg-navy shadow-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />

        <div className="flex h-[72px] items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-90">
            <Image
              src="/yeshiva-logo.png"
              alt="Yeshiva Toras Chaim"
              width={50}
              height={50}
              className="h-[50px] w-[50px]"
            />
            <div className="flex flex-col">
              <div className="font-serif text-lg font-semibold text-gold leading-tight tracking-wide">
                Yeshiva Toras Chaim
              </div>
              <div className="text-xs text-cream/80 font-light tracking-wider uppercase">Alumni Network</div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2 text-sm font-medium transition-all border-b-2 ${
                  isActive(link.href)
                    ? "text-gold border-gold bg-cream/5"
                    : "text-cream/90 hover:text-gold hover:bg-cream/5 border-transparent hover:border-gold/50"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-3">
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-9 px-3 gap-2 text-cream hover:text-gold hover:bg-cream/5">
                    <User className="h-4 w-4" />
                    <span className="text-sm hidden sm:inline">{user.email?.split("@")[0]}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-cream border-gold/30 shadow-lg">
                  <DropdownMenuItem disabled className="text-navy/70 text-xs">
                    {user.email}
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="cursor-pointer text-navy hover:bg-gold/10">
                      My Info
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/subscriptions" className="cursor-pointer text-navy hover:bg-gold/10">
                      Subscriptions
                    </Link>
                  </DropdownMenuItem>
                  {canUploadShiurim && (
                    <DropdownMenuItem asChild>
                      <Link href="/upload-shiur" className="cursor-pointer text-navy hover:bg-gold/10">
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Shiur
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="cursor-pointer text-navy hover:bg-gold/10">
                        Admin Dashboard
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => signOut()} className="cursor-pointer text-navy hover:bg-gold/10">
                    Log Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Mobile Menu */}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon" className="text-cream hover:text-gold hover:bg-cream/5">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 bg-navy border-l-2 border-gold/40">
                <div className="flex items-center gap-2 mb-8">
                  <Image
                    src="/yeshiva-logo.png"
                    alt="Yeshiva Toras Chaim"
                    width={40}
                    height={40}
                    className="h-10 w-10"
                  />
                  <div className="font-serif text-base font-semibold text-gold">YTC Alumni</div>
                </div>

                <div className="flex flex-col gap-1">
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className={`px-3 py-3 transition-colors text-base border-l-2 ${
                        isActive(link.href)
                          ? "text-gold bg-cream/10 border-gold"
                          : "text-cream hover:text-gold hover:bg-cream/5 border-transparent hover:border-gold"
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}
                  <div className="h-px bg-gold/20 my-2" />
                  <Link
                    href="/profile"
                    onClick={() => setOpen(false)}
                    className={`px-3 py-3 transition-colors text-base border-l-2 ${
                      pathname === "/profile"
                        ? "text-gold bg-cream/10 border-gold"
                        : "text-cream hover:text-gold hover:bg-cream/5 border-transparent hover:border-gold"
                    }`}
                  >
                    My Info
                  </Link>
                  <Link
                    href="/subscriptions"
                    onClick={() => setOpen(false)}
                    className={`px-3 py-3 transition-colors text-base border-l-2 ${
                      pathname === "/subscriptions"
                        ? "text-gold bg-cream/10 border-gold"
                        : "text-cream hover:text-gold hover:bg-cream/5 border-transparent hover:border-gold"
                    }`}
                  >
                    Subscriptions
                  </Link>
                  {canUploadShiurim && (
                    <Link
                      href="/upload-shiur"
                      onClick={() => setOpen(false)}
                      className={`px-3 py-3 transition-colors text-base border-l-2 flex items-center gap-2 ${
                        pathname === "/upload-shiur"
                          ? "text-gold bg-cream/10 border-gold"
                          : "text-cream hover:text-gold hover:bg-cream/5 border-transparent hover:border-gold"
                      }`}
                    >
                      <Upload className="h-4 w-4" />
                      Upload Shiur
                    </Link>
                  )}
                  {isAdmin && (
                    <>
                      <div className="h-px bg-gold/20 my-2" />
                      <Link
                        href="/admin"
                        onClick={() => setOpen(false)}
                        className={`px-3 py-3 transition-colors text-base border-l-2 ${
                          pathname.startsWith("/admin")
                            ? "text-gold bg-cream/10 border-gold"
                            : "text-gold hover:bg-cream/5 border-gold/50"
                        }`}
                      >
                        Admin Dashboard
                      </Link>
                    </>
                  )}
                  <div className="h-px bg-gold/20 my-2" />
                  <Button
                    onClick={() => {
                      signOut()
                      setOpen(false)
                    }}
                    variant="outline"
                    className="mt-2 border-gold/40 text-cream hover:bg-gold hover:text-navy transition-colors"
                  >
                    Log Out
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
    </>
  )
}
