// Script to add abbrachfeld@gmail.com as an approved admin user
import { initializeApp } from "firebase/app"
import { getFirestore, doc, setDoc } from "firebase/firestore"

const firebaseConfig = {
  apiKey: "AIzaSyBAL12OpTr-ls1elH4Bjl9f-GA0OAMyG5E",
  authDomain: "toras-chaim-shiurim.firebaseapp.com",
  projectId: "toras-chaim-shiurim",
  storageBucket: "toras-chaim-shiurim.firebasestorage.app",
  messagingSenderId: "95643621522",
  appId: "1:95643621522:web:06e73370c54c9d85986e4b",
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

async function addAdmin() {
  const email = "abbrachfeld@gmail.com"

  try {
    // Add to approvedEmails collection
    await setDoc(doc(db, "approvedEmails", email), {
      email: email,
      addedAt: new Date().toISOString(),
      addedBy: "system",
    })
    console.log(`✓ Added ${email} to approvedEmails collection`)

    // Add to admins collection
    await setDoc(doc(db, "admins", email), {
      email: email,
      role: "super-admin",
      addedAt: new Date().toISOString(),
    })
    console.log(`✓ Added ${email} to admins collection`)

    console.log("\n✓ Successfully granted full admin access to abbrachfeld@gmail.com")
    console.log("You can now sign in and access all features including the admin dashboard.")
  } catch (error) {
    console.error("Error adding admin:", error)
  }
}

addAdmin()
