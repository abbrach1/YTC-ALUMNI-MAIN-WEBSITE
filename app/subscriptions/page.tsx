"use client"

import { useState, useEffect } from "react"
import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-context"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Bell, Loader2, Save } from "lucide-react"
import { useRouter } from "next/navigation"

export default function SubscriptionsPage() {
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const router = useRouter()

  const [rebbeimOptions, setRebbeimOptions] = useState<string[]>([])
  const [tagsOptions, setTagsOptions] = useState<string[]>([])
  const [selectedRebbeim, setSelectedRebbeim] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push("/login")
      return
    }

    const fetchData = async () => {
      try {
        const [optionsSnap, subSnap] = await Promise.all([
          getDoc(doc(db, "settings", "shiurOptions")),
          getDoc(doc(db, "subscriptions", user.uid)),
        ])

        if (optionsSnap.exists()) {
          const data = optionsSnap.data()
          setRebbeimOptions(data.rebbeim || [])
          setTagsOptions(data.tags || [])
        }

        if (subSnap.exists()) {
          const data = subSnap.data()
          setSelectedRebbeim(data.rebbeim || [])
          setSelectedTags(data.tags || [])
        }
      } catch (error) {
        console.error("Error fetching subscription data:", error)
        toast({
          title: "Error",
          description: "Could not load your subscriptions",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user, authLoading, router, toast])

  const toggleRebbe = (rebbe: string) => {
    setSelectedRebbeim((prev) =>
      prev.includes(rebbe) ? prev.filter((r) => r !== rebbe) : [...prev, rebbe],
    )
  }

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )
  }

  const handleSave = async () => {
    if (!user || !user.email) return
    setSaving(true)
    try {
      await setDoc(doc(db, "subscriptions", user.uid), {
        userId: user.uid,
        email: user.email,
        rebbeim: selectedRebbeim,
        tags: selectedTags,
        updatedAt: new Date().toISOString(),
      })
      toast({
        title: "Subscriptions saved",
        description:
          selectedRebbeim.length + selectedTags.length === 0
            ? "You won't receive any new shiur emails."
            : "You'll be emailed when matching shiurim are uploaded.",
      })
    } catch (error: any) {
      console.error("Error saving subscriptions:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to save subscriptions",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-cream py-12 px-4">
          <div className="max-w-2xl mx-auto flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-navy" />
          </div>
        </div>
      </>
    )
  }

  const totalSelected = selectedRebbeim.length + selectedTags.length

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-cream py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <Card className="border-gold/20 bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="text-navy flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Shiur Email Subscriptions
              </CardTitle>
              <p className="text-sm text-navy/60 mt-2">
                Pick the rebbeim and topics you want to follow. We'll email you at{" "}
                <span className="font-medium text-navy">{user?.email}</span> whenever a matching
                shiur is uploaded.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-navy font-semibold">
                      Rebbeim ({selectedRebbeim.length} selected)
                    </Label>
                    {selectedRebbeim.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedRebbeim([])}
                        className="text-xs text-navy/60 hover:text-navy underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  {rebbeimOptions.length === 0 ? (
                    <p className="text-sm text-navy/50 italic">No rebbeim available yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {rebbeimOptions.map((rebbe) => {
                        const active = selectedRebbeim.includes(rebbe)
                        return (
                          <button
                            key={rebbe}
                            type="button"
                            onClick={() => toggleRebbe(rebbe)}
                            className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                              active
                                ? "bg-navy text-cream"
                                : "bg-cream border border-gold/30 text-navy hover:border-gold"
                            }`}
                          >
                            {rebbe}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-navy font-semibold">
                      Topics ({selectedTags.length} selected)
                    </Label>
                    {selectedTags.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedTags([])}
                        className="text-xs text-navy/60 hover:text-navy underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  {tagsOptions.length === 0 ? (
                    <p className="text-sm text-navy/50 italic">No topics available yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {tagsOptions.map((tag) => {
                        const active = selectedTags.includes(tag)
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(tag)}
                            className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                              active
                                ? "bg-navy text-cream"
                                : "bg-cream border border-gold/30 text-navy hover:border-gold"
                            }`}
                          >
                            {tag}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-navy/10 flex items-center justify-between gap-3">
                  <p className="text-xs text-navy/60">
                    {totalSelected === 0
                      ? "No subscriptions selected — you won't receive emails."
                      : `${totalSelected} subscription${totalSelected === 1 ? "" : "s"} selected.`}
                  </p>
                  <Button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-navy text-cream hover:bg-navy/90"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Subscriptions
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
