"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { Save, Loader2, Smartphone, AlertTriangle } from "lucide-react"

/** Doc id under `settings` holding the in-app update prompt config. */
const APP_UPDATE_DOC = "appUpdate"

interface AppUpdateSettings {
  /** Master on/off switch for the in-app update prompt. */
  enabled: boolean
  /** Newest version available in the App Store, e.g. "1.3.0". */
  latestVersion: string
  /** When true, users on an older version are blocked until they update. */
  forceUpdate: boolean
  /** Title shown on the prompt. */
  title: string
  /** Body copy shown on the prompt. */
  message: string
  /** App Store link the "Update Now" button opens. */
  appStoreUrl: string
  /** ISO timestamp of the last admin edit. */
  updatedAt?: string
}

const DEFAULTS: AppUpdateSettings = {
  enabled: false,
  latestVersion: "",
  forceUpdate: false,
  title: "Update Available",
  message: "A new version of the app is available with the latest features and fixes.",
  appStoreUrl: "",
}

export default function AdminAppUpdatePage() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<AppUpdateSettings>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, "settings", APP_UPDATE_DOC))
        if (snap.exists()) {
          setSettings({ ...DEFAULTS, ...(snap.data() as Partial<AppUpdateSettings>) })
        }
      } catch (e) {
        console.error("Error loading app-update settings:", e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const persist = async (next: AppUpdateSettings) => {
    await setDoc(doc(db, "settings", APP_UPDATE_DOC), {
      ...next,
      updatedAt: new Date().toISOString(),
    })
  }

  const handleToggleEnabled = async (enabled: boolean) => {
    const previous = settings.enabled
    const next = { ...settings, enabled }
    setSettings(next)
    try {
      await persist(next)
      toast({
        title: enabled ? "Update prompt is live" : "Update prompt off",
        description: enabled
          ? "Users on older versions will see the prompt when they open the app."
          : "No update prompt will be shown in the app.",
      })
    } catch (e: any) {
      setSettings((s) => ({ ...s, enabled: previous }))
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

  const handleSave = async () => {
    if (!settings.latestVersion.trim()) {
      toast({
        title: "Latest version required",
        description: 'Enter the version you just shipped, e.g. "1.3.0".',
        variant: "destructive",
      })
      return
    }
    setSaving(true)
    try {
      await persist(settings)
      toast({ title: "Saved", description: "Update prompt settings updated." })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-navy" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">App Update Prompt</h1>
        <p className="text-navy/60">
          Show a pop-up in the iOS app when you ship a new version — optional (dismissable) or forced
          (blocks the app until they update).
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                In-App Update Prompt
              </CardTitle>
              <CardDescription>
                The app checks this each time it opens and compares the user&apos;s installed version
                against the latest version below.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-navy/10 px-4 py-2">
              <span className="text-sm font-medium text-navy">{settings.enabled ? "On" : "Off"}</span>
              <Switch checked={settings.enabled} onCheckedChange={handleToggleEnabled} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="latestVersion" className="text-sm font-medium text-navy">
                Latest Version
              </Label>
              <Input
                id="latestVersion"
                value={settings.latestVersion}
                onChange={(e) => setSettings({ ...settings, latestVersion: e.target.value })}
                placeholder="e.g. 1.3.0"
              />
              <p className="text-xs text-navy/50">
                The version you just released. Anyone on an older version sees the prompt.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appStoreUrl" className="text-sm font-medium text-navy">
                App Store Link
              </Label>
              <Input
                id="appStoreUrl"
                value={settings.appStoreUrl}
                onChange={(e) => setSettings({ ...settings, appStoreUrl: e.target.value })}
                placeholder="https://apps.apple.com/app/id..."
              />
              <p className="text-xs text-navy/50">Where the &quot;Update Now&quot; button sends them.</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-sm font-medium text-navy">
              Title
            </Label>
            <Input
              id="title"
              value={settings.title}
              onChange={(e) => setSettings({ ...settings, title: e.target.value })}
              placeholder="Update Available"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="message" className="text-sm font-medium text-navy">
              Message
            </Label>
            <Textarea
              id="message"
              rows={3}
              value={settings.message}
              onChange={(e) => setSettings({ ...settings, message: e.target.value })}
              placeholder="What to tell users about the update."
              className="resize-none"
            />
          </div>

          {/* Optional vs forced */}
          <div className="space-y-3 rounded-lg border border-navy/10 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium text-navy">
                  <AlertTriangle className="h-4 w-4" />
                  Force the update
                </p>
                <p className="text-xs text-navy/50">
                  Off = a dismissable pop-up they can skip with &quot;Later&quot;. On = a full-screen
                  block; they can&apos;t use the app until they update.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 rounded-lg border border-navy/10 px-3 py-1.5">
                <span className="text-sm font-medium text-navy">
                  {settings.forceUpdate ? "Forced" : "Optional"}
                </span>
                <Switch
                  checked={settings.forceUpdate}
                  onCheckedChange={(v) => setSettings({ ...settings, forceUpdate: v })}
                />
              </div>
            </div>
            {settings.forceUpdate && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Heads up: with force on, make sure the App Store link is correct and the new version is
                actually live, or users on old versions will be locked out.
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="bg-navy text-cream hover:bg-navy/90">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
