'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  MessageSquare, Star, Send, CheckCircle,
  Mic, MicOff, Square, Image as ImageIcon, X, Loader2, Camera,
  Video, VideoOff
} from 'lucide-react'
import ProductSearch from '@/components/product-search'
import Link from 'next/link'

type FeedbackCategory = 'general' | 'bug' | 'feature-request' | 'praise' | 'complaint'

const CATEGORIES: { value: FeedbackCategory; label: string; emoji: string }[] = [
  { value: 'general', label: 'General', emoji: '💬' },
  { value: 'praise', label: 'Praise', emoji: '👏' },
  { value: 'complaint', label: 'Complaint', emoji: '😤' },
  { value: 'bug', label: 'Bug Report', emoji: '🐛' },
  { value: 'feature-request', label: 'Feature Request', emoji: '💡' },
]

const MAX_IMAGES = 3
const MAX_IMAGE_SIZE_MB = 5
const MAX_AUDIO_DURATION_S = 120
const MAX_VIDEO_DURATION_S = 15
const MAX_VIDEO_SIZE_MB = 4

export default function SubmitFeedbackPage() {
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const preselectedProductId = searchParams.get('productId')
  const preselectedProductName = searchParams.get('productName')

  // Product selection
  const [selectedProduct, setSelectedProduct] = useState<{
    id: string
    name: string
    isNew: boolean
  } | null>(
    preselectedProductId && preselectedProductName
      ? { id: preselectedProductId, name: preselectedProductName, isNew: false }
      : null
  )

  // Feedback form state
  const [feedbackText, setFeedbackText] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [hoverRating, setHoverRating] = useState<number | null>(null)
  const [category, setCategory] = useState<FeedbackCategory>('general')

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [hasAudioSupport, setHasAudioSupport] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Video recording state
  const [isRecordingVideo, setIsRecordingVideo] = useState(false)
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoDuration, setVideoDuration] = useState(0)
  const [hasVideoSupport, setHasVideoSupport] = useState(false)
  const videoRecorderRef = useRef<MediaRecorder | null>(null)
  const videoChunksRef = useRef<Blob[]>([])
  const videoTimerRef = useRef<NodeJS.Timeout | null>(null)
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null)
  const videoStreamRef = useRef<MediaStream | null>(null)

  // Image upload state
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([])

  // Consent
  const [consentAudio, setConsentAudio] = useState(false)
  const [consentVideo, setConsentVideo] = useState(false)
  const [consentImages, setConsentImages] = useState(false)

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [submittedData, setSubmittedData] = useState<{
    feedbackId: string
    sentiment: string | null
    originalLanguage: string | null
  } | null>(null)

  // Check for audio & video recording support
  useEffect(() => {
    const hasMedia = typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    setHasAudioSupport(hasMedia)
    setHasVideoSupport(hasMedia)
  }, [])

  // Cleanup URLs on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      if (videoUrl) URL.revokeObjectURL(videoUrl)
      if (videoStreamRef.current) videoStreamRef.current.getTracks().forEach(t => t.stop())
      imagePreviewUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Start audio recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4'

      const recorder = new MediaRecorder(stream, { mimeType })
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: mimeType })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        setIsRecording(false)
        if (timerRef.current) clearInterval(timerRef.current)
      }

      recorder.start(1000)
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      setRecordingDuration(0)

      timerRef.current = setInterval(() => {
        setRecordingDuration((d) => {
          if (d >= MAX_AUDIO_DURATION_S) {
            recorder.stop()
            return d
          }
          return d + 1
        })
      }, 1000)
    } catch (err) {
      console.error('Failed to start recording:', err)
      setError('Microphone access denied. Please allow microphone access to record audio.')
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const removeAudio = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioBlob(null)
    setAudioUrl(null)
    setRecordingDuration(0)
  }, [audioUrl])

  // Video recording
  const startVideoRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      videoStreamRef.current = stream

      // Show live preview
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream
        videoPreviewRef.current.play()
      }

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : 'video/mp4'

      const recorder = new MediaRecorder(stream, { mimeType })
      videoChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) videoChunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        videoStreamRef.current = null
        const blob = new Blob(videoChunksRef.current, { type: mimeType })

        if (blob.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
          setError(`Video exceeds ${MAX_VIDEO_SIZE_MB}MB limit. Try a shorter clip.`)
          setIsRecordingVideo(false)
          if (videoTimerRef.current) clearInterval(videoTimerRef.current)
          return
        }

        setVideoBlob(blob)
        setVideoUrl(URL.createObjectURL(blob))
        setIsRecordingVideo(false)
        if (videoTimerRef.current) clearInterval(videoTimerRef.current)
      }

      recorder.start(1000)
      videoRecorderRef.current = recorder
      setIsRecordingVideo(true)
      setVideoDuration(0)

      videoTimerRef.current = setInterval(() => {
        setVideoDuration(d => {
          if (d >= MAX_VIDEO_DURATION_S) {
            recorder.stop()
            return d
          }
          return d + 1
        })
      }, 1000)
    } catch (err) {
      console.error('Failed to start video recording:', err)
      setError('Camera access denied. Please allow camera access to record video.')
    }
  }, [])

  const stopVideoRecording = useCallback(() => {
    if (videoRecorderRef.current && videoRecorderRef.current.state === 'recording') {
      videoRecorderRef.current.stop()
    }
    if (videoTimerRef.current) {
      clearInterval(videoTimerRef.current)
      videoTimerRef.current = null
    }
  }, [])

  const removeVideo = useCallback(() => {
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach(t => t.stop())
      videoStreamRef.current = null
    }
    setVideoBlob(null)
    setVideoUrl(null)
    setVideoDuration(0)
  }, [videoUrl])

  // Image handling
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const remaining = MAX_IMAGES - imageFiles.length
    const newFiles = Array.from(files).slice(0, remaining)
    for (const file of newFiles) {
      if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
        setError(`Image "${file.name}" exceeds ${MAX_IMAGE_SIZE_MB}MB limit.`)
        return
      }
    }
    setImageFiles((prev) => [...prev, ...newFiles])
    setImagePreviewUrls((prev) => [...prev, ...newFiles.map((f) => URL.createObjectURL(f))])
    setError(null)
    e.target.value = ''
  }

  const removeImage = (index: number) => {
    URL.revokeObjectURL(imagePreviewUrls[index])
    setImageFiles((prev) => prev.filter((_, i) => i !== index))
    setImagePreviewUrls((prev) => prev.filter((_, i) => i !== index))
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!selectedProduct) {
      setError('Please select a product first.')
      return
    }

    const hasText = feedbackText.trim().length >= 3
    const hasAudio = audioBlob !== null
    const hasImages = imageFiles.length > 0

    if (!hasText && !hasAudio) {
      setError('Please provide text feedback or record a voice message.')
      return
    }

    if (hasAudio && !consentAudio) {
      setError('Please consent to audio recording storage.')
      return
    }

    const hasVideo = videoBlob !== null

    if (hasVideo && !consentVideo) {
      setError('Please consent to video recording storage.')
      return
    }

    if (hasImages && !consentImages) {
      setError('Please consent to image storage.')
      return
    }

    setIsSubmitting(true)

    try {
      // Step 1: Submit the text feedback
      setUploadProgress('Submitting feedback...')
      const res = await fetch('/api/feedback/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct.id,
          feedbackText: hasText ? feedbackText.trim() : '(Voice feedback)',
          rating: rating || undefined,
          category,
          userName: session?.user?.name || undefined,
          userEmail: session?.user?.email || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Submission failed')
      }

      const data = await res.json()
      const feedbackId = data.feedbackId

      // Step 2: Upload audio if present
      if (hasAudio && audioBlob) {
        setUploadProgress('Uploading voice recording...')
        const audioForm = new FormData()
        audioForm.append('feedbackId', feedbackId)
        audioForm.append('mediaType', 'audio')
        audioForm.append('file', audioBlob, 'voice.webm')
        audioForm.append('durationMs', String(recordingDuration * 1000))
        await fetch('/api/feedback/upload-media', { method: 'POST', body: audioForm })
      }

      // Step 3: Upload video if present
      if (hasVideo && videoBlob) {
        setUploadProgress('Uploading video...')
        const videoForm = new FormData()
        videoForm.append('feedbackId', feedbackId)
        videoForm.append('mediaType', 'video')
        videoForm.append('file', videoBlob, 'video.webm')
        videoForm.append('durationMs', String(videoDuration * 1000))
        await fetch('/api/feedback/upload-media', { method: 'POST', body: videoForm })
      }

      // Step 4: Upload images if present
      if (hasImages) {
        for (let i = 0; i < imageFiles.length; i++) {
          setUploadProgress(`Uploading image ${i + 1} of ${imageFiles.length}...`)
          const imgForm = new FormData()
          imgForm.append('feedbackId', feedbackId)
          imgForm.append('mediaType', 'image')
          imgForm.append('file', imageFiles[i])
          imgForm.append('imageIndex', String(i))
          await fetch('/api/feedback/upload-media', { method: 'POST', body: imgForm })
        }
      }

      setSubmittedData(data)
      setIsSubmitted(true)
    } catch (err) {
      console.error('Feedback submission error:', err)
      setError(err instanceof Error ? err.message : 'Failed to submit. Please try again.')
    } finally {
      setIsSubmitting(false)
      setUploadProgress(null)
    }
  }

  // Success state
  if (isSubmitted && submittedData) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="w-16 h-16 mx-auto text-green-600 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Thank You! 🎉</h2>
            <p className="text-muted-foreground mb-4">
              Your feedback for <strong>{selectedProduct?.name}</strong> has been submitted successfully.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
              {submittedData.sentiment && (
                <Badge variant="outline" className={
                  submittedData.sentiment === 'positive' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400' :
                  submittedData.sentiment === 'negative' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400' :
                  'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900 dark:text-gray-400'
                }>
                  Sentiment: {submittedData.sentiment}
                </Badge>
              )}
              {submittedData.originalLanguage && (
                <Badge variant="outline">Language: {submittedData.originalLanguage}</Badge>
              )}
              {audioBlob && (
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-400">
                  🎤 Voice attached
                </Badge>
              )}
              {videoBlob && (
                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-400">
                  🎥 Video attached
                </Badge>
              )}
              {imageFiles.length > 0 && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400">
                  📷 {imageFiles.length} image(s) attached
                </Badge>
              )}
            </div>

            <p className="text-sm text-muted-foreground mb-6">
              You earned <strong className="text-primary">+25 points</strong> for this feedback! 🌟
            </p>

            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" onClick={() => {
                setIsSubmitted(false)
                setSubmittedData(null)
                setFeedbackText('')
                setRating(null)
                setCategory('general')
                setSelectedProduct(null)
                removeAudio()
                removeVideo()
                imagePreviewUrls.forEach((url) => URL.revokeObjectURL(url))
                setImageFiles([])
                setImagePreviewUrls([])
                setConsentAudio(false)
                setConsentVideo(false)
                setConsentImages(false)
              }}>
                Submit Another
              </Button>
              <Button asChild>
                <Link href="/dashboard/my-feedback">View My Feedback</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
          <MessageSquare className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
          Submit Feedback
        </h1>
        <p className="text-muted-foreground mt-2">
          Share your experience with any product. Speak, type, record video, or upload photos — in any language!
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Step 1: Product Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">1. Select Product</CardTitle>
            <CardDescription>Search for the product you want to review</CardDescription>
          </CardHeader>
          <CardContent>
            <ProductSearch
              onProductSelect={setSelectedProduct}
              selectedProduct={selectedProduct}
            />
          </CardContent>
        </Card>

        {/* Step 2: Rating */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">2. Rate the Product (optional)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(rating === star ? null : star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(null)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star className={`w-8 h-8 ${
                    star <= (hoverRating || rating || 0)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300'
                  }`} />
                </button>
              ))}
              {rating && <span className="ml-2 text-sm text-muted-foreground">{rating}/5</span>}
            </div>
          </CardContent>
        </Card>

        {/* Step 3: Category */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">3. Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`px-3 py-2 rounded-full text-sm border transition-colors ${
                    category === cat.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border hover:bg-muted'
                  }`}
                >
                  {cat.emoji} {cat.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Step 4: Voice Feedback */}
        {hasAudioSupport && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Mic className="w-5 h-5" /> 4. Voice Feedback (optional)
              </CardTitle>
              <CardDescription>Tap the mic to record your thoughts — easier than typing!</CardDescription>
            </CardHeader>
            <CardContent>
              {audioUrl ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border">
                    <audio src={audioUrl} controls className="flex-1 h-10" />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">{formatTime(recordingDuration)}</span>
                    <Button type="button" variant="ghost" size="sm" onClick={removeAudio}><X className="w-4 h-4" /></Button>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={consentAudio} onChange={(e) => setConsentAudio(e.target.checked)} className="rounded" />
                    I consent to my voice recording being stored and processed
                  </label>
                </div>
              ) : isRecording ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center animate-pulse">
                    <MicOff className="w-10 h-10 text-red-600" />
                  </div>
                  <p className="text-lg font-mono font-semibold text-red-600">{formatTime(recordingDuration)}</p>
                  <p className="text-sm text-muted-foreground">Recording... (max 2 min)</p>
                  <Button type="button" variant="destructive" size="lg" onClick={stopRecording} className="gap-2">
                    <Square className="w-4 h-4" /> Stop Recording
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-4">
                  <Button type="button" variant="outline" size="lg" onClick={startRecording}
                    className="w-20 h-20 rounded-full p-0 border-2 border-dashed hover:border-primary hover:bg-primary/5">
                    <Mic className="w-8 h-8" />
                  </Button>
                  <p className="text-sm text-muted-foreground">Tap to start recording</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 5: Video Feedback */}
        {hasVideoSupport && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Video className="w-5 h-5" /> {hasAudioSupport ? '5' : '4'}. Video Feedback (optional)
              </CardTitle>
              <CardDescription>Record a short video review — up to {MAX_VIDEO_DURATION_S} seconds</CardDescription>
            </CardHeader>
            <CardContent>
              {videoUrl ? (
                <div className="space-y-3">
                  <div className="relative rounded-lg overflow-hidden border bg-black">
                    <video src={videoUrl} controls className="w-full max-h-64" />
                    <Button type="button" variant="ghost" size="sm" onClick={removeVideo}
                      className="absolute top-2 right-2 bg-black/50 text-white hover:bg-black/70">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Video className="w-4 h-4" />
                    <span>{formatTime(videoDuration)} recorded</span>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={consentVideo} onChange={(e) => setConsentVideo(e.target.checked)} className="rounded" />
                    I consent to my video recording being stored and processed
                  </label>
                </div>
              ) : isRecordingVideo ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="relative w-full max-w-sm rounded-lg overflow-hidden border bg-black">
                    <video ref={videoPreviewRef} muted autoPlay playsInline className="w-full max-h-48 object-cover" />
                    <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-red-600 text-white text-xs font-semibold px-2 py-1 rounded-full animate-pulse">
                      <span className="w-2 h-2 bg-white rounded-full" /> REC
                    </div>
                    <div className="absolute bottom-2 right-2 bg-black/60 text-white text-sm font-mono px-2 py-0.5 rounded">
                      {formatTime(videoDuration)} / {formatTime(MAX_VIDEO_DURATION_S)}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">Recording... (max {MAX_VIDEO_DURATION_S}s)</p>
                  <Button type="button" variant="destructive" size="lg" onClick={stopVideoRecording} className="gap-2">
                    <Square className="w-4 h-4" /> Stop Recording
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-4">
                  <Button type="button" variant="outline" size="lg" onClick={startVideoRecording}
                    className="w-20 h-20 rounded-full p-0 border-2 border-dashed hover:border-primary hover:bg-primary/5">
                    <Video className="w-8 h-8" />
                  </Button>
                  <p className="text-sm text-muted-foreground">Tap to start video recording</p>
                  <p className="text-xs text-muted-foreground">Max {MAX_VIDEO_DURATION_S} seconds • {MAX_VIDEO_SIZE_MB}MB limit</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 6: Text Feedback */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{hasAudioSupport && hasVideoSupport ? '6' : hasAudioSupport || hasVideoSupport ? '5' : '4'}. Your Feedback (text)</CardTitle>
            <CardDescription>Write in any language — we auto-detect and translate for analytics</CardDescription>
          </CardHeader>
          <CardContent>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={5}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Share your experience, thoughts, or suggestions..."
            />
            <p className="text-xs text-muted-foreground mt-1">
              {feedbackText.length} characters
              {audioBlob && ' (optional if you recorded audio)'}
            </p>
          </CardContent>
        </Card>

        {/* Step 6: Image Upload */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Camera className="w-5 h-5" /> {hasAudioSupport && hasVideoSupport ? '7' : hasAudioSupport || hasVideoSupport ? '6' : '5'}. Upload Photos (optional)
            </CardTitle>
            <CardDescription>Add up to {MAX_IMAGES} images ({MAX_IMAGE_SIZE_MB}MB each)</CardDescription>
          </CardHeader>
          <CardContent>
            {imagePreviewUrls.length > 0 && (
              <div className="flex gap-3 mb-4 flex-wrap">
                {imagePreviewUrls.map((url, i) => (
                  <div key={i} className="relative group">
                    <img src={url} alt={`Upload ${i + 1}`} className="w-24 h-24 object-cover rounded-lg border" />
                    <button type="button" onClick={() => removeImage(i)}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {imageFiles.length < MAX_IMAGES && (
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-dashed border-muted-foreground/30 hover:border-primary cursor-pointer transition-colors">
                <ImageIcon className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Choose image(s)</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleImageSelect} className="hidden" />
              </label>
            )}
            {imageFiles.length > 0 && (
              <label className="flex items-center gap-2 text-sm mt-3">
                <input type="checkbox" checked={consentImages} onChange={(e) => setConsentImages(e.target.checked)} className="rounded" />
                I consent to my images being stored and shared with the product brand
              </label>
            )}
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive rounded-lg">
            <p className="text-sm text-destructive font-medium">{error}</p>
          </div>
        )}

        {/* Upload progress */}
        {uploadProgress && (
          <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
            <Loader2 className="w-4 h-4 animate-spin" />
            <p className="text-sm">{uploadProgress}</p>
          </div>
        )}

        {/* Submit */}
        <Button
          type="submit"
          size="lg"
          className="w-full gap-2"
          disabled={isSubmitting || !selectedProduct || (feedbackText.trim().length < 3 && !audioBlob)}
        >
          {isSubmitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
          ) : (
            <><Send className="w-4 h-4" /> Submit Feedback</>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          By submitting, you agree that your feedback may be shared with the product&apos;s brand
          for improvement purposes. You&apos;ll earn reward points for every submission!
        </p>
      </form>
    </div>
  )
}
