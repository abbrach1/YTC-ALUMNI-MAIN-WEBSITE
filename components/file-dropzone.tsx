"use client"

import { useRef, useState, type DragEvent, type ReactNode } from "react"
import { UploadCloud } from "lucide-react"
import { cn } from "@/lib/utils"

interface FileDropzoneProps {
  accept: string
  onFilesSelected: (files: File[]) => void
  multiple?: boolean
  disabled?: boolean
  selectedFile?: File | null
  label: string
  hint?: string
  compact?: boolean
  className?: string
  /** Custom content rendered below the drop area (e.g. progress bar) */
  children?: ReactNode
}

/**
 * Reusable drag-and-drop file picker that also opens a file dialog on click.
 * Designed to match the navy/gold/cream theme used across the upload-shiur page.
 */
export function FileDropzone({
  accept,
  onFilesSelected,
  multiple = false,
  disabled = false,
  selectedFile,
  label,
  hint,
  compact = false,
  className,
  children,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const acceptedExtensions = accept
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

  const matchesAccept = (file: File) => {
    if (acceptedExtensions.length === 0) return true
    return acceptedExtensions.some((pattern) => {
      if (pattern.endsWith("/*")) {
        const prefix = pattern.slice(0, -1) // e.g. "audio/"
        return file.type.startsWith(prefix)
      }
      if (pattern.startsWith(".")) {
        return file.name.toLowerCase().endsWith(pattern.toLowerCase())
      }
      return file.type === pattern
    })
  }

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList).filter(matchesAccept)
    if (files.length === 0) return
    onFilesSelected(multiple ? files : [files[0]])
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (disabled) return
    if (!isDragging) setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (disabled) return
    handleFiles(e.dataTransfer.files)
  }

  const handleClick = () => {
    if (disabled) return
    inputRef.current?.click()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      inputRef.current?.click()
    }
  }

  return (
    <div className={className}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-white transition-all outline-none",
          compact ? "px-4 py-4" : "px-4 py-6",
          disabled
            ? "border-navy/10 bg-navy/[0.02] cursor-not-allowed opacity-60"
            : isDragging
            ? "border-gold bg-gold/10 cursor-copy"
            : selectedFile
            ? "border-green-600/40 bg-green-50/40 cursor-pointer hover:border-gold/60"
            : "border-gold/30 cursor-pointer hover:border-gold hover:bg-gold/[0.04] focus:border-gold focus:bg-gold/[0.04]",
        )}
      >
        <UploadCloud
          className={cn(
            compact ? "h-5 w-5" : "h-7 w-7",
            isDragging ? "text-gold" : selectedFile ? "text-green-600" : "text-navy/40",
          )}
        />
        <div className="text-center">
          {selectedFile ? (
            <>
              <p className={cn("font-medium text-navy truncate max-w-[260px]", compact ? "text-xs" : "text-sm")}>
                {selectedFile.name}
              </p>
              <p className={cn("text-navy/50", compact ? "text-[10px]" : "text-xs")}>
                Click or drop to replace
              </p>
            </>
          ) : (
            <>
              <p className={cn("font-medium text-navy", compact ? "text-xs" : "text-sm")}>
                {isDragging ? "Drop file here" : label}
              </p>
              {hint && (
                <p className={cn("text-navy/50", compact ? "text-[10px]" : "text-xs")}>{hint}</p>
              )}
            </>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={(e) => {
            handleFiles(e.target.files)
            // Reset value so re-selecting the same file still triggers onChange
            if (inputRef.current) inputRef.current.value = ""
          }}
          className="sr-only"
        />
      </div>
      {children}
    </div>
  )
}
