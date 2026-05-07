"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  BookOpen,
  Calendar,
  Users,
  FileText,
  Settings,
  ArrowLeft,
  ImageIcon,
  Video,
  Megaphone,
  Camera,
  Database,
  BarChart3,
  UserCog,
  Contact,
  FolderOpen,
  Bell,
  Mail,
  Activity,
} from "lucide-react"
import { Button } from "@/components/ui/button"

const menuItems = [
  { href: "/admin/requests", icon: FileText, label: "Requests" },
  { href: "/admin/users", icon: UserCog, label: "User Accounts" },
  { href: "/admin/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/admin/debug/tracking", icon: Activity, label: "Tracking Debug" },
  { href: "/admin/notifications", icon: Bell, label: "Push Notifications" },
  { href: "/admin/email-blast", icon: Mail, label: "Email Blast" },
  { href: "/admin/announcements", icon: Megaphone, label: "Announcements" },
  { href: "/admin/upcoming-shiur", icon: Video, label: "Upcoming Shiur" },
  { href: "/admin/shiurim", icon: BookOpen, label: "Shiur Database" },
  { href: "/admin/collections", icon: FolderOpen, label: "Shiur Collections" },
  { href: "/admin/events", icon: Calendar, label: "Events & Simchos" },
  { href: "/admin/alumni", icon: Database, label: "Alumni Management" },
  { href: "/admin/contacts", icon: Users, label: "Rebbeim Directory" },
  { href: "/admin/alumni-contacts", icon: Contact, label: "Alumni Contacts" },
  { href: "/admin/carousel", icon: ImageIcon, label: "Carousel Images" },
  { href: "/admin/alumni-photos", icon: Camera, label: "Alumni Photos" },
  { href: "/admin/settings", icon: Settings, label: "Site Settings" },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <div className="flex h-screen w-64 flex-col border-r border-gold/20 bg-navy">
      {/* Header */}
      <div className="border-b border-gold/20 p-6">
        <div className="flex items-center gap-3 mb-2">
          <Image src="/yeshiva-logo.png" alt="Yeshiva Toras Chaim" width={40} height={40} className="h-10 w-10" />
          <div>
            <h1 className="font-serif text-xl font-bold text-gold">Admin Panel</h1>
            <p className="text-sm text-cream/70">Yeshiva Toras Chaim</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    isActive ? "bg-gold text-navy font-medium" : "text-cream hover:bg-navy/80 hover:text-gold",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-gold/20 p-4">
        <Button
          asChild
          variant="outline"
          className="w-full border-gold text-cream hover:bg-gold hover:text-navy bg-transparent"
        >
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Site
          </Link>
        </Button>
      </div>
    </div>
  )
}
