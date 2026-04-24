// Utility function for uploading files to Backblaze B2 via S3-compatible API
// For large files, uploads directly to B2 using presigned URLs to bypass Vercel's 4.5MB limit
// Falls back to Firebase if B2 fails

import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { app } from "./firebase"

export async function uploadToB2(
  file: File,
  folder = "shiurim/audio",
  onProgress?: (progress: number) => void,
): Promise<string> {
  const FILE_SIZE_LIMIT = 4 * 1024 * 1024 // 4MB - below Vercel's limit

  try {
    if (file.size <= FILE_SIZE_LIMIT) {
      return await uploadViaServerProxy(file, folder, onProgress)
    } else {
      return await uploadDirectToB2(file, folder, onProgress)
    }
  } catch (error) {
    // Silently fall back to Firebase Storage if B2 fails
    console.log("B2 unavailable, using Firebase Storage")
    return await uploadToFirebase(file, folder, onProgress)
  }
}

// Fallback upload to Firebase Storage
async function uploadToFirebase(
  file: File,
  folder: string,
  onProgress?: (progress: number) => void,
): Promise<string> {
  const storage = getStorage(app)
  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
  const storageRef = ref(storage, `${folder}/${timestamp}-${safeName}`)
  
  const uploadTask = uploadBytesResumable(storageRef, file)
  
  return new Promise((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        onProgress?.(Math.round(progress))
      },
      (error) => {
        reject(error)
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
        resolve(downloadURL)
      }
    )
  })
}

// Upload small files through our API route
async function uploadViaServerProxy(
  file: File,
  folder: string,
  onProgress?: (progress: number) => void,
): Promise<string> {
  onProgress?.(5)

  const formData = new FormData()
  formData.append("file", file)
  formData.append("folder", folder)

  onProgress?.(10)

  const xhr = new XMLHttpRequest()

  const uploadPromise = new Promise<string>((resolve, reject) => {
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const progress = 10 + (event.loaded / event.total) * 85
        onProgress?.(Math.round(progress))
      }
    })

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText)
          if (response.success && response.url) {
            resolve(response.url)
          } else {
            reject(new Error(response.error || "Upload failed"))
          }
        } catch {
          reject(new Error("Invalid response from server"))
        }
      } else if (xhr.status === 503) {
        // B2 not configured, signal to use Firebase fallback
        reject(new Error("B2_NOT_CONFIGURED"))
      } else {
        try {
          const error = JSON.parse(xhr.responseText)
          reject(new Error(error.error || `Upload failed with status ${xhr.status}`))
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`))
        }
      }
    })

    xhr.addEventListener("error", () => reject(new Error("Upload failed - network error")))
    xhr.addEventListener("timeout", () => reject(new Error("Upload timed out")))
  })

  xhr.open("POST", "/api/upload-b2")
  xhr.timeout = 120000
  xhr.send(formData)

  const url = await uploadPromise
  onProgress?.(100)
  return url
}

async function uploadDirectToB2(file: File, folder: string, onProgress?: (progress: number) => void): Promise<string> {
  onProgress?.(5)

  // Get presigned S3 URL from our API
  const params = new URLSearchParams({
    fileName: file.name,
    contentType: file.type || "audio/mpeg",
    folder: folder,
  })

  const urlResponse = await fetch(`/api/upload-b2?${params}`)
  if (!urlResponse.ok) {
    if (urlResponse.status === 503) {
      // B2 not configured, signal to use Firebase fallback
      throw new Error("B2_NOT_CONFIGURED")
    }
    const error = await urlResponse.json()
    throw new Error(error.error || "Failed to get upload URL")
  }

  const { uploadUrl, downloadUrl, contentType } = await urlResponse.json()
  onProgress?.(10)

  // Upload directly to B2 S3 using PUT request
  const xhr = new XMLHttpRequest()

  const uploadPromise = new Promise<string>((resolve, reject) => {
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const progress = 10 + (event.loaded / event.total) * 85
        onProgress?.(Math.round(progress))
      }
    })

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(downloadUrl)
      } else {
        reject(new Error(`B2 upload failed with status ${xhr.status}`))
      }
    })

    xhr.addEventListener("error", () => {
      reject(new Error("B2 upload failed - network error"))
    })

    xhr.addEventListener("timeout", () => reject(new Error("Upload timed out")))
  })

  // S3 presigned URL uses PUT method
  xhr.open("PUT", uploadUrl)
  xhr.timeout = 600000 // 10 minute timeout for large files
  xhr.setRequestHeader("Content-Type", contentType)
  xhr.send(file)

  const url = await uploadPromise
  onProgress?.(100)
  return url
}
