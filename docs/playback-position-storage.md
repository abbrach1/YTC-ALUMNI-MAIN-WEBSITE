# Playback Position Storage - How It Works

## Overview

The app tracks where each user pauses or stops listening to each shiur, so when they come back later, playback resumes from that exact position. This creates a seamless listening experience across sessions.

---

## Current Implementation

### Storage Location
**localStorage only** (not synced to Firebase yet)

```typescript
localStorage key: "shiur-positions"

Data Structure:
{
  "shiur_001": 2450.5,    // 40:50 into the shiur
  "shiur_042": 1230.2,    // 20:30 into the shiur
  "shiur_123": 3600.0     // 60:00 into the shiur
}
```

Each key is a shiur ID, and the value is the playback position in **seconds** (float with decimals).

---

## Read/Write Functions

### 1. **Save Playback Position**

Located in: `/app/shiurim/shiurim-content.tsx` (lines 75-83)

```typescript
const savePlaybackPosition = (shiurId: string, time: number) => {
  try {
    const positions = JSON.parse(localStorage.getItem("shiur-positions") || "{}")
    positions[shiurId] = time
    localStorage.setItem("shiur-positions", JSON.stringify(positions))
  } catch (e) {
    console.error("Error saving playback position", e)
  }
}
```

**When Called:**
- Every 5 seconds during playback (via `handleTimeUpdate`)
- Automatically as the user listens

**Trigger:** Audio element's `timeupdate` event

---

### 2. **Get Playback Position**

Located in: `/app/shiurim/shiurim-content.tsx` (lines 85-92)

```typescript
const getPlaybackPosition = (shiurId: string): number => {
  try {
    const positions = JSON.parse(localStorage.getItem("shiur-positions") || "{}")
    return positions[shiurId] || 0
  } catch (e) {
    return 0
  }
}
```

**When Called:**
- When a shiur audio loads (via `handleAudioLoaded`)
- Returns the saved position in seconds, or 0 if no saved position exists

**Purpose:** Resume playback from where the user left off

---

### 3. **Clear Playback Position**

Located in: `/app/shiurim/shiurim-content.tsx` (lines 94-102)

```typescript
const clearPlaybackPosition = (shiurId: string) => {
  try {
    const positions = JSON.parse(localStorage.getItem("shiur-positions") || "{}")
    delete positions[shiurId]
    localStorage.setItem("shiur-positions", JSON.stringify(positions))
  } catch (e) {
    console.error("Error clearing playback position", e)
  }
}
```

**When Called:**
- When a shiur finishes playing (via `handleAudioEnded`)
- Removes the position so next time it starts from the beginning

---

## How It Works in Practice

### Flow Diagram

```
USER PRESSES PLAY ON SHIUR
         ↓
Audio element loads
         ↓
handleAudioLoaded() fires
         ↓
getPlaybackPosition(shiurId) called
         ↓
If saved position exists (e.g., 2450.5 seconds)
  → audioRef.current.currentTime = 2450.5
  → Playback starts at 40:50 mark
         ↓
USER LISTENS TO SHIUR
         ↓
Every frame (~60fps), timeupdate event fires
         ↓
handleTimeUpdate() called
         ↓
Every 5 seconds:
  → savePlaybackPosition(shiurId, currentTime)
  → Updates localStorage
  → Updates state: setSavedPositions()
         ↓
USER CLOSES APP OR NAVIGATES AWAY
         ↓
Position saved in localStorage: {"shiur_001": 2700.5}
         ↓
USER RETURNS LATER
         ↓
Audio loads → handleAudioLoaded() → Resume at 45:00
```

---

## Key Functions Called

### `handleTimeUpdate(shiurId: string)`

Located in: `/app/shiurim/shiurim-content.tsx` (lines 396-404)

```typescript
const handleTimeUpdate = (shiurId: string) => {
  if (audioRef.current) {
    const currentTime = audioRef.current.currentTime
    // Save every 5 seconds to avoid performance issues
    if (Math.floor(currentTime) % 5 === 0) {
      savePlaybackPosition(shiurId, currentTime)
      setSavedPositions((prev) => ({ ...prev, [shiurId]: currentTime }))
    }
  }
}
```

**Attached to:** `<audio>` element's `onTimeUpdate` event

**Frequency:** Updates every 5 seconds (not every frame for performance)

---

### `handleAudioLoaded(shiurId: string)`

Located in: `/app/shiurim/shiurim-content.tsx` (lines 406-414)

```typescript
const handleAudioLoaded = (shiurId: string) => {
  if (audioRef.current) {
    const savedTime = getPlaybackPosition(shiurId)
    if (savedTime > 0) {
      audioRef.current.currentTime = savedTime
      setCurrentTime(savedTime) // Update persistent player state
    }
  }
}
```

**Attached to:** `<audio>` element's `onLoadedMetadata` event

**Purpose:** Restore saved position when audio is ready to play

---

### `handleAudioEnded(shiurId: string)`

Located in: `/app/shiurim/shiurim-content.tsx` (lines 416-425)

```typescript
const handleAudioEnded = (shiurId: string) => {
  clearPlaybackPosition(shiurId)
  setSavedPositions((prev) => {
    const newPositions = { ...prev }
    delete newPositions[shiurId]
    return newPositions
  })
  closePlayer()
}
```

**Attached to:** `<audio>` element's `onEnded` event

