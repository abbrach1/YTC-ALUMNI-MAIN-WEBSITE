"use client"

import { useState } from "react"
import { Menu } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { AdminSidebarContent } from "@/components/admin-sidebar"

export function AdminHeader() {
  const { user, signOut } = useAuth()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <header className="border-b border-gold/20 bg-white px-4 py-3 sm:px-6 sm:py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {/* Mobile nav drawer */}
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="-ml-2 shrink-0 text-navy lg:hidden">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Open navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-72 max-w-[85vw] gap-0 border-gold/20 bg-navy p-0 [&>button]:text-cream"
            >
              <SheetTitle className="sr-only">Admin navigation</SheetTitle>
              <AdminSidebarContent onNavigate={() => setMobileNavOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-navy sm:text-2xl">Admin Panel</h2>
            <p className="hidden text-sm text-navy/60 sm:block">Manage yeshiva content and settings</p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 shrink-0 rounded-full">
              <Avatar className="h-10 w-10">
                <AvatarImage src={user?.photoURL || ""} alt={user?.displayName || ""} />
                <AvatarFallback className="bg-gold text-navy">{user?.email?.[0].toUpperCase()}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-white border-gold/20">
            <DropdownMenuItem disabled className="text-navy">
              {user?.email}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => signOut()} className="cursor-pointer text-navy hover:text-gold">
              Log Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
