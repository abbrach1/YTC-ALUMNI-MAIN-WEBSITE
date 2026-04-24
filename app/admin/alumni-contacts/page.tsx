"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { Check, X, Trash2, Search, MapPin, Mail, Clock, Users, Phone } from "lucide-react"

interface AlumniSubmission {
  id: string
  name: string
  email: string
  phone?: string
  location: string
  submittedBy?: string
  submittedAt: string
  status: "pending" | "approved" | "rejected"
}

export default function AdminAlumniContactsPage() {
  const [submissions, setSubmissions] = useState<AlumniSubmission[]>([])
  const [filteredSubmissions, setFilteredSubmissions] = useState<AlumniSubmission[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const fetchSubmissions = async () => {
    try {
      const submissionsRef = collection(db, "alumniContactSubmissions")
      const q = query(submissionsRef, orderBy("submittedAt", "desc"))
      const snapshot = await getDocs(q)
      const data: AlumniSubmission[] = []
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as AlumniSubmission)
      })
      setSubmissions(data)
      setFilteredSubmissions(data)
    } catch (error) {
      console.error("Error fetching submissions:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSubmissions()
  }, [])

  useEffect(() => {
    if (searchTerm) {
      const filtered = submissions.filter(
        (s) =>
          s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.location.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredSubmissions(filtered)
    } else {
      setFilteredSubmissions(submissions)
    }
  }, [searchTerm, submissions])

  const handleApprove = async (id: string) => {
    try {
      await updateDoc(doc(db, "alumniContactSubmissions", id), {
        status: "approved",
      })
      toast({
        title: "Approved",
        description: "Contact has been approved and will appear in the directory.",
      })
      fetchSubmissions()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const handleReject = async (id: string) => {
    try {
      await updateDoc(doc(db, "alumniContactSubmissions", id), {
        status: "rejected",
      })
      toast({
        title: "Rejected",
        description: "Contact submission has been rejected.",
      })
      fetchSubmissions()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this submission?")) return
    try {
      await deleteDoc(doc(db, "alumniContactSubmissions", id))
      toast({
        title: "Deleted",
        description: "Submission has been removed.",
      })
      fetchSubmissions()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const pendingCount = submissions.filter((s) => s.status === "pending").length
  const approvedCount = submissions.filter((s) => s.status === "approved").length

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Approved</Badge>
      case "rejected":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Rejected</Badge>
      default:
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pending</Badge>
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Alumni Contact Submissions</h1>
        <p className="text-navy/60">Review and approve alumni contact info for the directory</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-navy">{pendingCount}</p>
                <p className="text-sm text-navy/60">Pending Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-navy">{approvedCount}</p>
                <p className="text-sm text-navy/60">In Directory</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-navy/10 rounded-lg">
                <Users className="h-5 w-5 text-navy" />
              </div>
              <div>
                <p className="text-2xl font-bold text-navy">{submissions.length}</p>
                <p className="text-sm text-navy/60">Total Submissions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle>All Submissions</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/40" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredSubmissions.length === 0 ? (
            <div className="text-center py-12 text-navy/50">
              <Users className="mx-auto h-10 w-10 mb-3 opacity-50" />
              <p>No submissions yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSubmissions.map((submission) => (
                <div
                  key={submission.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-navy/10 rounded-lg bg-white"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-navy">{submission.name}</h3>
                      {getStatusBadge(submission.status)}
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-navy/60">
                      {submission.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3.5 w-3.5" />
                          {submission.email}
                        </span>
                      )}
                      {submission.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5" />
                          {submission.phone}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {submission.location}
                      </span>
                    </div>
                    <p className="text-xs text-navy/40 mt-1">
                      Submitted {new Date(submission.submittedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {submission.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 border-green-200 hover:bg-green-50"
                          onClick={() => handleApprove(submission.id)}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => handleReject(submission.id)}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-navy/40 hover:text-red-600"
                      onClick={() => handleDelete(submission.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
