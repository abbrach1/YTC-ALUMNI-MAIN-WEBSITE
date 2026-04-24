# Alumni Directory Data Flow

## Overview
The alumni directory displays contact information submitted by alumni and approved by administrators. This document breaks down exactly how the data flows through the system.

---

## Data Structure

### Firebase Collection: `alumniContactSubmissions`

Each document in this collection represents one alumni contact submission with the following structure:

```typescript
interface Alumni {
  id: string                    // Document ID (auto-generated)
  name: string                  // Full name of the alumnus
  email?: string                // Email address (optional)
  phone?: string                // Phone number (optional)
  location: string              // Location (e.g., "Brooklyn, NY")
  submittedAt: string           // ISO timestamp when submitted
  submittedBy?: string          // User ID who submitted (if authenticated)
  status: "pending" | "approved" | "rejected"  // Approval status
}
```

---

## Data Flow Path

### 1. **Data Submission** (`/app/contacts/contacts-content.tsx`)

**Location:** Lines 150-210 (handleSubmit function)

**How it works:**
- User clicks "Add Your Info" button on the contacts page
- Opens a modal dialog with a form
- User fills in: name, email, phone, location
- On submit, the data is added to Firebase:

```typescript
await addDoc(collection(db, "alumniContactSubmissions"), {
  name: formData.name,
  email: formData.email,
  phone: formData.phone,
  location: locationValue,  // Either selected dropdown or custom input
  submittedAt: new Date().toISOString(),
  submittedBy: user?.uid || null,
  status: "pending"  // Default status
})
```

**Result:** New document created in `alumniContactSubmissions` with status "pending"

---

### 2. **Admin Review** (`/app/admin/alumni-contacts/page.tsx`)

**Location:** Lines 31-84 (fetchSubmissions and approval handlers)

**How it works:**
- Admin navigates to `/admin/alumni-contacts`
- Page fetches ALL submissions from Firebase:

```typescript
const submissionsRef = collection(db, "alumniContactSubmissions")
const q = query(submissionsRef, orderBy("submittedAt", "desc"))
const snapshot = await getDocs(q)
```

- Displays submissions with badges showing status (pending/approved/rejected)
- Admin can:
  - **Approve:** Sets `status: "approved"` on the document
  - **Reject:** Sets `status: "rejected"` on the document
  - **Delete:** Permanently removes the document from Firebase

```typescript
// Approval
await updateDoc(doc(db, "alumniContactSubmissions", id), {
  status: "approved"
})

// Rejection
await updateDoc(doc(db, "alumniContactSubmissions", id), {
  status: "rejected"
})
```

**Result:** Document's status field is updated to "approved", "rejected", or deleted

---

### 3. **Public Directory Display** (`/app/contacts/contacts-content.tsx`)

**Location:** Lines 77-93 (fetchData useEffect)

**How it works:**
- When user visits `/contacts` page and clicks "Alumni" tab
- Page queries Firebase and filters for approved submissions only:

```typescript
const alumniRef = collection(db, "alumniContactSubmissions")
const alumniSnapshot = await getDocs(alumniRef)
const alumniData: Alumni[] = []

alumniSnapshot.forEach((doc) => {
  const data = doc.data() as Alumni
  // KEY FILTER: Only show approved alumni
  if (data.status === "approved") {
    alumniData.push({ id: doc.id, ...data })
  }
})

setAlumni(alumniData)
```

**Result:** Only alumni with `status === "approved"` are loaded into the directory

---

### 4. **Search & Filter** (`/app/contacts/contacts-content.tsx`)

**Location:** Lines 95-118 (filtering useEffect)

**How it works:**
- As user types in the search box, the alumni array is filtered in real-time:

```typescript
if (searchTerm) {
  filtered = filtered.filter((a) =>
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.location.toLowerCase().includes(searchTerm.toLowerCase())
  )
}
```

- User can sort by:
  - **Name:** Alphabetical by full name
  - **Recent:** By submission date (newest first)

```typescript
if (sortBy === "name") {
  filtered.sort((a, b) => a.name.localeCompare(b.name))
} else if (sortBy === "graduationYear") {
  filtered.sort((a, b) => 
    new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  )
}
```

**Result:** User sees a filtered and sorted list of approved alumni

---

### 5. **Pagination** (`/app/contacts/contacts-content.tsx`)

**Location:** Lines 115-133 (pagination logic)

**How it works:**
- Initially loads only 20 alumni (ITEMS_PER_PAGE)
- As user scrolls to bottom, automatically loads 20 more
- Implemented with infinite scroll pattern:

```typescript
// Initial load
setDisplayedAlumni(filtered.slice(0, ITEMS_PER_PAGE))
setHasMore(filtered.length > ITEMS_PER_PAGE)

// Load more function
const loadMore = () => {
  const nextPage = page + 1
  const startIndex = page * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const newItems = filteredAlumni.slice(startIndex, endIndex)
  
  setDisplayedAlumni([...displayedAlumni, ...newItems])
  setPage(nextPage)
  setHasMore(endIndex < filteredAlumni.length)
}
```

**Result:** Only 20 alumni displayed at a time, more load as user scrolls

---

