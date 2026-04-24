import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { collection, getDocs, orderBy, query, doc, setDoc, increment } from 'firebase/firestore'
import { db } from '@/lib/firebase'

// Twilio client is initialized lazily to avoid build errors when env vars are not set
function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  
  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials not configured')
  }
  
  return twilio(accountSid, authToken)
}

interface Shiur {
  id: string
  title: string
  rebbe: string
  category?: string
  audioUrl: string
  date: string
  playCount?: number
}

export async function POST(req: NextRequest) {
  try {
    const params = await req.text()
    const bodyParams = new URLSearchParams(params)
    
    // Get parameters from both POST body and URL query string
    const digits = bodyParams.get('Digits')
    const callSid = bodyParams.get('CallSid')
    const menuLevel = req.nextUrl.searchParams.get('menuLevel') || 'main'
    const rebbeList = req.nextUrl.searchParams.get('rebbeList')
    const category = req.nextUrl.searchParams.get('category')
    
    // Log call to analytics
    await logCallEvent(callSid, 'menu_selection', { digits, menuLevel })
    
    const twiml = new twilio.twiml.VoiceResponse()
    
    if (menuLevel === 'main') {
      return handleMainMenu(twiml, digits, callSid)
    } else if (menuLevel === 'rebbe') {
      return handleRebbeMenu(twiml, digits, callSid, rebbeList)
    } else if (menuLevel === 'category') {
      return handleCategoryMenu(twiml, digits, callSid)
    } else if (menuLevel === 'shiur_list') {
      const rebbe = req.nextUrl.searchParams.get('rebbe')
      const categoryParam = req.nextUrl.searchParams.get('category')
      return handleShiurSelection(twiml, digits, callSid, rebbe, categoryParam)
    }
    
    return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
  } catch (error) {
    console.error('Hotline error:', error)
    const twiml = new twilio.twiml.VoiceResponse()
    twiml.say({ voice: 'Google.en-US-Neural2-C' }, 'Sorry, something went wrong. Please try again.')
    twiml.hangup()
    return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
  }
}

async function handleMainMenu(twiml: any, digits: string | null, callSid: string) {
  if (!digits) {
    const voice = 'Google.en-US-Neural2-C'
    const gather = twiml.gather({
      numDigits: 1,
      action: `/api/hotline/ivr?menuLevel=main&callSid=${callSid}`,
      method: 'POST',
      timeout: 10
    })
    gather.say({ voice }, 'Welcome to the Toras Chaim Shiur hotline.')
    gather.say({ voice }, 'Press 1 for the latest shiur.')
    gather.say({ voice }, 'Press 2 to browse shiurim by Rebbe.')
    gather.say({ voice }, 'Press 3 to browse shiurim by category.')
    gather.say({ voice }, 'Please press 1, 2, or 3.')
    
    twiml.redirect(`/api/hotline/ivr?menuLevel=main&callSid=${callSid}`)
  } else if (digits === '1') {
    return handleLatestShiur(twiml, callSid)
  } else if (digits === '2') {
    return handleRebbeMenu(twiml, null, callSid)
  } else if (digits === '3') {
    return handleCategoryMenu(twiml, null, callSid)
  } else {
    const voice = 'Google.en-US-Neural2-C'
    twiml.say({ voice }, 'Invalid selection.')
    twiml.redirect(`/api/hotline/ivr?menuLevel=main&callSid=${callSid}`)
  }
  
  return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
}

async function handleLatestShiur(twiml: any, callSid: string) {
  const voice = 'Google.en-US-Neural2-C'
  const shiurimRef = collection(db, 'shiurim')
  const q = query(shiurimRef, orderBy('date', 'desc'))
  const querySnapshot = await getDocs(q)
  
  if (querySnapshot.empty) {
    twiml.say({ voice }, 'No shiurim available at this time.')
    twiml.hangup()
    return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
  }
  
  const latestShiur = querySnapshot.docs[0].data() as Shiur
  latestShiur.id = querySnapshot.docs[0].id
  
  twiml.say({ voice }, `Now playing the latest shiur: ${latestShiur.title} by ${latestShiur.rebbe}`)
  twiml.play(latestShiur.audioUrl)
  
  await logCallEvent(callSid, 'shiur_played', { shiurId: latestShiur.id, title: latestShiur.title })
  await incrementPlayCount(latestShiur.id)
  
  const gather = twiml.gather({
    numDigits: 1,
    action: `/api/hotline/ivr?menuLevel=main&callSid=${callSid}`,
    method: 'POST',
    timeout: 5
  })
  gather.say({ voice }, 'Press 1 to return to the main menu, or press 2 to hang up.')
  
  return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
}

