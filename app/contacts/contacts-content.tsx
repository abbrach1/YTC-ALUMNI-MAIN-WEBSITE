"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { AuthGuard } from "@/components/auth-guard"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Mail, Phone, Users, BookOpen, Send, ChevronDown, MapPin } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { collection, getDocs, addDoc, doc, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { getUserFriendlyError } from "@/lib/utils"

interface Rebbe {
  id: string
  name: string
  title: string
  email?: string
  phone?: string
  photoUrl?: string
}

interface Alumni {
  id: string
  name: string
  email?: string
  phone?: string
  location: string
  submittedAt: string
  status: "pending" | "approved" | "rejected"
}

interface Rebbe {
  id: string
  name: string
  title: string
  email?: string
  phone?: string
  photoUrl?: string
}

export default function ContactsContent() {
  const [alumni, setAlumni] = useState<Alumni[]>([])
  const [filteredAlumni, setFilteredAlumni] = useState<Alumni[]>([])
  const [displayedAlumni, setDisplayedAlumni] = useState<Alumni[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState<"name" | "graduationYear">("name")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const initialTab = searchParams?.get("tab") === "rebbeim" ? "rebbeim" : "alumni"
  const [activeTab, setActiveTab] = useState<"rebbeim" | "alumni">(initialTab)
  const [rebbeim, setRebbeim] = useState<Rebbe[]>([])
  const [filteredRebbeim, setFilteredRebbeim] = useState<Rebbe[]>([])
  const [rebbeimSearch, setRebbeimSearch] = useState("")
  const [rebbeimLoading, setRebbeimLoading] = useState(true)
  const [expandedRebbeId, setExpandedRebbeId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [userRecord, setUserRecord] = useState<any>(null)
  const [hasExistingRecord, setHasExistingRecord] = useState(false)
  const ITEMS_PER_PAGE = 20
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    locationType: "",
    locationOther: "",
  })
  const [submitting, setSubmitting] = useState(false)
  const { user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    const fetchData = async () => {
      const alumniRef = collection(db, "alumniContactSubmissions")
      const alumniSnapshot = await getDocs(alumniRef)
      const alumniData: Alumni[] = []
      let foundUserRecord = false
      
      alumniSnapshot.forEach((doc) => {
        const data = doc.data() as Alumni
        
        // Check if this is the current user's record
        if (user?.email && data.email === user.email) {
          setUserRecord({ id: doc.id, ...data })
          setHasExistingRecord(true)
          foundUserRecord = true
        }
        
        // Only show approved alumni
        if (data.status === "approved") {
          alumniData.push({ id: doc.id, ...data })
        }
      })
      
      if (!foundUserRecord) {
        setHasExistingRecord(false)
        setUserRecord(null)
      }
      
      setAlumni(alumniData)
      setFilteredAlumni(alumniData)
    }
    fetchData()
  }, [user])

  // Fetch Rebbeim directory
  useEffect(() => {
    const fetchRebbeim = async () => {
      try {
        setRebbeimLoading(true)
        const snapshot = await getDocs(collection(db, "rebbeim"))
        const data: Rebbe[] = []
        snapshot.forEach((d) => {
          data.push({ id: d.id, ...(d.data() as Omit<Rebbe, "id">) })
        })
        data.sort((a, b) => a.name.localeCompare(b.name))
        setRebbeim(data)
        setFilteredRebbeim(data)
      } catch (error) {
        console.error("Error fetching rebbeim:", error)
      } finally {
        setRebbeimLoading(false)
      }
    }
    fetchRebbeim()
  }, [])

  // Filter Rebbeim by search term
  useEffect(() => {
    if (!rebbeimSearch.trim()) {
      setFilteredRebbeim(rebbeim)
      return
    }
    const term = rebbeimSearch.toLowerCase()
    setFilteredRebbeim(
      rebbeim.filter(
        (r) =>
          r.name.toLowerCase().includes(term) ||
          r.title?.toLowerCase().includes(term) ||
          r.email?.toLowerCase().includes(term),
      ),
    )
  }, [rebbeimSearch, rebbeim])

  useEffect(() => {
    let filtered = [...alumni]
    
    if (searchTerm) {
      filtered = filtered.filter(
        (a) =>
          a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          a.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          a.location.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    
    if (sortBy === "name") {
      filtered.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sortBy === "graduationYear") {
      // Sort by submitted date as fallback
      filtered.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    }
    
    setFilteredAlumni(filtered)
    setPage(1)
    setDisplayedAlumni(filtered.slice(0, ITEMS_PER_PAGE))
    setHasMore(filtered.length > ITEMS_PER_PAGE)
  }, [searchTerm, sortBy, alumni])

  const loadMore = () => {
    if (loading || !hasMore) return
    
    setLoading(true)
    const nextPage = page + 1
    const startIndex = page * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    const newItems = filteredAlumni.slice(startIndex, endIndex)
    
    setDisplayedAlumni([...displayedAlumni, ...newItems])
    setPage(nextPage)
    setHasMore(endIndex < filteredAlumni.length)
    setLoading(false)
  }

  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.offsetHeight - 100
      ) {
        loadMore()
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [loading, hasMore, page, displayedAlumni, filteredAlumni])

  const openModal = () => {
    if (hasExistingRecord && userRecord) {
      // Pre-fill form with existing data
      const locationParts = userRecord.location || ""
      const isOther = locationParts !== "Eretz Yisroel" && locationParts !== "Chutz Laaretz"
      
      setFormData({
        name: userRecord.name || "",
        email: userRecord.email || "",
        phone: userRecord.phone || "",
        locationType: isOther ? "Other" : locationParts,
        locationOther: isOther ? locationParts : "",
      })
    } else {
      // Reset form for new submission
      setFormData({
        name: "",
        email: user?.email || "",
        phone: "",
        locationType: "",
        locationOther: "",
      })
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const locationValue = formData.locationType === "Other" ? formData.locationOther : formData.locationType
      
      if (hasExistingRecord && userRecord) {
        // Update existing record
        await setDoc(doc(db, "alumniContactSubmissions", userRecord.id), {
          name: formData.name,
          email: formData.email || null,
          phone: formData.phone || null,
          location: locationValue,
          submittedBy: user?.email,
          submittedAt: userRecord.submittedAt, // Keep original submission date
          updatedAt: new Date().toISOString(),
          status: userRecord.status, // Keep existing status
        })

        toast({
          title: "Success!",
          description: "Your information has been updated.",
        })
      } else {
        // Create new record
        await addDoc(collection(db, "alumniContactSubmissions"), {
          name: formData.name,
          email: formData.email || null,
          phone: formData.phone || null,
          location: locationValue,
          submittedBy: user?.email,
          submittedAt: new Date().toISOString(),
          status: "pending",
        })

        await fetch("/api/send-contact-update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: formData.name,
            email: formData.email || "Not provided",
            phone: formData.phone || "Not provided",
            city: locationValue,
          }),
        })

        toast({
          title: "Success!",
          description: "Your information has been submitted for review.",
        })
      }

      // Close modal and reset form
      setIsModalOpen(false)
      setFormData({
        name: "",
        email: "",
        phone: "",
        locationType: "",
        locationOther: "",
      })
      
      // Refresh data to show updated info
      const alumniRef = collection(db, "alumniContactSubmissions")
      const alumniSnapshot = await getDocs(alumniRef)
      const alumniData: Alumni[] = []
      alumniSnapshot.forEach((doc) => {
        const data = doc.data() as Alumni
        if (data.status === "approved") {
          alumniData.push({ id: doc.id, ...data })
        }
      })
      setAlumni(alumniData)
      setFilteredAlumni(alumniData)
    } catch (error: any) {
      toast({
        title: "Unable to submit",
        description: getUserFriendlyError(error),
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-cream">
        <Navbar />

        <div className="relative bg-navy">
          <div className="absolute inset-0 bg-gradient-to-br from-navy via-navy to-navy-light opacity-90" />
          <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-3xl md:text-4xl font-bold text-cream mb-3">Directory</h1>
              <p className="text-cream/70 max-w-xl mx-auto">Connect with Rebbeim and fellow alumni</p>
            </div>
          </div>
        </div>

        <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex justify-center mb-8">
            <div className="inline-flex bg-white rounded-lg p-1 shadow border border-navy/10">
              <button
                onClick={() => setActiveTab("rebbeim")}
                className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === "rebbeim" ? "bg-navy text-cream" : "text-navy/60 hover:text-navy"
                }`}
              >
                Rebbeim
              </button>
              <button
                onClick={() => setActiveTab("alumni")}
                className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === "alumni" ? "bg-navy text-cream" : "text-navy/60 hover:text-navy"
                }`}
              >
                Alumni
              </button>
            </div>
          </div>

          {activeTab === "rebbeim" && (
            <section className="mb-12">
              <div className="mb-6">
                <div className="relative">
                  <Input
                    placeholder="Search Rebbeim by name, title, or email..."
                    value={rebbeimSearch}
                    onChange={(e) => setRebbeimSearch(e.target.value)}
                    className="pl-10 border-navy/20"
                  />
                  <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy/40" />
                </div>
                <div className="mt-3 text-sm text-navy/60">
                  {rebbeimLoading
                    ? "Loading..."
                    : `${filteredRebbeim.length} ${filteredRebbeim.length === 1 ? "Rebbe" : "Rebbeim"}`}
                </div>
              </div>

              <div className="space-y-3">
                {rebbeimLoading ? (
                  <div className="py-12 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-navy" />
                    <p className="text-navy/60 mt-2">Loading Rebbeim...</p>
                  </div>
                ) : filteredRebbeim.length === 0 ? (
                  <Card className="border border-navy/10 bg-white">
                    <CardContent className="py-12 px-6 text-center">
                      <BookOpen className="mx-auto h-12 w-12 mb-4 text-navy/30" />
                      <h3 className="text-lg font-semibold text-navy mb-2">No Rebbeim found</h3>
                      <p className="text-navy/60 max-w-md mx-auto">
                        {rebbeimSearch
                          ? "Try adjusting your search."
                          : "The Rebbeim directory is currently empty."}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  filteredRebbeim.map((rebbe) => {
                    const initials = `${rebbe.name.split(" ")[0]?.[0] || ""}${rebbe.name.split(" ").slice(-1)[0]?.[0] || ""}`
                    const isExpanded = expandedRebbeId === rebbe.id
                    const hasContact = rebbe.email || rebbe.phone
                    return (
                      <Card
                        key={rebbe.id}
                        className={`border border-navy/10 bg-white transition-shadow ${
                          hasContact ? "hover:shadow-md cursor-pointer" : ""
                        }`}
                        onClick={() => {
                          if (hasContact) {
                            setExpandedRebbeId(isExpanded ? null : rebbe.id)
                          }
                        }}
                      >
                        <CardContent className="p-5">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-12 w-12 border-2 border-gold/30">
                                  {rebbe.photoUrl && <AvatarImage src={rebbe.photoUrl} alt={rebbe.name} />}
                                  <AvatarFallback className="bg-navy/5 text-navy font-semibold">
                                    {initials || <BookOpen className="h-5 w-5" />}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <h3 className="font-semibold text-navy truncate">{rebbe.name}</h3>
                                  {rebbe.title && (
                                    <p className="text-sm text-navy/60 truncate">{rebbe.title}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                            {hasContact && (
                              <ChevronDown
                                className={`h-5 w-5 text-navy/40 transition-transform flex-shrink-0 ml-2 ${
                                  isExpanded ? "rotate-180" : ""
                                }`}
                              />
                            )}
                          </div>

                          {isExpanded && hasContact && (
                            <div className="mt-5 pt-5 border-t border-navy/10 space-y-3">
                              {rebbe.email && (
                                <div className="flex items-start gap-3">
                                  <Mail className="h-4 w-4 text-navy/40 mt-0.5 flex-shrink-0" />
                                  <a
                                    href={`mailto:${rebbe.email}`}
                                    className="text-navy hover:text-gold transition-colors break-all"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {rebbe.email}
                                  </a>
                                </div>
                              )}
                              {rebbe.phone && (
                                <div className="flex items-start gap-3">
                                  <Phone className="h-4 w-4 text-navy/40 mt-0.5 flex-shrink-0" />
                                  <a
                                    href={`tel:${rebbe.phone}`}
                                    className="text-navy hover:text-gold transition-colors"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {rebbe.phone}
                                  </a>
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })
                )}
              </div>
            </section>
          )}

          {activeTab === "alumni" && (
            <section className="mb-12">
              <div className="mb-6 space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Input
                      placeholder="Search by name, email, year, or location..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 border-navy/20"
                    />
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy/40" />
                  </div>
                  <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                    <SelectTrigger className="w-full sm:w-[200px] border-navy/20">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Sort by Name</SelectItem>
                      <SelectItem value="graduationYear">Sort by Recent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-end text-sm text-navy/60">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={openModal}
                    className="text-navy hover:text-navy/80"
                  >
                    {hasExistingRecord ? "Edit Your Info" : "Add Your Info"}
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {displayedAlumni.length === 0 ? (
                  <Card className="border border-navy/10 bg-white">
                    <CardContent className="py-12 px-6 text-center">
                      <Users className="mx-auto h-12 w-12 mb-4 text-navy/30" />
                      <h3 className="text-lg font-semibold text-navy mb-2">No alumni found</h3>
                      <p className="text-navy/60 mb-6 max-w-md mx-auto">
                        {searchTerm ? "Try adjusting your search" : "Be the first to add your information"}
                      </p>
                      <Button 
                        onClick={openModal}
                        className="bg-navy text-cream hover:bg-navy/90"
                      >
                        {hasExistingRecord ? "Edit Your Info" : "Add Your Info"}
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {displayedAlumni.map((alumnus) => (
                    <Card 
                      key={alumnus.id} 
                      className="border border-navy/10 bg-white hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => setExpandedId(expandedId === alumnus.id ? null : alumnus.id)}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10 border-2 border-gold/20">
                                <AvatarFallback className="bg-navy/5 text-navy font-semibold">
                                  {alumnus.name.split(' ')[0]?.[0]}{alumnus.name.split(' ').slice(-1)[0]?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <h3 className="font-semibold text-navy">
                                  {alumnus.name}
                                </h3>
                                <div className="flex items-center gap-3 text-sm text-navy/60">
                                  {alumnus.location && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      {alumnus.location}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          <ChevronDown 
                            className={`h-5 w-5 text-navy/40 transition-transform ${
                              expandedId === alumnus.id ? 'rotate-180' : ''
                            }`}
                          />
                        </div>

                        {expandedId === alumnus.id && (
                          <div className="mt-5 pt-5 border-t border-navy/10 space-y-3">
                            {alumnus.email && (
                              <div className="flex items-start gap-3">
                                <Mail className="h-4 w-4 text-navy/40 mt-0.5 flex-shrink-0" />
                                <a 
                                  href={`mailto:${alumnus.email}`}
                                  className="text-navy hover:text-gold transition-colors break-all"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {alumnus.email}
                                </a>
                              </div>
                            )}
                            {alumnus.phone && (
                              <div className="flex items-start gap-3">
                                <Phone className="h-4 w-4 text-navy/40 mt-0.5 flex-shrink-0" />
                                <a 
                                  href={`tel:${alumnus.phone}`}
                                  className="text-navy hover:text-gold transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {alumnus.phone}
                                </a>
                              </div>
                            )}
                            {alumnus.location && (
                              <div className="flex items-start gap-3">
                                <MapPin className="h-4 w-4 text-navy/40 mt-0.5 flex-shrink-0" />
                                <p className="text-navy/70 text-sm">{alumnus.location}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  {loading && (
                    <div className="py-8 text-center">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-navy"></div>
                      <p className="text-navy/60 mt-2">Loading more...</p>
                    </div>
                  )}
                  {!hasMore && displayedAlumni.length > 0 && (
                    <div className="py-6 text-center text-navy/50 text-sm">
                      You've reached the end of the directory
                    </div>
                  )}
                </>
                )}
              </div>
            </section>
          )}

          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-white to-cream/30">
              <DialogHeader>
                <DialogTitle className="text-2xl font-semibold text-navy">
                  {hasExistingRecord ? "Edit Your Contact Info" : "Add Your Contact Info"}
                </DialogTitle>
                <DialogDescription className="text-navy/70">
                  {hasExistingRecord 
                    ? "Update your details in the alumni directory." 
                    : "Submit your details to be listed in the alumni directory."}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-navy font-medium">
                      Full Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="name"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="border-navy/20 bg-white/70 focus:bg-white transition-colors"
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-navy font-medium">
                      Email <span className="text-navy/50">(Optional)</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="border-navy/20 bg-white/70 focus:bg-white transition-colors"
                      placeholder="your.email@example.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-navy font-medium">
                      Phone Number <span className="text-navy/50">(Optional)</span>
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="border-navy/20 bg-white/70 focus:bg-white transition-colors"
                      placeholder="(555) 123-4567"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location" className="text-navy font-medium">
                      Current Location <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={formData.locationType}
                      onValueChange={(value) => setFormData({ ...formData, locationType: value, locationOther: value !== "Other" ? "" : formData.locationOther })}
                      required
                    >
                      <SelectTrigger className="border-navy/20 bg-white/70 focus:bg-white transition-colors">
                        <SelectValue placeholder="Select your location" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Eretz Yisroel">Eretz Yisroel</SelectItem>
                        <SelectItem value="Chutz Laaretz">Chutz Laaretz</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.locationType === "Other" && (
                    <div className="space-y-2">
                      <Label htmlFor="locationOther" className="text-navy font-medium">
                        Please specify location <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="locationOther"
                        required
                        value={formData.locationOther}
                        onChange={(e) => setFormData({ ...formData, locationOther: e.target.value })}
                        className="border-navy/20 bg-white/70 focus:bg-white transition-colors"
                        placeholder="Enter your location"
                      />
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-navy text-cream hover:bg-navy/90 py-6 text-base font-medium shadow-md hover:shadow-lg transition-all"
                  >
                    {submitting ? "Submitting..." : "Submit My Info"}
                    <Send className="ml-2 h-5 w-5" />
                  </Button>
                </form>
              </div>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </AuthGuard>
  )
}
