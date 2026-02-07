'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  MessageSquare, Star, Send, CheckCircle, ArrowLeft,
  Mic, MicOff, Square, Image as ImageIcon, X, Loader2, Camera, Check
} from 'lucide-react'
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

interface Props {
  preselectedProduct: {
    id: string
    name: string
    description?: string
  }
}

export default function DirectFeedbackForm({ preselectedProduct }: Props) {
  // Feedback form state
  const [feedbackText, setFeedbackText] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [hoverRating, setHoverRating] = useState<number | null>(null)
  const [category, setCategory] = useState<FeedbackCategory>('general')
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')

  // Audio
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [hasAudioSupport, setHasAudioSupport] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Images
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([])
  const [consentAudio, setConsentAudio] = useState(false)
  const [consentImages, setConsentImages] = useState(false)

  // UI
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [submittedData, setSubmittedData] = useState<any>(null)

  useEffect(() => {
    setHasAudioSupport(
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    )
  }, [])

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      imagePreviewUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'

      const recorder = new MediaRecorder(stream, { mimeType })
      audioChunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
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
          if (d >= MAX_AUDIO_DURATION_S) { recorder.stop(); return d }
          return d + 1
        })
      }, 1000)
    } catch {
      setError('Microphone access denied.')
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  const removeAudio = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioBlob(null); setAudioUrl(null); setRecordingDuration(0)
  }, [audioUrl])

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

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const hasText = feedbackText.trim().length >= 3
    const hasAudio = audioBlob !== null

    if (!hasText && !hasAudio) {
      setError('Please provide text feedback or record a voice message.')
      return
    }
    if (hasAudio && !consentAudio) {
      setError('Please consent to audio recording storage.')
      return
    }
    if (imageFiles.length > 0 && !consentImages) {
      setError('Please consent to image storage.')
      return
    }

    setIsSubmitting(true)
    try {
      setUploadProgress('Submitting feedback...')
      const res = await fetch('/api/feedback/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: preselectedProduct.id,
          feedbackText: hasText ? feedbackText.trim() : '(Voice feedback)',
          rating: rating || undefined,
          category,
          userName: userName.trim() || undefined,
          userEmail: userEmail.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Submission failed')
      }
      const data = await res.json()
      const feedbackId = data.feedbackId

      if (hasAudio && audioBlob) {
        setUploadProgress('Uploading voice recording...')
        const audioForm = new FormData()
        audioForm.append('feedbackId', feedbackId)
        audioForm.append('mediaType', 'audio')
        audioForm.append('file', audioBlob, 'voice.webm')
        audioForm.append('durationMs', String(recordingDuration * 1000))
        await fetch('/api/feedback/upload-media', { method: 'POST', body: audioForm })
      }

      if (imageFiles.length > 0) {
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
      setError(err instanceof Error ? err.message : 'Failed to submit.')
    } finally {
      setIsSubmitting(false)
      setUploadProgress(null)
    }
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto p-6 pt-12">
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle className="w-16 h-16 mx-auto text-green-600 mb-4" />
              <h2 className="text-2xl font-bold mb-2">Thank You!</h2>
              <p className="text-muted-foreground mb-6">
                Your feedback for <strong>{preselectedProduct.name}</strong> has been submitted.
              </p>
              <div className="flex items-center justify-center gap-3">
                <Button variant="outline" onClick={() => window.location.reload()}>
                  Submit Another
                </Button>
                <Button asChild>
                  <Link href="/">Back to Home</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-6 pt-8">
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild className="mb-4">
            <Link href="/submit-feedback">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Search Other Products
            </Link>
          </Button>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-primary" />
            Share Your Feedback
          </h1>
          <p className="text-muted-foreground mt-2">
            Tell us about your experience with{' '}
            <strong>{preselectedProduct.name}</strong>
          </p>
        </div>

        {/* Product info banner */}
        <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg border mb-6">
          <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium">{preselectedProduct.name}</p>
            {preselectedProduct.description && (
              <p className="text-xs text-muted-foreground line-clamp-1">
                {preselectedProduct.description}
              </p>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Rating */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">1. Rate the Product (optional)</CardTitle>
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
                        ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                    }`} />
                  </button>
                ))}
                {rating && <span className="ml-2 text-sm text-muted-foreground">{rating}/5</span>}
              </div>
            </CardContent>
          </Card>

          {/* Category */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">2. Category</CardTitle>
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

          {/* Voice */}
          {hasAudioSupport && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Mic className="w-5 h-5" /> 3. Voice Feedback (optional)
                </CardTitle>
                <CardDescription>Tap the mic to record</CardDescription>
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
                    <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center animate-pulse">
                      <MicOff className="w-10 h-10 text-red-600" />
                    </div>
                    <p className="text-lg font-mono font-semibold text-red-600">{formatTime(recordingDuration)}</p>
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

          {/* Text */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{hasAudioSupport ? '4' : '3'}. Your Feedback (text)</CardTitle>
              <CardDescription>Write in any language</CardDescription>
            </CardHeader>
            <CardContent>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                rows={5}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Share your experience..."
              />
              <p className="text-xs text-muted-foreground mt-1">{feedbackText.length} chars</p>
            </CardContent>
          </Card>

          {/* Images */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Camera className="w-5 h-5" /> {hasAudioSupport ? '5' : '4'}. Upload Photos (optional)
              </CardTitle>
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

          {/* Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{hasAudioSupport ? '6' : '5'}. Your Details (optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" placeholder="John Doe" value={userName} onChange={(e) => setUserName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="john@example.com" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive rounded-lg">
              <p className="text-sm text-destructive font-medium">{error}</p>
            </div>
          )}

          {uploadProgress && (
            <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
              <Loader2 className="w-4 h-4 animate-spin" />
              <p className="text-sm">{uploadProgress}</p>
            </div>
          )}

          <Button type="submit" size="lg" className="w-full gap-2"
            disabled={isSubmitting || (feedbackText.trim().length < 3 && !audioBlob)}>
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
            ) : (
              <><Send className="w-4 h-4" /> Submit Feedback</>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            By submitting, you agree that your feedback may be shared with the product&apos;s brand for improvement purposes.
          </p>
        </form>
      </div>
    </div>
  )
}
