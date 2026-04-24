"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { doc, getDoc, setDoc, collection, getDocs, query, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"

interface Shiur {
  id: string
  title: string
  rebbe: string
  date: string
}

export default function SettingsPage() {
  const [formData, setFormData] = useState({
    rebbe: "",
    title: "",
    date: "",
    time: "",
    zoomLink: "",
    description: "",
  })
  const [featuredShiur, setFeaturedShiur] = useState({
    enabled: false,
    shiurId: "",
  })
  const [officePins, setOfficePins] = useState<{ name: string; pin: string }[]>([])
  const [newPinName, setNewPinName] = useState("")
  const [newPin, setNewPin] = useState("")
  const [shiurim, setShiurim] = useState<Shiur[]>([])
  const [loading, setLoading] = useState(false)
  const [featuredLoading, setFeaturedLoading] = useState(false)
  const [pinLoading, setPinLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchUpcomingShiur()
    fetchFeaturedShiur()
    fetchShiurim()
    fetchOfficePin()
  }, [])

  const fetchUpcomingShiur = async () => {
    const docRef = doc(db, "settings", "upcomingShiur")
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) {
      const data = docSnap.data()
      setFormData({
        rebbe: data.rebbe || "",
        title: data.title || "",
        date: data.date || "",
        time: data.time || "",
        zoomLink: data.zoomLink || "",
        description: data.description || "",
      })
    }
  }

  const fetchFeaturedShiur = async () => {
    const docRef = doc(db, "settings", "featuredShiur")
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) {
      const data = docSnap.data()
      setFeaturedShiur({
        enabled: data.enabled || false,
        shiurId: data.shiurId || "",
      })
    }
  }

  const fetchOfficePin = async () => {
    const docRef = doc(db, "settings", "officePins")
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) {
      setOfficePins(docSnap.data().pins || [])
    }
  }

  const fetchShiurim = async () => {
    const shiurimRef = collection(db, "shiurim")
    const q = query(shiurimRef, orderBy("date", "desc"))
    const querySnapshot = await getDocs(q)
    const shiurimData: Shiur[] = []
    querySnapshot.forEach((doc) => {
      const data = doc.data()
      shiurimData.push({ id: doc.id, title: data.title, rebbe: data.rebbe, date: data.date })
    })
    setShiurim(shiurimData)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await setDoc(doc(db, "settings", "upcomingShiur"), formData)
      toast({ title: "Settings updated successfully" })
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleFeaturedSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFeaturedLoading(true)

    try {
      await setDoc(doc(db, "settings", "featuredShiur"), featuredShiur)
      toast({ title: "Featured shiur updated successfully" })
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setFeaturedLoading(false)
    }
  }

  const handleAddPin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate 4-digit PIN
    if (!/^\d{4}$/.test(newPin)) {
      toast({ 
        title: "Invalid PIN", 
        description: "PIN must be exactly 4 digits", 
        variant: "destructive" 
      })
      return
    }

    if (!newPinName.trim()) {
      toast({ 
        title: "Name required", 
        description: "Please enter a name for this PIN", 
        variant: "destructive" 
      })
      return
    }

    // Check for duplicate PINs
    if (officePins.some(p => p.pin === newPin)) {
      toast({ 
        title: "Duplicate PIN", 
        description: "This PIN already exists", 
        variant: "destructive" 
      })
      return
    }

    setPinLoading(true)

    try {
      const updatedPins = [...officePins, { name: newPinName.trim(), pin: newPin }]
      await setDoc(doc(db, "settings", "officePins"), { pins: updatedPins })
      setOfficePins(updatedPins)
      setNewPinName("")
      setNewPin("")
      toast({ title: "Office PIN added successfully" })
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setPinLoading(false)
    }
  }

  const handleDeletePin = async (pinToDelete: string) => {
    setPinLoading(true)
    try {
      const updatedPins = officePins.filter(p => p.pin !== pinToDelete)
      await setDoc(doc(db, "settings", "officePins"), { pins: updatedPins })
      setOfficePins(updatedPins)
      toast({ title: "PIN deleted successfully" })
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setPinLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-navy mb-2">Settings</h1>
        <p className="text-navy/70">Manage site-wide settings and upcoming shiur</p>
      </div>

      <Card className="border-gold/20 bg-white shadow-lg">
        <CardHeader>
          <CardTitle className="text-navy">Upcoming Shiur (Home Page)</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Shiur Title *</Label>
              <Input
                id="title"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rebbe">Rebbe *</Label>
                <Input
                  id="rebbe"
                  required
                  value={formData.rebbe}
                  onChange={(e) => setFormData({ ...formData, rebbe: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="time">Time *</Label>
                <Input
                  id="time"
                  required
                  placeholder="e.g., 8:00 PM EST"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  required
                  placeholder="e.g., Sunday, January 15, 2025"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="zoomLink">Zoom Link *</Label>
                <Input
                  id="zoomLink"
                  type="url"
                  required
                  placeholder="https://zoom.us/j/..."
                  value={formData.zoomLink}
                  onChange={(e) => setFormData({ ...formData, zoomLink: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                rows={3}
                placeholder="Brief description of the shiur topic..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full bg-navy text-cream hover:bg-navy/90">
              {loading ? "Saving..." : "Save Settings"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-gold/20 bg-white shadow-lg">
        <CardHeader>
          <CardTitle className="text-navy">Featured Shiur (Home Page)</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleFeaturedSubmit} className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="featured-enabled">Enable Featured Shiur</Label>
                <p className="text-sm text-muted-foreground">
                  Display a featured shiur prominently on the home page
                </p>
              </div>
              <Switch
                id="featured-enabled"
                checked={featuredShiur.enabled}
                onCheckedChange={(checked) => setFeaturedShiur({ ...featuredShiur, enabled: checked })}
              />
            </div>

            {featuredShiur.enabled && (
              <div className="space-y-2">
                <Label htmlFor="featured-shiur">Select Shiur</Label>
                <Select
                  value={featuredShiur.shiurId}
                  onValueChange={(value) => setFeaturedShiur({ ...featuredShiur, shiurId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a shiur to feature" />
                  </SelectTrigger>
                  <SelectContent>
                    {shiurim.map((shiur) => (
                      <SelectItem key={shiur.id} value={shiur.id}>
                        {shiur.title} - {shiur.rebbe} ({new Date(shiur.date).toLocaleDateString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button type="submit" disabled={featuredLoading} className="w-full bg-navy text-cream hover:bg-navy/90">
              {featuredLoading ? "Saving..." : "Save Featured Shiur"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-gold/20 bg-white shadow-lg">
        <CardHeader>
          <CardTitle className="text-navy">Office Portal Access</CardTitle>
          <p className="text-sm text-muted-foreground">
            Manage multiple PINs for different office staff members to access the /office portal
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleAddPin} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pin-name">Name/Label</Label>
                <Input
                  id="pin-name"
                  type="text"
                  placeholder="e.g., Sarah - Secretary"
                  value={newPinName}
                  onChange={(e) => setNewPinName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-pin">4-Digit PIN</Label>
                <Input
                  id="new-pin"
                  type="text"
                  maxLength={4}
                  pattern="\d{4}"
                  placeholder="Enter 4-digit PIN"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                />
              </div>
            </div>

            <Button type="submit" disabled={pinLoading} className="w-full bg-navy text-cream hover:bg-navy/90">
              {pinLoading ? "Adding..." : "Add Office PIN"}
            </Button>
          </form>

          {officePins.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-navy/10">
              <h4 className="font-semibold text-navy">Active PINs ({officePins.length})</h4>
              {officePins.map((pinData) => (
                <div
                  key={pinData.pin}
                  className="flex items-center justify-between p-3 bg-cream/50 rounded-lg border border-navy/10"
                >
                  <div>
                    <p className="font-medium text-navy">{pinData.name}</p>
                    <p className="text-sm text-navy/50">PIN: {"•".repeat(4)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeletePin(pinData.pin)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