async function handleRebbeMenu(twiml: any, digits: string | null, callSid: string, rebbeListParam?: string) {
  const voice = 'Google.en-US-Neural2-C'
  
  let rebbeList: string[] = []
  if (rebbeListParam) {
    try {
      rebbeList = JSON.parse(rebbeListParam)
    } catch (e) {
      console.error('Error parsing rebbe list:', e)
      twiml.redirect(`/api/hotline/ivr?menuLevel=main&callSid=${callSid}`)
      return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
    }
  }
  
  if (!digits) {
    // Fetch rebbes list if not provided
    if (rebbeList.length === 0) {
      const shiurimRef = collection(db, 'shiurim')
      const querySnapshot = await getDocs(shiurimRef)
      const rebbes = new Set<string>()
      
      querySnapshot.forEach(doc => {
        const data = doc.data()
        if (data.rebbe) rebbes.add(data.rebbe)
      })
      
      rebbeList = Array.from(rebbes).sort()
    }
    
    if (rebbeList.length === 0) {
      twiml.say({ voice }, 'No rebbes available.')
      twiml.redirect(`/api/hotline/ivr?menuLevel=main&callSid=${callSid}`)
      return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
    }
    
    const gather = twiml.gather({
      numDigits: 1,
      action: `/api/hotline/ivr?menuLevel=rebbe&callSid=${callSid}&rebbeList=${encodeURIComponent(JSON.stringify(rebbeList))}`,
      method: 'POST',
      timeout: 10
    })
    gather.say({ voice }, 'Select a Rebbe.')
    rebbeList.forEach((rebbe, index) => {
      gather.say({ voice }, `Press ${index + 1} for ${rebbe}`)
    })
    gather.say({ voice }, 'Please make a selection.')
    
    return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
  }
  
  // Handle rebbe selection
  const selectedIndex = parseInt(digits) - 1
  if (selectedIndex < 0 || selectedIndex >= rebbeList.length) {
    twiml.say({ voice }, 'Invalid selection.')
    const gather = twiml.gather({
      numDigits: 1,
      action: `/api/hotline/ivr?menuLevel=rebbe&callSid=${callSid}&rebbeList=${encodeURIComponent(JSON.stringify(rebbeList))}`,
      method: 'POST',
      timeout: 10
    })
    gather.say({ voice }, 'Please try again.')
    return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
  }
  
  const selectedRebbe = rebbeList[selectedIndex]
  const shiurimRef = collection(db, 'shiurim')
  const q = query(shiurimRef, orderBy('date', 'desc'))
  const querySnapshot = await getDocs(q)
  
  const rebbeShiurim = querySnapshot.docs
    .filter(doc => doc.data().rebbe === selectedRebbe)
    .slice(0, 5)
  
  if (rebbeShiurim.length === 0) {
    twiml.say({ voice }, `No shiurim found for ${selectedRebbe}.`)
    twiml.redirect(`/api/hotline/ivr?menuLevel=main&callSid=${callSid}`)
    return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
  }
  
  const gather = twiml.gather({
    numDigits: 1,
    action: `/api/hotline/ivr?menuLevel=shiur_list&callSid=${callSid}&rebbe=${encodeURIComponent(selectedRebbe)}`,
    method: 'POST',
    timeout: 10
  })
  gather.say({ voice }, `Shiurim by ${selectedRebbe}.`)
  rebbeShiurim.forEach((doc, index) => {
    const data = doc.data()
    gather.say({ voice }, `Press ${index + 1} for ${data.title}`)
  })
  
  return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
}