**Purpose:** Clear saved position when shiur finishes, so next play starts from beginning

---

## Audio Element Integration

The audio element is connected to these handlers:

```tsx
<audio
  ref={audioRef}
  src={audioUrl}
  onLoadedMetadata={() => handleAudioLoaded(currentlyPlaying)}
  onTimeUpdate={() => handleTimeUpdate(currentlyPlaying)}
  onEnded={() => handleAudioEnded(currentlyPlaying)}
  onPlay={() => setIsPlaying(true)}
  onPause={() => setIsPlaying(false)}
/>
```

---

## State Management

### Component State

```typescript
const [savedPositions, setSavedPositions] = useState<Record<string, number>>({})
```

**Purpose:** In-memory cache of all shiur positions for quick access

**Updated:** 
- On app load (from localStorage)
- Every 5 seconds during playback
- When shiur ends (position cleared)

**Usage:** Show progress indicators in the shiur list UI

---

## UI Display

In the shiur card, there's a progress indicator:

```tsx
const savedPosition = savedPositions[shiur.id]
if (savedPosition && shiur.duration) {
  const percentage = (savedPosition / shiur.duration) * 100
  return (
    <div className="progress-bar">
      <div style={{ width: `${percentage}%` }} />
    </div>
  )
}
```

This shows users which shiurim they've started and how far they've listened.

---

## Data Format Examples

### localStorage Content

```json
{
  "shiur_001": 2450.5,
  "shiur_042": 1230.2,
  "shiur_123": 3600.0,
  "shiur_456": 45.8
}
```

### Component State

```typescript
savedPositions = {
  "shiur_001": 2450.5,
  "shiur_042": 1230.2,
  "shiur_123": 3600.0
}
```

---

## Problems with Current Implementation

### 1. Device-Specific Data
Positions are stored locally only. If a user switches devices, their playback positions don't transfer.

### 2. Browser Cache Issues
If user clears browser cache, all positions are lost.

### 3. No Cross-Device Sync
User can't start listening on desktop and continue on mobile.

### 4. No Analytics
Can't track listening patterns across users for recommendations.

---

## Recommended Improvement: Hybrid Firebase Sync

### Proposed Firebase Structure

```
/users/{uid}/playbackPositions/{shiurId}
{
  shiurId: "shiur_001",
  position: 2450.5,
  duration: 3600,
  percentCompleted: 68,
  lastUpdated: timestamp,
  deviceInfo: "Chrome Desktop"
}
```

### Hybrid Approach

```typescript
// Save locally immediately (for instant UX)
localStorage.setItem("shiur-positions", JSON.stringify(positions))

// Sync to Firebase in background (for persistence)
if (user?.uid) {
  await updateDoc(doc(db, `users/${user.uid}/playbackPositions`, shiurId), {
    position: currentTime,
    lastUpdated: serverTimestamp()
  })
}
```

### Benefits
- Instant UI updates (localStorage)
- Cloud backup (Firebase)
- Cross-device sync
- Analytics potential
- Works offline

---

## Implementation Checklist for Firebase Sync

- [ ] Create `/lib/firebase-playback-positions.ts` utility
- [ ] Add `getPlaybackPositionHybrid(uid, shiurId)`
- [ ] Add `savePlaybackPositionHybrid(uid, shiurId, time)`
- [ ] Add `syncPlaybackPositionsOnLoad(uid)`
- [ ] Update `handleTimeUpdate()` to use hybrid save
- [ ] Update `handleAudioLoaded()` to sync from Firebase
- [ ] Add Firebase Security Rules for `/users/{uid}/playbackPositions`
- [ ] Add merge logic for conflicts (use most recent timestamp)
- [ ] Test offline → online sync behavior

---

## Security Considerations

### Firebase Security Rules (when implemented)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/playbackPositions/{shiurId} {
      // Users can only read/write their own positions
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

---

## Performance Optimization

### Why Save Every 5 Seconds?

```typescript
if (Math.floor(currentTime) % 5 === 0) {
  savePlaybackPosition(shiurId, currentTime)
}
```

**Reason:** The `timeupdate` event fires 4-60 times per second. Saving every frame would:
- Cause excessive localStorage writes
- Impact performance
- Create unnecessary Firebase API calls

**Solution:** Save only when `currentTime` is a multiple of 5 seconds.

---

## iOS App Equivalent

For the iOS app, use the same pattern with UserDefaults + Firebase:

```swift
// Save to UserDefaults (local)
UserDefaults.standard.set(currentTime, forKey: "shiur_\(shiurId)_position")

// Sync to Firebase (cloud)
if let uid = Auth.auth().currentUser?.uid {
    let ref = Firestore.firestore()
        .collection("users").document(uid)
        .collection("playbackPositions").document(shiurId)
    
    ref.setData([
        "position": currentTime,
        "lastUpdated": FieldValue.serverTimestamp()
    ], merge: true)
}
```

---

## Summary

**Current Storage:** localStorage only, key = "shiur-positions"

**Data Structure:** `{ shiurId: timeInSeconds }`

**Read:** `getPlaybackPosition(shiurId)` → returns seconds

**Write:** `savePlaybackPosition(shiurId, time)` → saves to localStorage

**Clear:** `clearPlaybackPosition(shiurId)` → removes when shiur ends

**Frequency:** Updates every 5 seconds during playback

**Next Step:** Implement hybrid Firebase sync for cross-device support and data persistence.
