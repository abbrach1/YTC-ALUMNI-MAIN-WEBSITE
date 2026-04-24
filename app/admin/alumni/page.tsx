"use client"

import { Suspense } from "react"
import type React from "react"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2, Upload, Download, Search, Users, Mail, Pencil, FileSpreadsheet } from "lucide-react"
import * as XLSX from "xlsx"
import { collection, getDocs, setDoc, deleteDoc, doc, writeBatch } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface AlumniRecord {
  email: string
  firstName: string
  lastName: string
  fullName: string
  graduationYear?: string
  hebrewName?: string
  city?: string
  state?: string
  phone?: string
  notes?: string
  addedAt: string
}

interface ApprovedEmail {
  email: string
  firstName?: string
  lastName?: string
  fullName?: string
  graduationYear?: string
  notes?: string
}

function AlumniManagementContent() {
  const [alumni, setAlumni] = useState<AlumniRecord[]>([])
  const [approvedEmails, setApprovedEmails] = useState<ApprovedEmail[]>([])
  const [filteredAlumni, setFilteredAlumni] = useState<AlumniRecord[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const [showExcelImportDialog, setShowExcelImportDialog] = useState(false)
  const [excelPreview, setExcelPreview] = useState<ApprovedEmail[]>([])
  const [csvText, setCsvText] = useState("")
  const [importPreview, setImportPreview] = useState<AlumniRecord[]>([])
  const [editingAlumni, setEditingAlumni] = useState<AlumniRecord | null>(null)

  const [email, setEmail] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [graduationYear, setGraduationYear] = useState("")
  const [hebrewName, setHebrewName] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [phone, setPhone] = useState("")
  const [notes, setNotes] = useState("")

  const { toast } = useToast()

  useEffect(() => {
    fetchAlumni()
    fetchApprovedEmails()
  }, [])

  useEffect(() => {
    if (searchQuery) {
      const filtered = alumni.filter(
        (a) =>
          a.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.graduationYear?.includes(searchQuery),
      )
      setFilteredAlumni(filtered)
    } else {
      setFilteredAlumni(alumni)
    }
  }, [searchQuery, alumni])

  const fetchAlumni = async () => {
    const querySnapshot = await getDocs(collection(db, "alumniDatabase"))
    const records: AlumniRecord[] = []
    querySnapshot.forEach((doc) => {
      records.push(doc.data() as AlumniRecord)
    })
    records.sort((a, b) => a.fullName.localeCompare(b.fullName))
    setAlumni(records)
    setFilteredAlumni(records)
  }

  const fetchApprovedEmails = async () => {
    const querySnapshot = await getDocs(collection(db, "approvedEmails"))
    const emails: ApprovedEmail[] = []
    querySnapshot.forEach((doc) => {
      emails.push({ email: doc.id, ...doc.data() } as ApprovedEmail)
    })
    setApprovedEmails(emails)
  }

  const resetForm = () => {
    setEmail("")
    setFirstName("")
    setLastName("")
    setGraduationYear("")
    setHebrewName("")
    setCity("")
    setState("")
    setPhone("")
    setNotes("")
    setEditingAlumni(null)
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !firstName || !lastName) {
      toast({ title: "Error", description: "Email, first name, and last name are required", variant: "destructive" })
      return
    }

    try {
      const normalizedEmail = email.toLowerCase().trim()
      const fullName = `${firstName} ${lastName}`.trim()

      const record: AlumniRecord = {
        email: normalizedEmail,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        fullName,
        graduationYear: graduationYear.trim() || undefined,
        hebrewName: hebrewName.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
        addedAt: editingAlumni?.addedAt || new Date().toISOString(),
      }

      await setDoc(doc(db, "alumniDatabase", normalizedEmail), record)

      toast({ title: "Success", description: editingAlumni ? "Alumni updated" : "Alumni added to database" })
      setShowAddDialog(false)
      resetForm()
      fetchAlumni()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const handleEdit = (alumnus: AlumniRecord) => {
    setEditingAlumni(alumnus)
    setEmail(alumnus.email)
    setFirstName(alumnus.firstName)
    setLastName(alumnus.lastName)
    setGraduationYear(alumnus.graduationYear || "")
    setHebrewName(alumnus.hebrewName || "")
    setCity(alumnus.city || "")
    setState(alumnus.state || "")
    setPhone(alumnus.phone || "")
    setNotes(alumnus.notes || "")
    setShowAddDialog(true)
  }

  const handleDelete = async (email: string, fullName: string) => {
    if (!confirm(`Remove ${fullName} from the database?`)) return

    try {
      await deleteDoc(doc(db, "alumniDatabase", email))
      toast({ title: "Success", description: "Alumni removed from database" })
      fetchAlumni()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const handleApproveEmail = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email) return

    try {
      const normalizedEmail = email.toLowerCase().trim()
      const fullName = firstName && lastName ? `${firstName} ${lastName}` : ""

      await setDoc(doc(db, "approvedEmails", normalizedEmail), {
        email: normalizedEmail,
        firstName: firstName || "",
        lastName: lastName || "",
        fullName: fullName,
        graduationYear: graduationYear || "",
        notes: notes || "",
        addedAt: new Date().toISOString(),
      })

      toast({ title: "Email approved successfully" })
      setShowApproveDialog(false)
      resetForm()
      fetchApprovedEmails()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const handleDeleteApproved = async (email: string) => {
    if (!confirm(`Remove access for ${email}?`)) return

    try {
      await deleteDoc(doc(db, "approvedEmails", email))
      toast({ title: "Email removed successfully" })
      fetchApprovedEmails()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const handleExcelFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: "array" })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][]

        const records: ApprovedEmail[] = []
        // Skip header row if it exists, start from row 1
        const startRow = jsonData[0]?.[0]?.toLowerCase?.() === "first name" || 
                         jsonData[0]?.[0]?.toLowerCase?.() === "firstname" ? 1 : 0

        for (let i = startRow; i < jsonData.length; i++) {
          const row = jsonData[i]
          if (!row || row.length < 3) continue

          const firstName = String(row[0] || "").trim()
          const lastName = String(row[1] || "").trim()
          const email = String(row[2] || "").trim().toLowerCase()

          if (email && email.includes("@")) {
            records.push({
              email,
              firstName,
              lastName,
              fullName: `${firstName} ${lastName}`.trim(),
            })
          }
        }

        if (records.length === 0) {
          toast({ 
            title: "Error", 
            description: "No valid emails found. Ensure Column A is First Name, B is Last Name, C is Email", 
            variant: "destructive" 
          })
          return
        }

        setExcelPreview(records)
        toast({ title: `Found ${records.length} emails to import` })
      } catch (error: any) {
        toast({ title: "Error", description: "Failed to parse Excel file: " + error.message, variant: "destructive" })
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleExcelImport = async () => {
    if (excelPreview.length === 0) return

    try {
      const batch = writeBatch(db)

      excelPreview.forEach((record) => {
        const docRef = doc(db, "approvedEmails", record.email)
        batch.set(docRef, {
          email: record.email,
          firstName: record.firstName || "",
          lastName: record.lastName || "",
          fullName: record.fullName || "",
          addedAt: new Date().toISOString(),
        })
      })

      await batch.commit()

      toast({ title: "Success", description: `Imported ${excelPreview.length} approved emails` })
      setShowExcelImportDialog(false)
      setExcelPreview([])
      fetchApprovedEmails()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const parseCSV = (csvContent: string): AlumniRecord[] => {
    const lines = csvContent.trim().split("\n")
    if (lines.length < 2) return []

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())
    const records: AlumniRecord[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim())
      const record: any = {}

      headers.forEach((header, index) => {
        record[header] = values[index] || ""
      })

      if (record.email && record.firstname && record.lastname) {
        const normalizedEmail = record.email.toLowerCase()
        records.push({
          email: normalizedEmail,
          firstName: record.firstname || record.first_name || "",
          lastName: record.lastname || record.last_name || "",
          fullName: `${record.firstname || record.first_name} ${record.lastname || record.last_name}`.trim(),
          graduationYear: record.graduationyear || record.graduation_year || record.year || undefined,
          hebrewName: record.hebrewname || record.hebrew_name || undefined,
          city: record.city || undefined,
          state: record.state || undefined,
          phone: record.phone || undefined,
          notes: record.notes || undefined,
          addedAt: new Date().toISOString(),
        })
      }
    }

    return records
  }

  const handleCSVPreview = () => {
    if (!csvText.trim()) {
      toast({ title: "Error", description: "Please paste CSV data first", variant: "destructive" })
      return
    }

    try {
      const records = parseCSV(csvText)
      if (records.length === 0) {
        toast({
          title: "Error",
          description: "No valid records found. Ensure CSV has headers: email, firstName, lastName",
          variant: "destructive",
        })
        return
      }
      setImportPreview(records)
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to parse CSV: " + error.message, variant: "destructive" })
    }
  }

  const handleCSVImport = async () => {
    if (importPreview.length === 0) return

    try {
      const batch = writeBatch(db)

      importPreview.forEach((record) => {
        const docRef = doc(db, "alumniDatabase", record.email)
        batch.set(docRef, record)
      })

      await batch.commit()

      toast({ title: "Success", description: `Imported ${importPreview.length} alumni records` })
      setShowImportDialog(false)
      setCsvText("")
      setImportPreview([])
      fetchAlumni()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const handleExportCSV = () => {
    const headers = [
      "email",
      "firstName",
      "lastName",
      "graduationYear",
      "hebrewName",
      "city",
      "state",
      "phone",
      "notes",
    ]
    const csvContent =
      headers.join(",") +
      "\n" +
      alumni
        .map((a) =>
          [
            a.email,
            a.firstName,
            a.lastName,
            a.graduationYear || "",
            a.hebrewName || "",
            a.city || "",
            a.state || "",
            a.phone || "",
            a.notes || "",
          ].join(","),
        )
        .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `alumni-database-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-navy mb-2">Alumni Management</h1>
        <p className="text-navy/70">Manage alumni database and email approvals</p>
      </div>

      <Tabs defaultValue="database" className="space-y-6">
        <TabsList>
          <TabsTrigger value="database">Alumni Database ({alumni.length})</TabsTrigger>
          <TabsTrigger value="approved">Manual Approvals ({approvedEmails.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="database" className="space-y-6">
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => {
                resetForm()
                setShowAddDialog(true)
              }}
              className="bg-navy text-cream hover:bg-navy/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Alumni
            </Button>
            <Button
              onClick={() => setShowImportDialog(true)}
              variant="outline"
              className="border-navy text-navy bg-transparent"
            >
              <Upload className="mr-2 h-4 w-4" />
              Import CSV
            </Button>
            <Button onClick={handleExportCSV} variant="outline" className="border-navy text-navy bg-transparent">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>

          <Card className="border-gold/20 bg-white shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-gold" />
                  <CardTitle className="text-navy">Alumni Records ({filteredAlumni.length})</CardTitle>
                </div>
                <div className="relative w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy/50" />
                  <Input
                    placeholder="Search alumni..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-navy/60 mb-4">
                Alumni in this database are automatically approved when they log in.
              </p>
              <div className="space-y-4 max-h-[500px] overflow-y-auto">
                {filteredAlumni.map((alumnus) => (
                  <div
                    key={alumnus.email}
                    className="flex items-start justify-between border-b border-gold/20 pb-4 last:border-0"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-navy">{alumnus.fullName}</p>
                        {alumnus.graduationYear && (
                          <span className="text-xs bg-gold/10 text-gold px-2 py-1 rounded">
                            Class of {alumnus.graduationYear}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-navy/70">{alumnus.email}</p>
                      {alumnus.hebrewName && <p className="text-sm text-navy/60">Hebrew: {alumnus.hebrewName}</p>}
                      <div className="flex flex-wrap gap-2 mt-1 text-sm text-navy/60">
                        {alumnus.city && alumnus.state && (
                          <span>
                            {alumnus.city}, {alumnus.state}
                          </span>
                        )}
                        {alumnus.phone && <span>{alumnus.phone}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(alumnus)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(alumnus.email, alumnus.fullName)}
                        className="border-destructive text-destructive hover:bg-destructive hover:text-white"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {filteredAlumni.length === 0 && <p className="text-center text-navy/50 py-8">No alumni found.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approved" className="space-y-6">
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => {
                resetForm()
                setShowApproveDialog(true)
              }}
              className="bg-navy text-cream hover:bg-navy/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              Approve Email
            </Button>
            <Button
              onClick={() => setShowExcelImportDialog(true)}
              variant="outline"
              className="border-navy text-navy bg-transparent"
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Import Excel
            </Button>
          </div>

          <Card className="border-gold/20 bg-white shadow-lg">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-gold" />
                <CardTitle className="text-navy">Manually Approved Emails ({approvedEmails.length})</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-navy/60 mb-4">
                Use this for non-alumni (parents, board members, etc.) who need site access.
              </p>
              <div className="space-y-4 max-h-[500px] overflow-y-auto">
                {approvedEmails.map((item) => (
                  <div
                    key={item.email}
                    className="flex items-center justify-between border-b border-gold/20 pb-4 last:border-0"
                  >
                    <div>
                      {item.fullName ? (
                        <>
                          <p className="font-medium text-navy">{item.fullName}</p>
                          <p className="text-sm text-navy/70">{item.email}</p>
                        </>
                      ) : (
                        <p className="font-medium text-navy">{item.email}</p>
                      )}
                      <div className="flex gap-2 text-sm text-navy/60">
                        {item.graduationYear && <span>Class of {item.graduationYear}</span>}
                        {item.graduationYear && item.notes && <span>-</span>}
                        {item.notes && <span>{item.notes}</span>}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteApproved(item.email)}
                      className="border-destructive text-destructive hover:bg-destructive hover:text-white"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {approvedEmails.length === 0 && (
                  <p className="text-center text-navy/50 py-8">No manually approved emails.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Alumni Dialog */}
      <Dialog
        open={showAddDialog}
        onOpenChange={(open) => {
          setShowAddDialog(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAlumni ? "Edit Alumni" : "Add Alumni to Database"}</DialogTitle>
            <DialogDescription>Alumni in this database are automatically approved when they log in</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Moshe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Cohen"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="moshe@example.com"
                  disabled={!!editingAlumni}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="graduationYear">Graduation Year</Label>
                <Input
                  id="graduationYear"
                  value={graduationYear}
                  onChange={(e) => setGraduationYear(e.target.value)}
                  placeholder="2015"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hebrewName">Hebrew Name</Label>
              <Input
                id="hebrewName"
                value={hebrewName}
                onChange={(e) => setHebrewName(e.target.value)}
                placeholder="Hebrew name"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Brooklyn" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input id="state" value={state} onChange={(e) => setState(e.target.value)} placeholder="NY" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="718-555-1234" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional information..."
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-navy text-cream hover:bg-navy/90">
                {editingAlumni ? "Update" : "Add to Database"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Approve Email Dialog */}
      <Dialog
        open={showApproveDialog}
        onOpenChange={(open) => {
          setShowApproveDialog(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Email</DialogTitle>
            <DialogDescription>Manually approve an email for site access</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleApproveEmail} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="approveFirstName">First Name</Label>
                <Input
                  id="approveFirstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Moshe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="approveLastName">Last Name</Label>
                <Input
                  id="approveLastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Cohen"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="approveEmail">Email Address *</Label>
              <Input
                id="approveEmail"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="approveNotes">Notes</Label>
              <Input
                id="approveNotes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Board member, Parent of alumnus"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowApproveDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-navy text-cream hover:bg-navy/90">
                Approve Email
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import CSV Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Alumni from CSV</DialogTitle>
            <DialogDescription>
              Paste CSV with columns: email, firstName, lastName, graduationYear, hebrewName, city, state, phone, notes
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>CSV Data</Label>
              <Textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="email,firstName,lastName,graduationYear&#10;moshe@example.com,Moshe,Cohen,2015"
                rows={8}
                className="font-mono text-sm"
              />
            </div>
            <Button onClick={handleCSVPreview} variant="outline" className="w-full bg-transparent">
              Preview Import
            </Button>
            {importPreview.length > 0 && (
              <div className="border border-gold/20 rounded-lg p-4 space-y-3 max-h-60 overflow-y-auto">
                <p className="font-semibold text-navy">Preview ({importPreview.length} records)</p>
                {importPreview.map((record, idx) => (
                  <div key={idx} className="text-sm border-b border-gold/10 pb-2 last:border-0">
                    <p className="font-medium text-navy">{record.fullName}</p>
                    <p className="text-navy/70">{record.email}</p>
                    {record.graduationYear && <p className="text-navy/60">Class of {record.graduationYear}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowImportDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCSVImport}
              disabled={importPreview.length === 0}
              className="bg-navy text-cream hover:bg-navy/90"
            >
              Import {importPreview.length} Records
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Excel Dialog for Approved Emails */}
      <Dialog open={showExcelImportDialog} onOpenChange={(open) => {
        setShowExcelImportDialog(open)
        if (!open) setExcelPreview([])
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Approved Emails from Excel</DialogTitle>
            <DialogDescription>
              Upload an Excel file with: Column A = First Name, Column B = Last Name, Column C = Email
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Excel File (.xlsx, .xls)</Label>
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelFile}
                className="cursor-pointer"
              />
            </div>
            {excelPreview.length > 0 && (
              <div className="border border-gold/20 rounded-lg p-4 space-y-3 max-h-60 overflow-y-auto">
                <p className="font-semibold text-navy">Preview ({excelPreview.length} emails)</p>
                {excelPreview.slice(0, 20).map((record, idx) => (
                  <div key={idx} className="text-sm border-b border-gold/10 pb-2 last:border-0">
                    <p className="font-medium text-navy">{record.fullName || "No name"}</p>
                    <p className="text-navy/70">{record.email}</p>
                  </div>
                ))}
                {excelPreview.length > 20 && (
                  <p className="text-sm text-navy/50">... and {excelPreview.length - 20} more</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => {
              setShowExcelImportDialog(false)
              setExcelPreview([])
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleExcelImport}
              disabled={excelPreview.length === 0}
              className="bg-navy text-cream hover:bg-navy/90"
            >
              Import {excelPreview.length} Emails
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function AlumniManagementPage() {
  return (
    <Suspense fallback={null}>
      <AlumniManagementContent />
    </Suspense>
  )
}