async function handleCategoryMenu(twiml: any, digits: string | null, callSid: string) {
  const voice = 'Google.en-US-Neural2-C'
  const categories = ['Chumash', 'Mishnah', 'Gemara', 'Halacha']
  
  if (!digits) {
    const gather = twiml.gather({
      numDigits: 1,
      action: `/api/hotline/ivr?menuLevel=category&callSid=${callSid}`,
      method: 'POST',
      timeout: 10
    })
    gather.say({ voice }, 'Select a category.')
    gather.say({ voice }, 'Press 1 for Chumash')
    gather.say({ voice }, 'Press 2 for Mishnah')
    gather.say({ voice }, 'Press 3 for Gemara')
    gather.say({ voice }, 'Press 4 for Halacha')
    gather.say({ voice }, 'Please make a selection.')
    
    return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
  }
  
  // Handle category selection
  const selectedIndex = parseInt(digits) - 1
  if (selectedIndex < 0 || selectedIndex >= categories.length) {
    twiml.say({ voice }, 'Invalid selection.')
    const gather = twiml.gather({
      numDigits: 1,
      action: `/api/hotline/ivr?menuLevel=category&callSid=${callSid}`,
      method: 'POST',
      timeout: 10
    })
    gather.say({ voice }, 'Please try again.')
    return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
  }
  
  const selectedCategory = categories[selectedIndex]
  const shiurimRef = collection(db, 'shiurim')
  const q = query(shiurimRef, orderBy('date', 'desc'))
  const querySnapshot = await getDocs(q)
  
  const categoryShiurim = querySnapshot.docs
    .filter(doc => doc.data().category === selectedCategory)
    .slice(0, 5)
  
  if (categoryShiurim.length === 0) {
    twiml.say({ voice }, `No shiurim found for ${selectedCategory}.`)
    twiml.redirect(`/api/hotline/ivr?menuLevel=main&callSid=${callSid}`)
    return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
  }
  
  const gather = twiml.gather({
    numDigits: 1,
    action: `/api/hotline/ivr?menuLevel=shiur_list&callSid=${callSid}&category=${encodeURIComponent(selectedCategory)}`,
    method: 'POST',
    timeout: 10
  })
  gather.say({ voice }, `Shiurim in ${selectedCategory}.`)
  categoryShiurim.forEach((doc, index) => {
    const data = doc.data()
    gather.say({ voice }, `Press ${index + 1} for ${data.title}`)
  })
  
  return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
}

async function handleShiurSelection(twiml: any, digits: string | null, callSid: string, rebbe?: string | null, category?: string | null) {
  const voice = 'Google.en-US-Neural2-C'
  
  if (!digits) {
    twiml.say({ voice }, 'Please select a shiur.')
    return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
  }
  
  // Fetch shiurim based on rebbe or category
  const shiurimRef = collection(db, 'shiurim')
  const q = query(shiurimRef, orderBy('date', 'desc'))
  const querySnapshot = await getDocs(q)
  
  let filteredShiurim = querySnapshot.docs
  
  if (rebbe) {
    filteredShiurim = filteredShiurim.filter(doc => doc.data().rebbe === rebbe)
  } else if (category) {
    filteredShiurim = filteredShiurim.filter(doc => doc.data().category === category)
  }
  
  const shiurimList = filteredShiurim.slice(0, 5)
  const selectedIndex = parseInt(digits) - 1
  
  if (selectedIndex < 0 || selectedIndex >= shiurimList.length) {
    twiml.say({ voice }, 'Invalid selection.')
    twiml.redirect(`/api/hotline/ivr?menuLevel=main&callSid=${callSid}`)
    return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
  }
  
  const selectedShiur = shiurimList[selectedIndex].data() as Shiur
  const shiurId = shiurimList[selectedIndex].id
  
  // Increment play count
  await incrementPlayCount(shiurId)
  
  // Announce the shiur and play it
  twiml.say({ voice }, `Now playing: ${selectedShiur.title} by ${selectedShiur.rebbe}`)
  
  if (selectedShiur.audioUrl) {
    twiml.play(selectedShiur.audioUrl)
  }
  
  // After playback, offer menu options
  const gather = twiml.gather({
    numDigits: 1,
    action: `/api/hotline/ivr?menuLevel=main&callSid=${callSid}`,
    method: 'POST',
    timeout: 5
  })
  gather.say({ voice }, 'Press 1 to return to the main menu, or press 2 to hang up.')
  
  return new NextResponse(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
}

async function logCallEvent(callSid: string, eventType: string, data: any) {
  try {
    const analyticsRef = doc(db, 'hotlineAnalytics', callSid)
    const timestamp = new Date().toISOString()
    
    await setDoc(analyticsRef, {
      callSid,
      eventType,
      data,
      timestamp,
      createdAt: new Date()
    }, { merge: true })
  } catch (error) {
    console.error('Error logging call event:', error)
  }
}

async function incrementPlayCount(shiurId: string) {
  try {
    const shiurRef = doc(db, 'shiurim', shiurId)
    await setDoc(shiurRef, { playCount: increment(1) }, { merge: true })
  } catch (error) {
    console.error('Error incrementing play count:', error)
  }
}
