'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup } from '@/components/ui/radio-group'
import { Star, Mic, Square, RotateCcw } from 'lucide-react'
import { submitSurveyResponse } from '@/server/surveys/responseService'
import { trackSurveyStartAction, trackSurveyCompleteAction } from '@/app/survey/[surveyId]/actions'
import type { Survey, SurveyQuestion } from '@/lib/survey-types'

type SurveyResponseFormProps = {
  survey: Survey
}

export default function SurveyResponseForm({ survey }: SurveyResponseFormProps) {
  const router = useRouter()
  
  const [answers, setAnswers] = useState<Record<string, string | number>>({})
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submittedResponseId, setSubmittedResponseId] = useState<string | null>(null)

  // Phase 1 (audio): gated by per-survey flag
  const allowAudio = Boolean(survey.settings?.allowAudio)
  const [consentAudio, setConsentAudio] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioMimeType, setAudioMimeType] = useState<string | null>(null)
  const [audioDurationMs, setAudioDurationMs] = useState<number | null>(null)
  const [isUploadingAudio, setIsUploadingAudio] = useState(false)
  const [audioUploadProgress, setAudioUploadProgress] = useState<number | null>(null)
  const [voiceProcessingUi, setVoiceProcessingUi] = useState<{
    processingStatus: string
    audioStatus: string | null
    audioErrorCode: string | null
    videoStatus: string | null
    videoErrorCode: string | null
  } | null>(null)

  // Phase 2 foundation (video): gated by per-survey flag
  const allowVideo = Boolean(survey.settings?.allowVideo)
  const [consentVideo, setConsentVideo] = useState(false)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [isRecordingVideo, setIsRecordingVideo] = useState(false)
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoMimeType, setVideoMimeType] = useState<string | null>(null)
  const [videoDurationMs, setVideoDurationMs] = useState<number | null>(null)
  const [isUploadingVideo, setIsUploadingVideo] = useState(false)

  // Phase 3.5 (images): gated by per-survey flag
  const allowImages = Boolean(survey.settings?.allowImages)
  const [consentImages, setConsentImages] = useState(false)
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([])
  const [imageError, setImageError] = useState<string | null>(null)
  const [isUploadingImages, setIsUploadingImages] = useState(false)
  const MAX_IMAGES = 3
  const MAX_IMAGE_SIZE_MB = 5

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const recordingStartRef = useRef<number | null>(null)

  const videoRecorderRef = useRef<MediaRecorder | null>(null)
  const videoStreamRef = useRef<MediaStream | null>(null)
  const videoChunksRef = useRef<BlobPart[]>([])
  const videoRecordingStartRef = useRef<number | null>(null)

  // Track survey start when component mounts
  useEffect(() => {
    trackSurveyStartAction(survey.id).catch(console.error)
  }, [survey.id])

  // Cleanup audio URL + stream on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      mediaRecorderRef.current?.stop?.()
      mediaStreamRef.current?.getTracks()?.forEach(t => t.stop())

      if (videoUrl) URL.revokeObjectURL(videoUrl)
      videoRecorderRef.current?.stop?.()
      videoStreamRef.current?.getTracks()?.forEach(t => t.stop())

      imagePreviewUrls.forEach(url => URL.revokeObjectURL(url))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // After submit, poll a minimal public status endpoint so consumers see non-blocking progress.
  useEffect(() => {
    if (!isSubmitted) return
    if (!submittedResponseId) return

    const shouldPollAudio = allowAudio && Boolean(audioBlob)
    const shouldPollVideo = allowVideo && Boolean(videoBlob)
    if (!shouldPollAudio && !shouldPollVideo) return

    let cancelled = false
    let interval: number | null = null

    const poll = async () => {
      try {
        const res = await fetch(`/api/public/survey-responses/${submittedResponseId}/status`, {
          method: 'GET',
          cache: 'no-store',
        })
        if (!res.ok) return
        const payload: any = await res.json().catch(() => null)
        if (!payload?.success) return

        const processingStatus = String(payload?.response?.processingStatus || 'processing')
        const audioStatus = payload?.audio?.status ? String(payload.audio.status) : null
        const audioErrorCode = payload?.audio?.errorCode ? String(payload.audio.errorCode) : null
        const videoStatus = payload?.video?.status ? String(payload.video.status) : null
        const videoErrorCode = payload?.video?.errorCode ? String(payload.video.errorCode) : null

        if (!cancelled) {
          setVoiceProcessingUi({
            processingStatus,
            audioStatus,
            audioErrorCode,
            videoStatus,
            videoErrorCode,
          })
        }

        const terminal =
          processingStatus.toLowerCase() === 'ready' ||
          processingStatus.toLowerCase() === 'failed' ||
          (audioStatus && ['ready', 'failed', 'deleted'].includes(audioStatus.toLowerCase())) ||
          (videoStatus && ['ready', 'failed', 'deleted'].includes(videoStatus.toLowerCase()))

        if (terminal && interval !== null) {
          window.clearInterval(interval)
          interval = null
        }
      } catch {
        // ignore
      }
    }

    poll()
    interval = window.setInterval(poll, 5000)

    return () => {
      cancelled = true
      if (interval !== null) window.clearInterval(interval)
    }
  }, [isSubmitted, submittedResponseId, allowAudio, audioBlob, allowVideo, videoBlob])

  const handleAnswerChange = (questionId: string, value: string | number) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
    setError(null)
  }

  const validateForm = () => {
    // Check all required questions are answered
    const requiredQuestions = survey.questions.filter(q => q.required)
    for (const question of requiredQuestions) {
      if (!(question.id in answers) || answers[question.id] === undefined || answers[question.id] === '') {
        setError(`Please answer: "${question.question}"`)
        return false
      }
    }
    return true
  }

  const hasAnyTypedText = useMemo(() => {
    // If any text answer is a non-empty string, treat this as mixed when audio is present
    return Object.values(answers).some(v => typeof v === 'string' && v.trim().length > 0)
  }, [answers])

  const preferredAudioMimeType = useMemo(() => {
    // Best-effort, feature-detected selection.
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4',
    ]
    if (typeof MediaRecorder === 'undefined') return null
    for (const c of candidates) {
      if (MediaRecorder.isTypeSupported?.(c)) return c
    }
    return null
  }, [])

  const preferredVideoMimeType = useMemo(() => {
    const candidates = [
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9,opus',
      'video/webm',
      'video/mp4',
    ]
    if (typeof MediaRecorder === 'undefined') return null
    for (const c of candidates) {
      if (MediaRecorder.isTypeSupported?.(c)) return c
    }
    return null
  }, [])

  const resetAudio = () => {
    setAudioError(null)
    setAudioBlob(null)
    setAudioMimeType(null)
    setAudioDurationMs(null)
    setAudioUploadProgress(null)
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioUrl(null)
  }

  const resetVideo = () => {
    setVideoError(null)
    setVideoBlob(null)
    setVideoMimeType(null)
    setVideoDurationMs(null)
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setVideoUrl(null)
  }

  const stopRecording = () => {
    try {
      mediaRecorderRef.current?.stop()
    } catch (e) {
      // ignore
    }
    setIsRecording(false)
    mediaStreamRef.current?.getTracks()?.forEach(t => t.stop())
    mediaStreamRef.current = null
  }

  const stopVideoRecording = () => {
    try {
      videoRecorderRef.current?.stop()
    } catch (e) {
      // ignore
    }
    setIsRecordingVideo(false)
    videoStreamRef.current?.getTracks()?.forEach(t => t.stop())
    videoStreamRef.current = null
  }

  const startRecording = async () => {
    setAudioError(null)

    if (!consentAudio) {
      setAudioError('Please provide consent to record and upload audio.')
      return
    }
    if (isRecording) return
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setAudioError('Audio recording is not supported in this browser.')
      return
    }
    if (typeof MediaRecorder === 'undefined') {
      setAudioError('Audio recording is not supported in this browser.')
      return
    }

    // Reset previous recording
    resetAudio()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      chunksRef.current = []

      const mr = new MediaRecorder(stream, preferredAudioMimeType ? { mimeType: preferredAudioMimeType } : undefined)
      mediaRecorderRef.current = mr
      recordingStartRef.current = Date.now()

      mr.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mr.onerror = () => {
        setAudioError('Recording failed. Please try again.')
        stopRecording()
      }

      mr.onstop = () => {
        const mime = mr.mimeType || preferredAudioMimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: mime })
        setAudioBlob(blob)
        setAudioMimeType(mime)

        const url = URL.createObjectURL(blob)
        setAudioUrl(url)

        if (recordingStartRef.current) {
          setAudioDurationMs(Date.now() - recordingStartRef.current)
        }
        recordingStartRef.current = null
      }

      // Start with 1s timeslice so we get data periodically (helps memory / large blobs).
      mr.start(1000)
      setIsRecording(true)

      // Hard limit for Phase 1 to keep it startup-friendly and safe.
      window.setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') stopRecording()
      }, 60_000)
    } catch (e) {
      setAudioError('Microphone permission denied or unavailable.')
      stopRecording()
    }
  }

  const startVideoRecording = async () => {
    setVideoError(null)

    if (!consentVideo) {
      setVideoError('Please provide consent to record and upload video.')
      return
    }
    if (isRecordingVideo) return
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setVideoError('Video recording is not supported in this browser.')
      return
    }
    if (typeof MediaRecorder === 'undefined') {
      setVideoError('Video recording is not supported in this browser.')
      return
    }

    resetVideo()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      videoStreamRef.current = stream
      videoChunksRef.current = []

      const mr = new MediaRecorder(stream, preferredVideoMimeType ? { mimeType: preferredVideoMimeType } : undefined)
      videoRecorderRef.current = mr
      videoRecordingStartRef.current = Date.now()

      mr.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          videoChunksRef.current.push(event.data)
        }
      }

      mr.onerror = () => {
        setVideoError('Recording failed. Please try again.')
        stopVideoRecording()
      }

      mr.onstop = () => {
        const mime = mr.mimeType || preferredVideoMimeType || 'video/webm'
        const blob = new Blob(videoChunksRef.current, { type: mime })
        setVideoBlob(blob)
        setVideoMimeType(mime)

        const url = URL.createObjectURL(blob)
        setVideoUrl(url)

        if (videoRecordingStartRef.current) {
          setVideoDurationMs(Date.now() - videoRecordingStartRef.current)
        }
        videoRecordingStartRef.current = null
      }

      mr.start(1000)
      setIsRecordingVideo(true)

      window.setTimeout(() => {
        if (videoRecorderRef.current?.state === 'recording') stopVideoRecording()
      }, 15_000)
    } catch (e) {
      setVideoError('Camera/microphone permission denied or unavailable.')
      stopVideoRecording()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    if (allowAudio && audioBlob && !consentAudio) {
      setError('Please provide consent for audio before submitting.')
      return
    }
    if (allowVideo && videoBlob && !consentVideo) {
      setError('Please provide consent for video before submitting.')
      return
    }
    if (allowImages && imageFiles.length > 0 && !consentImages) {
      setError('Please provide consent for images before submitting.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const created = await submitSurveyResponse(
        survey.id,
        answers,
        userName || undefined,
        userEmail || undefined
      )
      setSubmittedResponseId(created.id)

      const modalityPrimary =
        audioBlob && videoBlob ? 'mixed' :
        videoBlob ? (hasAnyTypedText ? 'mixed' : 'video') :
        audioBlob ? (hasAnyTypedText ? 'mixed' : 'audio') :
        'text'

      if (allowAudio && audioBlob) {
        setIsUploadingAudio(true)
        setAudioUploadProgress(null)

        const fileExt = audioMimeType?.includes('mp4') ? 'mp4' : audioMimeType?.includes('ogg') ? 'ogg' : 'webm'
        const file = new File([audioBlob], `voice.${fileExt}`, { type: audioMimeType || 'audio/webm' })

        const formData = new FormData()
        formData.append('surveyId', survey.id)
        formData.append('responseId', created.id)
        formData.append('consentAudio', 'true')
        formData.append('mediaType', 'audio')
        formData.append('modalityPrimary', modalityPrimary)
        if (audioDurationMs !== null) {
          formData.append('durationMs', String(audioDurationMs))
        }
        formData.append('file', file)

        const uploadRes = await fetch('/api/uploads/feedback-media/server', {
          method: 'POST',
          body: formData,
        })

        if (!uploadRes.ok) {
          const payload = await uploadRes.json().catch(() => ({}))
          throw new Error(payload?.error || 'Voice upload failed')
        }

        setIsUploadingAudio(false)
        setAudioUploadProgress(null)
      }

      if (allowVideo && videoBlob) {
        setIsUploadingVideo(true)

        const fileExt =
          videoMimeType?.includes('mp4') ? 'mp4' :
          videoMimeType?.includes('quicktime') ? 'mov' :
          'webm'
        const file = new File([videoBlob], `video.${fileExt}`, { type: videoMimeType || 'video/webm' })

        const formData = new FormData()
        formData.append('surveyId', survey.id)
        formData.append('responseId', created.id)
        formData.append('consentVideo', 'true')
        formData.append('mediaType', 'video')
        formData.append('modalityPrimary', modalityPrimary)
        if (videoDurationMs !== null) {
          formData.append('durationMs', String(videoDurationMs))
        }
        formData.append('file', file)

        const uploadRes = await fetch('/api/uploads/feedback-media/server', {
          method: 'POST',
          body: formData,
        })

        if (!uploadRes.ok) {
          const payload = await uploadRes.json().catch(() => ({}))
          throw new Error(payload?.error || 'Video upload failed')
        }

        setIsUploadingVideo(false)
      } catch (err) {
        console.error('Video upload error:', err)
        setIsUploadingVideo(false)
      }
    }

    // Upload images if present (Phase 3.5)
    if (imageFiles.length > 0) {
      setIsUploadingImages(true)
      try {
        for (let i = 0; i < imageFiles.length; i++) {
          const file = imageFiles[i]
          const formData = new FormData()
          formData.append('surveyId', survey.id)
          formData.append('responseId', created.id)
          formData.append('consentImages', 'true')
          formData.append('mediaType', 'image')
          formData.append('imageIndex', String(i))
          formData.append('file', file)

          const uploadRes = await fetch('/api/uploads/feedback-media/server', {
            method: 'POST',
            body: formData,
          })

          if (!uploadRes.ok) {
            const payload = await uploadRes.json().catch(() => ({}))
            throw new Error(payload?.error || `Image ${i + 1} upload failed`)
          }
        }

        setIsUploadingImages(false)
      } catch (err) {
        console.error('Image upload error:', err)
        setIsUploadingImages(false)
      }
    }

      // Track survey completion
      await trackSurveyCompleteAction(survey.id)

      setIsSubmitted(true)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit response'
      console.error('Failed to submit response:', err)
      setError(errorMessage)
      setIsSubmitting(false)
      setIsUploadingAudio(false)
      setIsUploadingVideo(false)
      setIsUploadingImages(false)
    }
  }

  // Success state
  if (isSubmitted) {
    const audioStatus = voiceProcessingUi?.audioStatus?.toLowerCase?.() || null
    const processingStatus = voiceProcessingUi?.processingStatus?.toLowerCase?.() || null
    const voiceLabel = (() => {
      if (!allowAudio || !audioBlob) return null
      if (isUploadingAudio) return 'Uploading voice feedback…'
      if (audioStatus === 'ready' || processingStatus === 'ready') return 'Voice processed. Thank you!'
      if (audioStatus === 'failed' || processingStatus === 'failed') return 'Voice processing failed (your rating/text is saved).'
      if (audioStatus === 'uploaded') return 'Voice queued for processing…'
      if (audioStatus === 'processing' || processingStatus === 'processing') return 'Processing voice feedback…'
      return 'Voice queued for processing…'
    })()

    const videoStatus = voiceProcessingUi?.videoStatus?.toLowerCase?.() || null
    const videoLabel = (() => {
      if (!allowVideo || !videoBlob) return null
      if (isUploadingVideo) return 'Uploading video feedback…'
      if (videoStatus === 'ready' || processingStatus === 'ready') return 'Video processed. Thank you!'
      if (videoStatus === 'failed' || processingStatus === 'failed') return 'Video processing failed (your rating/text is saved).'
      if (videoStatus === 'uploaded') return 'Video queued for processing…'
      if (videoStatus === 'processing' || processingStatus === 'processing') return 'Processing video feedback…'
      return 'Video queued for processing…'
    })()

    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold">Thank you for your feedback!</h3>
            <p className="text-muted-foreground">
              Your response has been recorded successfully.
            </p>
            {allowAudio && audioBlob && (
              <p className="text-sm text-muted-foreground">
                If you recorded voice feedback, it may take a minute to process. Your rating/text is already saved.
              </p>
            )}
            {allowVideo && videoBlob && (
              <p className="text-sm text-muted-foreground">
                If you recorded video feedback, it may take a minute to process. Your rating/text is already saved.
              </p>
            )}
            {voiceLabel && (
              <div className="text-sm">
                <p className="text-muted-foreground">{voiceLabel}</p>
                {voiceProcessingUi?.audioErrorCode && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Code: {voiceProcessingUi.audioErrorCode}
                  </p>
                )}
              </div>
            )}
            {videoLabel && (
              <div className="text-sm">
                <p className="text-muted-foreground">{videoLabel}</p>
                {voiceProcessingUi?.videoErrorCode && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Code: {voiceProcessingUi.videoErrorCode}
                  </p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{survey.title}</CardTitle>
        {survey.description && (
          <p className="text-sm text-muted-foreground mt-2">{survey.description}</p>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Render each question */}
          {survey.questions.map((question, index) => (
            <QuestionRenderer
              key={question.id}
              question={question}
              questionNumber={index + 1}
              value={answers[question.id]}
              onChange={(value) => handleAnswerChange(question.id, value)}
            />
          ))}

          {/* Voice feedback (Phase 1) */}
          {allowAudio && (
            <div className="space-y-3 pt-4 border-t">
              <p className="text-sm font-medium">Voice feedback (optional)</p>

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="consent-audio"
                  checked={consentAudio}
                  onChange={(e) => setConsentAudio(e.target.checked)}
                  className="mt-1 rounded"
                />
                <div className="space-y-1">
                  <Label htmlFor="consent-audio" className="cursor-pointer">
                    I agree to share my voice recording for feedback analysis.
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    You can submit without voice. If you record, we’ll upload it securely.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!isRecording ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={startRecording}
                    disabled={isSubmitting || isUploadingAudio || !consentAudio}
                  >
                    <Mic className="w-4 h-4 mr-2" />
                    Record
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={stopRecording}
                    disabled={isSubmitting || isUploadingAudio}
                  >
                    <Square className="w-4 h-4 mr-2" />
                    Stop
                  </Button>
                )}

                {audioBlob && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={resetAudio}
                    disabled={isSubmitting || isUploadingAudio}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Re-record
                  </Button>
                )}
              </div>

              {audioUrl && (
                <div className="space-y-2">
                  <audio controls src={audioUrl} className="w-full" />
                  <p className="text-xs text-muted-foreground">
                    Ready to upload with your submission.
                    {audioDurationMs ? ` (~${Math.round(audioDurationMs / 1000)}s)` : ''}
                  </p>
                </div>
              )}

              {isUploadingAudio && (
                <p className="text-xs text-muted-foreground">
                  Uploading voice feedback…
                </p>
              )}

              {(audioError || (allowAudio && audioBlob && !consentAudio)) && (
                <div className="p-3 bg-destructive/10 border border-destructive rounded-lg">
                  <p className="text-sm text-destructive font-medium">
                    {audioError || 'Please provide consent for audio.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Video feedback (Phase 2 foundation) */}
          {allowVideo && (
            <div className="space-y-3 pt-4 border-t">
              <p className="text-sm font-medium">Video feedback (optional)</p>

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="consent-video"
                  checked={consentVideo}
                  onChange={(e) => setConsentVideo(e.target.checked)}
                  className="mt-1 rounded"
                />
                <div className="space-y-1">
                  <Label htmlFor="consent-video" className="cursor-pointer">
                    I agree to share my video recording for feedback review.
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    You can submit without video. If you record, we’ll upload it securely. (Max ~15s)
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!isRecordingVideo ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={startVideoRecording}
                    disabled={isSubmitting || isUploadingVideo || !consentVideo}
                  >
                    Record video
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={stopVideoRecording}
                    disabled={isSubmitting || isUploadingVideo}
                  >
                    Stop
                  </Button>
                )}

                {videoBlob && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={resetVideo}
                    disabled={isSubmitting || isUploadingVideo}
                  >
                    Re-record
                  </Button>
                )}
              </div>

              {videoUrl && (
                <div className="space-y-2">
                  <video controls src={videoUrl} className="w-full rounded" />
                  <p className="text-xs text-muted-foreground">
                    Ready to upload with your submission.
                    {videoDurationMs ? ` (~${Math.round(videoDurationMs / 1000)}s)` : ''}
                  </p>
                </div>
              )}

              {isUploadingVideo && (
                <p className="text-xs text-muted-foreground">
                  Uploading video feedback…
                </p>
              )}

              {videoError && (
                <div className="p-3 bg-destructive/10 border border-destructive rounded-lg">
                  <p className="text-sm text-destructive font-medium">
                    {videoError}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Phase 3.5: Image Feedback (optional, gated by allowImages) */}
          {allowImages && (
            <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="consent-images"
                  checked={consentImages}
                  onChange={(e) => setConsentImages(e.target.checked)}
                  className="mt-1 rounded"
                />
                <div className="space-y-1">
                  <Label htmlFor="consent-images" className="cursor-pointer">
                    I agree to share my images for feedback review.
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Upload photos (product defects, receipts, etc.). Max {MAX_IMAGES} images, {MAX_IMAGE_SIZE_MB}MB each.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <input
                  type="file"
                  id="image-upload"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  multiple
                  onChange={handleImageSelect}
                  disabled={isSubmitting || isUploadingImages || !consentImages || imageFiles.length >= MAX_IMAGES}
                  className="hidden"
                />
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('image-upload')?.click()}
                  disabled={isSubmitting || isUploadingImages || !consentImages || imageFiles.length >= MAX_IMAGES}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {imageFiles.length > 0 ? `Add more images (${imageFiles.length}/${MAX_IMAGES})` : 'Upload images'}
                </Button>

                {imagePreviewUrls.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {imagePreviewUrls.map((url, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={url}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-24 object-cover rounded border"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          disabled={isSubmitting || isUploadingImages}
                          className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                        <p className="text-xs text-center mt-1 text-muted-foreground truncate">
                          {imageFiles[index]?.name}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {isUploadingImages && (
                  <p className="text-xs text-muted-foreground">
                    Uploading images…
                  </p>
                )}

                {imageError && (
                  <div className="p-3 bg-destructive/10 border border-destructive rounded-lg">
                    <p className="text-sm text-destructive font-medium">
                      {imageError}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Optional user info */}
          {Object.keys(answers).length > 0 && (
            <div className="space-y-4 pt-4 border-t">
              <p className="text-sm font-medium">Your details (optional)</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm">Name</Label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive rounded-lg">
              <p className="text-sm text-destructive font-medium">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isSubmitting || isUploadingAudio || isUploadingVideo}
            className="w-full"
            size="lg"
          >
            {isSubmitting
              ? 'Submitting...'
              : isUploadingAudio
                ? 'Uploading voice…'
                : isUploadingVideo
                  ? 'Uploading video…'
                  : 'Submit Response'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// Question renderer component
function QuestionRenderer({
  question,
  questionNumber,
  value,
  onChange,
}: {
  question: SurveyQuestion
  questionNumber: number
  value: string | number | undefined
  onChange: (value: string | number) => void
}) {
  if (question.type === 'rating') {
    return (
      <div className="space-y-3">
        <Label className="text-base font-semibold">
          {questionNumber}. {question.question}
          {question.required && <span className="text-red-500 ml-1">*</span>}
        </Label>

        {question.scale === 10 ? (
          // NPS-style 0-10 rating
          <div className="space-y-3">
            <div className="grid grid-cols-11 gap-2">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => onChange(rating)}
                  className={`
                    aspect-square rounded-lg border-2 font-semibold text-lg
                    transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary
                    ${
                      value === rating
                        ? 'bg-primary text-primary-foreground border-primary shadow-md scale-105'
                        : 'bg-background border-border hover:border-primary'
                    }
                  `}
                >
                  {rating}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground px-1">
              <span>Not likely</span>
              <span>Very likely</span>
            </div>
          </div>
        ) : (
          // CSAT-style 1-5 star rating
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                type="button"
                onClick={() => onChange(rating)}
                className="focus:outline-none transition-transform hover:scale-110"
              >
                <Star
                  className={`w-10 h-10 ${
                    value && Number(value) >= rating
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300'
                  }`}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (question.type === 'multiple-choice') {
    return (
      <div className="space-y-3">
        <Label className="text-base font-semibold">
          {questionNumber}. {question.question}
          {question.required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        <div className="space-y-2">
          {question.options?.map((option, index) => (
            <button
              key={index}
              type="button"
              onClick={() => onChange(option)}
              className={`
                w-full p-3 border-2 rounded-lg text-left transition-all
                ${
                  value === option
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    value === option
                      ? 'border-primary bg-primary'
                      : 'border-muted-foreground'
                  }`}
                >
                  {value === option && (
                    <div className="w-2 h-2 bg-white rounded-full" />
                  )}
                </div>
                <span>{option}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Text question
  return (
    <div className="space-y-2">
      <Label htmlFor={question.id} className="text-base font-semibold">
        {questionNumber}. {question.question}
        {question.required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      <Textarea
        id={question.id}
        placeholder="Your answer..."
        value={value as string || ''}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="resize-none"
      />
    </div>
  )
}
