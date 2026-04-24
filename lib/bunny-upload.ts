export async function uploadToBunny(
  file: File,
  folder = "shiurim",
  onProgress?: (progress: number) => void,
): Promise<string> {
  // Step 1: Get upload credentials from our API
  const credentialsResponse = await fetch(
    `/api/upload-bunny?fileName=${encodeURIComponent(file.name)}&folder=${encodeURIComponent(folder)}`,
  )

  if (!credentialsResponse.ok) {
    const error = await credentialsResponse.json()
    throw new Error(error.error || "Failed to get upload credentials")
  }

  const { uploadUrl, cdnUrl, accessKey } = await credentialsResponse.json()

  // Step 2: Upload directly to Bunny.net from the client
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100)
        onProgress(progress)
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(cdnUrl)
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`))
      }
    }

    xhr.onerror = () => {
      reject(new Error("Network error during upload"))
    }

    xhr.open("PUT", uploadUrl)
    xhr.setRequestHeader("AccessKey", accessKey)
    xhr.setRequestHeader("Content-Type", "application/octet-stream")
    xhr.send(file)
  })
}
