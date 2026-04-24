import { NextResponse } from "next/server"
import { initializeApp, getApps, cert } from "firebase-admin/app"
import { getMessaging } from "firebase-admin/messaging"
import { getFirestore } from "firebase-admin/firestore"

// Initialize Firebase Admin if not already initialized
function getFirebaseAdmin() {
  if (getApps().length === 0) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY

    if (serviceAccount) {
      try {
        const parsedServiceAccount = JSON.parse(serviceAccount)
        initializeApp({
          credential: cert(parsedServiceAccount),
        })
      } catch (error) {
        console.error("Failed to parse Firebase service account:", error)
        return null
      }
    } else {
      return null
    }
  }
  return { messaging: getMessaging(), firestore: getFirestore() }
}

export async function POST(request: Request) {
  try {
    const { title, body, topics, type = "general", data: extraData } = await request.json()

    // Validate required fields
    if (!title || !body) {
      return NextResponse.json(
        { error: "Title and body are required" },
        { status: 400 }
      )
    }

    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      return NextResponse.json(
        { error: "At least one topic is required" },
        { status: 400 }
      )
    }

    const admin = getFirebaseAdmin()

    if (!admin) {
      return NextResponse.json(
        { error: "Firebase Admin SDK not configured. Please set FIREBASE_SERVICE_ACCOUNT_KEY environment variable." },
        { status: 500 }
      )
    }

    const { messaging, firestore } = admin

    const messageIds: string[] = []
    const errors: string[] = []

    // Send to each topic
    for (const topic of topics) {
      try {
        const message = {
          notification: {
            title,
            body,
          },
          data: {
            type,
            topic,
            timestamp: new Date().toISOString(),
            ...(extraData || {}),
          },
          topic,
          apns: {
            payload: {
              aps: {
                badge: 1,
                sound: "default",
                alert: {
                  title,
                  body,
                },
              },
            },
          },
        }

        const response = await messaging.send(message)
        messageIds.push(response)
      } catch (topicError: any) {
        console.error(`Failed to send to topic "${topic}":`, topicError.message)
        errors.push(`${topic}: ${topicError.message}`)
      }
    }

    // Log to Firestore notificationHistory collection
    try {
      await firestore.collection("notificationHistory").add({
        title,
        body,
        topics,
        type,
        sentAt: new Date().toISOString(),
        messageIds,
        errors: errors.length > 0 ? errors : null,
        status: errors.length === 0 ? "success" : messageIds.length > 0 ? "partial" : "failed",
      })
    } catch (firestoreError) {
      console.error("Failed to log notification to Firestore:", firestoreError)
    }

    if (messageIds.length === 0) {
      return NextResponse.json(
        { error: "Failed to send to all topics", details: errors },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      messageIds,
      errors: errors.length > 0 ? errors : undefined,
      message: errors.length > 0
        ? `Sent to ${messageIds.length}/${topics.length} topics`
        : "Notification sent successfully",
    })
  } catch (error: any) {
    console.error("Error sending notification:", error)

    return NextResponse.json(
      {
        error: error.message || "Failed to send notification",
        details: error.code || "Unknown error",
      },
      { status: 500 }
    )
  }
}