### 6. **User Profile Updates** (`/app/profile/page.tsx`)

**Location:** Lines 32-77 (fetchAlumniInfo and handleSave)

**How it works:**
- Authenticated user navigates to `/profile` (from dropdown menu)
- System searches for their alumni record by email:

```typescript
const alumniRef = collection(db, "alumniContactSubmissions")
const alumniSnapshot = await getDocs(alumniRef)

alumniSnapshot.forEach((doc) => {
  const data = doc.data()
  if (data.email === user.email) {
    setAlumniRecord({ id: doc.id, ...data })
    setFormData({
      name: data.name,
      email: data.email,
      phone: data.phone || "",
      location: data.location || "",
    })
  }
})
```

- User can update their name, phone, or location (email is read-only)
- On save, updates their document in Firebase:

```typescript
await updateDoc(doc(db, "alumniContactSubmissions", alumniRecord.id), {
  name: formData.name,
  phone: formData.phone,
  location: formData.location,
})
```

**Result:** User's information is updated in the directory (if approved)

---

## Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     User Submits Contact Info                   │
│                    (Public Contacts Page Form)                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                 ┌───────────────────────┐
                 │  Firebase Collection  │
                 │ alumniContactSubmissions │
                 │   status: "pending"   │
                 └───────────┬───────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
                ▼                         ▼
    ┌───────────────────┐    ┌──────────────────────┐
    │  Admin Reviews    │    │  User Can Edit via   │
    │  /admin/alumni-   │    │    /profile page     │
    │    contacts       │    │  (Find by email)     │
    └─────┬──────┬──────┘    └──────────────────────┘
          │      │
  ┌───────┘      └────────┐
  │                       │
  ▼                       ▼
Approve                Reject/Delete
status: "approved"     status: "rejected"
  │                    or removed
  │
  ▼
┌──────────────────────────────┐
│  Public Alumni Directory     │
│    /contacts (Alumni Tab)    │
│                              │
│  Filters: status === "approved" │
│  Search: name, email, location  │
│  Sort: name or date             │
│  Pagination: 20 per page        │
└──────────────────────────────┘
```

---

## Key Points

1. **Single Source of Truth:** All alumni data lives in the `alumniContactSubmissions` collection

2. **Approval Gate:** Only records with `status: "approved"` appear in the public directory

3. **No Separate Collections:** The public directory and admin panel read from the same collection, filtered by status

4. **Real-time Filtering:** Search and sort happen client-side on the fetched data for instant results

5. **User Self-Service:** Users can update their own info via `/profile`, but changes still respect the approval status

6. **Three Status Values:**
   - `pending`: Submitted, waiting for admin review
   - `approved`: Visible in public directory
   - `rejected`: Hidden from directory, kept in admin panel

---

## Files Involved

| File | Purpose | Key Functions |
|------|---------|--------------|
| `/app/contacts/contacts-content.tsx` | Public directory display + submission form | `fetchData()`, `handleSubmit()`, search/sort/pagination |
| `/app/admin/alumni-contacts/page.tsx` | Admin approval interface | `fetchSubmissions()`, `handleApprove()`, `handleReject()` |
| `/app/profile/page.tsx` | User profile editing | `fetchAlumniInfo()`, `handleSave()` |

---

## Database Query Patterns

### Fetch all submissions (Admin)
```typescript
const q = query(
  collection(db, "alumniContactSubmissions"), 
  orderBy("submittedAt", "desc")
)
const snapshot = await getDocs(q)
```

### Fetch approved only (Public)
```typescript
const snapshot = await getDocs(collection(db, "alumniContactSubmissions"))
snapshot.forEach((doc) => {
  if (doc.data().status === "approved") {
    // Add to display array
  }
})
```

### Update status (Admin)
```typescript
await updateDoc(
  doc(db, "alumniContactSubmissions", documentId), 
  { status: "approved" }
)
```

### Find by email (User profile)
```typescript
const snapshot = await getDocs(collection(db, "alumniContactSubmissions"))
snapshot.forEach((doc) => {
  if (doc.data().email === userEmail) {
    // Found user's record
  }
})
```

---

## Security Considerations

1. **Client-Side Filtering:** The status filter happens in the browser code, NOT as a Firebase query. This means:
   - All documents are fetched from Firebase
   - Filtering to approved-only happens in JavaScript
   - For better security and performance, consider using Firebase Security Rules to restrict reads

2. **No Admin Check on Writes:** The submission form allows anyone to submit. Consider adding:
   - Rate limiting
   - Captcha
   - User authentication requirement

3. **Profile Updates:** Users can update any record that matches their email. Consider:
   - Adding a `submittedBy` field linking to user ID for stricter ownership
   - Preventing updates to rejected submissions

---

## Potential Improvements

1. **Indexed Query:** Add a Firebase index on `status` field and query with `where("status", "==", "approved")` to fetch only approved records

2. **Real-time Updates:** Use `onSnapshot()` instead of `getDocs()` for live updates when admins approve

3. **Caching:** Store fetched alumni in localStorage with timestamp to reduce Firebase reads

4. **Batch Operations:** Allow admin to approve/reject multiple submissions at once

5. **Notification System:** Email alumni when their submission is approved/rejected
