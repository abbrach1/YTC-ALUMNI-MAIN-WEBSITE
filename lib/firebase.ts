import { initializeApp, getApps, getApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"
import { getStorage } from "firebase/storage"

const firebaseConfig = {
  apiKey: "AIzaSyBAL12OpTr-ls1elH4Bjl9f-GA0OAMyG5E",
  authDomain: "toras-chaim-shiurim.firebaseapp.com",
  projectId: "toras-chaim-shiurim",
  storageBucket: "toras-chaim-shiurim.firebasestorage.app",
  messagingSenderId: "95643621522",
  appId: "1:95643621522:web:06e73370c54c9d85986e4b",
}

// Initialize Firebase (singleton pattern)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
const auth = getAuth(app)
const db = getFirestore(app)
const storage = getStorage(app)

export { app, auth, db, storage }
