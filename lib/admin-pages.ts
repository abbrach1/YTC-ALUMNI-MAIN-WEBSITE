import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  Camera,
  Contact,
  Database,
  FileText,
  FolderOpen,
  HeartHandshake,
  ImageIcon,
  type LucideIcon,
  Mail,
  Megaphone,
  Settings,
  Shield,
  Smartphone,
  UserCog,
  Users,
  Video,
} from "lucide-react"

/**
 * The single email that holds permanent super-admin rights.
 * Lowercased — comparisons against this value should also be lowercased.
 */
export const SUPER_ADMIN_EMAIL = "abbrachfeld@gmail.com"

export interface AdminPageDef {
  /** Absolute path of the admin page. */
  href: string
  /** Sidebar label. */
  label: string
  /** Lucide icon component. */
  icon: LucideIcon
  /** When true, only the super-admin sees this and may navigate to it. */
  superAdminOnly?: boolean
}

export const ADMIN_PAGES: AdminPageDef[] = [
  { href: "/admin/requests", label: "Requests", icon: FileText },
  { href: "/admin/users", label: "User Accounts", icon: UserCog },
  { href: "/admin/permissions", label: "Admin Permissions", icon: Shield, superAdminOnly: true },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/debug/tracking", label: "Tracking Debug", icon: Activity },
  { href: "/admin/notifications", label: "Push Notifications", icon: Bell },
  { href: "/admin/email-blast", label: "Email Blast", icon: Mail },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { href: "/admin/upcoming-shiur", label: "Upcoming Shiur", icon: Video },
  { href: "/admin/shiurim", label: "Shiur Database", icon: BookOpen },
  { href: "/admin/collections", label: "Shiur Collections", icon: FolderOpen },
  { href: "/admin/events", label: "Events & Simchos", icon: Calendar },
  { href: "/admin/fundraiser", label: "Fundraiser", icon: HeartHandshake },
  { href: "/admin/alumni", label: "Alumni Management", icon: Database },
  { href: "/admin/contacts", label: "Rebbeim Directory", icon: Users },
  { href: "/admin/alumni-contacts", label: "Alumni Contacts", icon: Contact },
  { href: "/admin/carousel", label: "Carousel Images", icon: ImageIcon },
  { href: "/admin/alumni-photos", label: "Alumni Photos", icon: Camera },
  { href: "/admin/app-update", label: "App Update", icon: Smartphone, superAdminOnly: true },
  { href: "/admin/settings", label: "Site Settings", icon: Settings },
]

/**
 * The list of pages a regular (non-super) admin can be granted access to.
 * Excludes the super-admin-only pages.
 */
export const GRANTABLE_ADMIN_PAGES = ADMIN_PAGES.filter((p) => !p.superAdminOnly)

/**
 * Decide whether a given user is allowed to view a particular admin path.
 *
 * Rules:
 *  - The super-admin can access every admin path.
 *  - The /admin root dashboard is accessible to any admin.
 *  - Super-admin-only paths (/admin/permissions/...) are denied to others.
 *  - If `allowedPages` is null, the admin has unrestricted access (back-compat).
 *  - Otherwise, the path must match one of the allowed page hrefs (either an
 *    exact match or a path under the allowed page, e.g. /admin/users/foo
 *    matches an allowed /admin/users).
 */
export function canAccessAdminPath(
  pathname: string,
  isSuperAdmin: boolean,
  allowedPages: string[] | null,
): boolean {
  if (isSuperAdmin) return true
  if (pathname === "/admin") return true
  // Super-admin-only paths
  if (pathname.startsWith("/admin/permissions")) return false
  // No restriction set → full access (back-compat for admins predating the
  // permissions system).
  if (allowedPages === null) return true
  return allowedPages.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  )
}
