# How Saved/Starred Shiurim Are Stored

## Overview
Currently, saved/bookmarked shiurim are stored **entirely in the browser's localStorage** (client-side only). This means:
- Data is not synced to Firebase
- Each device has its own saved list
- Data persists even when logged out
- No cross-device synchronization

## Current Implementation (Browser-Only)

### Storage Location
```
localStorage key: "saved-shiurim"
localStorage key: "downloaded-shiurim"
localStorage key: "shiur-positions"
```

### Data Structure in localStorage

**Saved Shiurim**
```json
{
  "saved-shiurim": "[\"shiur_001\", \"shiur_042\", \"shiur_156\"]"
}
```
- Simple array of shiur IDs
- Stored as JSON string
- Example: `["shiur_001", "shiur_042", "shiur_156"]`

**Downloaded Shiurim**
```json
{
  "downloaded-shiurim": "[\"shiur_001\", \"shiur_042\"]"
}
```

**Playback Positions**
```json
{
  "shiur-positions": "{\"shiur_001\": 2450.5, \"shiur_042\": 1230.2}"
}
```
- Object mapping shiurId to playback time in seconds
- Example: `{"shiur_001": 2450.5, "shiur_042": 1230.2}`

## Code Implementation

### Helper Functions (in `/app/shiurim/shiurim-content.tsx`)

#### Get Saved Shiurim
```typescript
const getSavedShiurim = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem("saved-shiurim") || "[]")
  } catch (e) {
    return []
  }
}
```

#### Toggle Saved Shiur
```typescript
const toggleSavedShiur = (shiurId: string): string[] => {
  try {
    const saved = getSavedShiurim()
    const index = saved.indexOf(shiurId)
    if (index > -1) {
      saved.splice(index, 1)  // Remove if exists
    } else {
      saved.push(shiurId)     // Add if doesn't exist
    }
    localStorage.setItem("saved-shiurim", JSON.stringify(saved))
    return saved
  } catch (e) {
    return []
  }
}
```

#### UI State Management
```typescript
const [savedShiurim, setSavedShiurim] = useState<string[]>([])

// Load on mount
useEffect(() => {
  setSavedShiurim(getSavedShiurim())
}, [])

// Toggle on bookmark click
const handleToggleSave = (shiurId: string) => {
  const newSaved = toggleSavedShiur(shiurId)
  setSavedShiurim(newSaved)
}
```

#### Show Save Status in UI
```typescript
const isSaved = savedShiurim.includes(shiur.id)

// Render bookmark button
<button onClick={() => handleToggleSave(shiur.id)}>
  {isSaved ? <BookmarkCheck /> : <Bookmark />}
</button>
```

#### Filter by Saved Only
```typescript
const [showSavedOnly, setShowSavedOnly] = useState(false)

// Filter logic
if (showSavedOnly) {
  filtered = filtered.filter((shiur) => savedShiurim.includes(shiur.id))
}
```

## Limitations of Current Approach

### Problems:
1. **No Cloud Sync** - Data only exists locally
2. **No Multi-Device Support** - Saved on iPhone doesn't appear on Android
3. **Data Loss Risk** - Clearing browser cache deletes saves
4. **No User Account Sync** - Different users on same device share saves
5. **No Persistent Data** - Not synced across browsers

## Recommended Firebase Implementation

### Firebase Collections Structure

**Better approach: Store in Firestore**

```
/users/{uid}/favorites/
  └── {favoriteShinurDoc}
    ├── shiurId: string
    ├── title: string
    ├── rebbe: string
    ├── savedAt: timestamp
    ├── notes: string (optional)
```

Or simpler, add to user document:

```
/users/{uid}
  ├── email: string
  ├── savedShiurIds: [string] (array of shiur IDs)
  ├── favoriteRebbes: [string]
  ├── favoriteTags: [string]
  └── updatedAt: timestamp
```

### Implementation Steps

```typescript
// Save a shiur to Firebase
const saveShinur = async (shiurId: string, userId: string) => {
  const userRef = doc(db, "users", userId)
  const userDoc = await getDoc(userRef)
  
  if (userDoc.exists()) {
    const saved = userDoc.data().savedShiurIds || []
    if (!saved.includes(shiurId)) {
      await updateDoc(userRef, {
        savedShiurIds: arrayUnion(shiurId),
        updatedAt: serverTimestamp()
      })
    }
  }
}

// Remove a saved shiur
const removeSavedShiur = async (shiurId: string, userId: string) => {
  const userRef = doc(db, "users", userId)
  await updateDoc(userRef, {
    savedShiurIds: arrayRemove(shiurId),
    updatedAt: serverTimestamp()
  })
}

// Get all saved shiurim
const getSavedShiurIds = async (userId: string): Promise<string[]> => {
  const userRef = doc(db, "users", userId)
  const userDoc = await getDoc(userRef)
  return userDoc.data()?.savedShiurIds || []
}
```

### Hybrid Approach (Recommended)

1. Use localStorage for **immediate/temporary** saves (while browsing)
2. Sync to Firebase when user **logs in**
3. Load from Firebase when **switching devices**
4. Use background sync for **automatic updates**

```typescript
// On app load
useEffect(() => {
  if (user?.uid) {
    // Sync local saves to Firebase
    syncLocalToFirebase(user.uid)
    
    // Load Firebase saves to local
    loadFirebaseToLocal(user.uid)
  } else {
    // Use local storage only (not logged in)
    loadLocalStorage()
  }
}, [user?.uid])
```

## iOS App Implementation

### Local Storage (Swift)
```swift
// Save to UserDefaults (iOS equivalent of localStorage)
let defaults = UserDefaults.standard
var saved = defaults.array(forKey: "savedShiurim") as? [String] ?? []
saved.append(shiurId)
defaults.set(saved, forKey: "savedShiurim")

// Retrieve
let saved = defaults.array(forKey: "savedShiurim") as? [String] ?? []
```

### Core Data (iOS persistent database)
```swift
@NSManaged var id: String
@NSManaged var shiurId: String
@NSManaged var title: String
@NSManaged var rebbe: String
@NSManaged var savedAt: Date
@NSManaged var isFavorite: Bool
```

### Firebase Sync (iOS)
```swift
// Save to Firestore
db.collection("users").document(userId).updateData([
    "savedShiurIds": FieldValue.arrayUnion([shiurId])
])

// Load from Firestore
db.collection("users").document(userId).getDocument { doc in
    let savedIds = doc?.data()?["savedShiurIds"] as? [String] ?? []
}
```

## Current UI Implementation

### Bookmark Button
Located in `/app/shiurim/shiurim-content.tsx` line ~817-900:

```tsx
const isSaved = savedShiurim.includes(shiur.id)

<button
  onClick={() => handleToggleSave(shiur.id)}
  className="hover:text-gold transition-colors"
>
  {isSaved ? (
    <BookmarkCheck className="h-5 w-5" />
  ) : (
    <Bookmark className="h-5 w-5" />
  )}
</button>
```

### Saved Filter
```tsx
<Checkbox
  id="saved-only"
  checked={showSavedOnly}
  onCheckedChange={(checked) => setShowSavedOnly(checked === true)}
/>
<label htmlFor="saved-only" className="text-sm font-medium cursor-pointer">
  <BookmarkCheck className="h-4 w-4 text-gold" />
  Saved Only
</label>
```

## Summary

**Current System:**
- Browser localStorage (client-only)
- Array of shiur IDs
- No Firebase sync
- Simple toggle on/off

**Recommended:**
- Add Firestore for persistent storage
- Sync local ↔ Firebase
- Support multi-device access
- Keep local cache for offline
