import { Mp3Encoder } from "@breezystack/lamejs"

export function isWavFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return (
    name.endsWith(".wav") ||
    name.endsWith(".wave") ||
    file.type === "audio/wav" ||
    file.type === "audio/wave" ||
    file.type === "audio/x-wav" ||
    file.type === "audio/vnd.wave"
  )
}

interface ConvertOptions {
  bitrateKbps?: number
  forceMono?: boolean
}

interface WavHeader {
  sampleRate: number
  numChannels: number
  bitsPerSample: number
  dataOffset: number
  dataSize: number
}

const FOURCC = {
  RIFF: 0x52494646,
  WAVE: 0x57415645,
  fmt: 0x666d7420,
  data: 0x64617461,
}

// lamejs only supports these sample rates
const SUPPORTED_RATES = new Set([8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000])

function parseWavHeader(buf: ArrayBuffer): WavHeader | null {
  if (buf.byteLength < 44) return null
  const dv = new DataView(buf)
  if (dv.getUint32(0, false) !== FOURCC.RIFF) return null
  if (dv.getUint32(8, false) !== FOURCC.WAVE) return null

  let offset = 12
  let fmt: { sampleRate: number; numChannels: number; bitsPerSample: number; audioFormat: number } | null = null
  let dataOffset = 0
  let dataSize = 0

  while (offset + 8 <= buf.byteLength) {
    const chunkId = dv.getUint32(offset, false)
    const chunkSize = dv.getUint32(offset + 4, true)
    if (chunkId === FOURCC.fmt && offset + 8 + chunkSize <= buf.byteLength) {
      fmt = {
        audioFormat: dv.getUint16(offset + 8, true),
        numChannels: dv.getUint16(offset + 10, true),
        sampleRate: dv.getUint32(offset + 12, true),
        bitsPerSample: dv.getUint16(offset + 22, true),
      }
    } else if (chunkId === FOURCC.data) {
      dataOffset = offset + 8
      dataSize = chunkSize
      break
    }
    offset += 8 + chunkSize + (chunkSize % 2)
  }

  if (!fmt || !dataOffset) return null
  // 1 = PCM, 0xFFFE = WAVE_FORMAT_EXTENSIBLE (commonly still PCM under the hood)
  if (fmt.audioFormat !== 1 && fmt.audioFormat !== 0xfffe) return null
  return {
    sampleRate: fmt.sampleRate,
    numChannels: fmt.numChannels,
    bitsPerSample: fmt.bitsPerSample,
    dataOffset,
    dataSize,
  }
}

export async function convertWavToMp3(
  file: File,
  onProgress?: (percent: number) => void,
  options: ConvertOptions = {},
): Promise<File> {
  const bitrateKbps = options.bitrateKbps ?? 128
  const forceMono = options.forceMono ?? true

  const headerBuf = await file.slice(0, 4096).arrayBuffer()
  const header = parseWavHeader(headerBuf)
  if (!header) {
    throw new Error("Not a valid PCM WAV file")
  }
  if (header.bitsPerSample !== 16) {
    throw new Error(`Unsupported WAV bit depth (${header.bitsPerSample}-bit); only 16-bit PCM is supported`)
  }
  if (!SUPPORTED_RATES.has(header.sampleRate)) {
    throw new Error(`Unsupported sample rate (${header.sampleRate} Hz)`)
  }

  const { sampleRate, numChannels, dataOffset, dataSize } = header
  const outChannels = forceMono ? 1 : Math.min(numChannels, 2)
  const encoder = new Mp3Encoder(outChannels, sampleRate, bitrateKbps)

  const bytesPerSample = 2
  const frameBytes = numChannels * bytesPerSample
  const totalFrames = Math.floor(dataSize / frameBytes)
  // 1152 samples per MP3 frame; encode ~50 MP3 frames at a time
  const FRAMES_PER_CHUNK = 1152 * 50

  const mp3Parts: BlobPart[] = []
  let processedFrames = 0
  let readOffset = dataOffset
  let lastReportedPct = -1

  while (processedFrames < totalFrames) {
    const framesThisChunk = Math.min(FRAMES_PER_CHUNK, totalFrames - processedFrames)
    const bytesThisChunk = framesThisChunk * frameBytes
    const chunkBuf = await file.slice(readOffset, readOffset + bytesThisChunk).arrayBuffer()
    const pcm = new Int16Array(chunkBuf)

    let left: Int16Array
    let right: Int16Array | undefined

    if (numChannels === 1) {
      left = pcm
    } else if (forceMono) {
      // Downmix interleaved channels to mono
      left = new Int16Array(framesThisChunk)
      for (let i = 0; i < framesThisChunk; i++) {
        let sum = 0
        for (let c = 0; c < numChannels; c++) sum += pcm[i * numChannels + c]
        left[i] = (sum / numChannels) | 0
      }
    } else {
      // Stereo passthrough (only first two channels if more)
      left = new Int16Array(framesThisChunk)
      right = new Int16Array(framesThisChunk)
      for (let i = 0; i < framesThisChunk; i++) {
        left[i] = pcm[i * numChannels]
        right[i] = pcm[i * numChannels + 1]
      }
    }

    const mp3Buf = right ? encoder.encodeBuffer(left, right) : encoder.encodeBuffer(left)
    if (mp3Buf.length > 0) mp3Parts.push(mp3Buf as unknown as BlobPart)

    readOffset += bytesThisChunk
    processedFrames += framesThisChunk

    const pct = Math.floor((processedFrames / totalFrames) * 100)
    if (pct !== lastReportedPct) {
      onProgress?.(pct)
      lastReportedPct = pct
    }

    // Yield so the UI stays responsive on long files
    await new Promise((r) => setTimeout(r, 0))
  }

  const tail = encoder.flush()
  if (tail.length > 0) mp3Parts.push(tail as unknown as BlobPart)

  onProgress?.(100)

  const mp3Blob = new Blob(mp3Parts, { type: "audio/mpeg" })
  const newName = file.name.replace(/\.(wav|wave)$/i, ".mp3")
  return new File([mp3Blob], newName, { type: "audio/mpeg", lastModified: Date.now() })
}

/**
 * If the file is a WAV, convert it to MP3. Otherwise return the file unchanged.
 * If conversion fails (corrupt WAV, unsupported variant), returns the original file
 * so the upload can still proceed.
 */
export async function maybeConvertWavToMp3(
  file: File,
  onProgress?: (percent: number) => void,
  options?: ConvertOptions,
): Promise<{ file: File; converted: boolean; error?: string }> {
  if (!isWavFile(file)) return { file, converted: false }
  try {
    const mp3 = await convertWavToMp3(file, onProgress, options)
    return { file: mp3, converted: true }
  } catch (err: any) {
    return { file, converted: false, error: err?.message || "WAV conversion failed" }
  }
}
