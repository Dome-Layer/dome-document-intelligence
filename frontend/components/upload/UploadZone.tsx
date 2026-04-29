'use client'

import { useCallback, useRef, useState } from 'react'
import { Upload, Camera } from 'lucide-react'

interface UploadZoneProps {
  onFile: (file: File) => void
  onError: (message: string) => void
  disabled?: boolean
}

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel']
const ACCEPTED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.xlsx']
const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.join(',')

function validateFile(file: File): string | null {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase()
  const validExt = ACCEPTED_EXTENSIONS.includes(ext)
  const validType = ACCEPTED_TYPES.some(t => file.type === t) || validExt
  if (!validType) {
    return `Unsupported file type. Accepted formats: PDF, JPG, PNG, XLSX.`
  }
  const maxBytes = 20 * 1024 * 1024
  if (file.size > maxBytes) {
    return `File too large. Maximum size is 20 MB.`
  }
  return null
}

export default function UploadZone({ onFile, onError, disabled }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)

  const handle = useCallback(
    (file: File) => {
      const err = validateFile(file)
      if (err) { onError(err); return }
      onFile(file)
    },
    [onFile, onError],
  )

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault()
      setIsDragging(false)
      if (disabled) return
      const file = e.dataTransfer.files[0]
      if (file) handle(file)
    },
    [disabled, handle],
  )

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handle(file)
    if (inputRef.current) inputRef.current.value = ''
  }

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      setCameraOpen(true)
      // attach stream after state update
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
      }, 50)
    } catch {
      onError('Camera access denied or not available.')
    }
  }

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCameraOpen(false)
  }

  const capturePhoto = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob(blob => {
      if (!blob) { onError('Failed to capture photo.'); return }
      const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' })
      closeCamera()
      handle(file)
    }, 'image/jpeg', 0.92)
  }

  if (cameraOpen) {
    return (
      <div className="relative w-full overflow-hidden rounded-xl border border-dome-border bg-dome-elevated"
        style={{ aspectRatio: '4/3' }}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
        />
        <canvas ref={canvasRef} className="hidden" />
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
          <button
            onClick={capturePhoto}
            className="btn btn-primary"
            style={{ borderRadius: '9999px', width: 56, height: 56, padding: 0 }}
            aria-label="Capture photo"
          >
            <Camera size={22} strokeWidth={1.5} />
          </button>
          <button
            onClick={closeCamera}
            className="btn btn-neutral btn-sm"
            aria-label="Cancel"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <label
        onDrop={onDrop}
        onDragOver={e => { e.preventDefault(); if (!disabled) setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        className={[
          'flex w-full cursor-pointer flex-col items-center justify-center gap-4',
          'rounded-xl border-2 border-dashed px-8 py-14',
          'transition-colors duration-150',
          disabled
            ? 'cursor-not-allowed border-dome-border opacity-50'
            : isDragging
            ? 'border-dome-accent bg-dome-accent-subtle'
            : 'border-dome-border bg-dome-surface hover:border-dome-border-accent hover:bg-dome-elevated',
        ].join(' ')}
      >
        <Upload
          size={40}
          strokeWidth={1.5}
          className={isDragging ? 'text-dome-accent' : 'text-dome-muted'}
        />

        <div className="text-center">
          <p className="text-base font-medium text-dome-text">
            {isDragging ? 'Drop it here' : 'Drop your document here'}
          </p>
          <p className="mt-1 text-sm text-dome-muted">
            PDF · JPG · PNG · XLSX
          </p>
          <p className="mt-1 text-xs text-dome-muted">
            Up to 20 MB · Document content is never stored
          </p>
        </div>

        <span className="rounded-lg border border-dome-border bg-dome-elevated px-4 py-2 text-sm font-medium text-dome-text transition-colors hover:border-dome-border-accent hover:text-dome-accent">
          Browse files
        </span>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          onChange={onChange}
          className="sr-only"
          disabled={disabled}
        />
      </label>

      {/* Camera capture */}
      {'mediaDevices' in navigator || typeof window === 'undefined' ? (
        <button
          onClick={openCamera}
          disabled={disabled}
          className="btn btn-neutral w-full"
          style={{ gap: 8 }}
        >
          <Camera size={16} strokeWidth={1.5} />
          Capture with camera
        </button>
      ) : null}
    </div>
  )
}
