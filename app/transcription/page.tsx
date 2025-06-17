'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { io, Socket } from 'socket.io-client'
import { User } from '@/types'
import Navigation from '@/components/Navigation'
import LoadingSpinner from '@/components/LoadingSpinner'
import { formatDirection } from '@/utils/callUtils'

interface TranscriptMessage {
  callSid: string
  text: string
  type: 'interim' | 'final'
  timestamp: string
}

interface CallDetails {
  from: string
  to: string
  direction: string
}

interface StreamResponse {
  error: string
  success: boolean
  originalCallSid: string
  streamSid: string
  streamName: string
  streamingEnabled: boolean
  callDetails: CallDetails
}

export default function TranscriptionPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [socket, setSocket] = useState<Socket | null>(null)
  const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([])
  const [currentInterim, setCurrentInterim] = useState<string>('')
  const [streamActive, setStreamActive] = useState(false)
  const [streamError, setStreamError] = useState('')
  const [callDetails, setCallDetails] = useState<CallDetails | null>(null)
  const [streamSid, setStreamSid] = useState<string | null>(null)
  const [isStartingStream, setIsStartingStream] = useState(false)
  const [isStoppingStream, setIsStoppingStream] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()
  const callSid = searchParams.get('callSid')
  const phoneNumber = searchParams.get('phone')

  const startTranscription = async () => {
    if (!callSid) return

    setIsStartingStream(true)
    setStreamError('')

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/twilio/convert-conference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ callSid })
      })

      const data: StreamResponse = await response.json()

      if (response.ok && data.success) {
        setStreamActive(true)
        setCallDetails(data.callDetails)
        setStreamSid(data.streamSid)
        setTranscripts([]) // Clear previous transcripts
        setCurrentInterim('')
      } else {
        setStreamError(data.error || 'Failed to start transcription')
      }
    } catch (error) {
      setStreamError('Failed to start transcription')
      console.error('Error starting transcription:', error)
    } finally {
      setIsStartingStream(false)
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')

    if (!token || !userData) {
      router.push('/')
      return
    }

    if (!callSid || !phoneNumber) {
      router.push('/dashboard')
      return
    }

    setUser(JSON.parse(userData))
    setLoading(false)

    // Initialize Socket.IO connection
    const newSocket = io({
      auth: {
        token: token
      }
    })

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket server')
      // Join the specific call room for targeted updates
      newSocket.emit('joinCallRoom', callSid)

      // Auto-start transcription when connected
      startTranscription()
    })

    newSocket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server')
    })

    newSocket.on('transcriptionReady', (data: { callSid: string; streamSid: string; timestamp: string }) => {
      if (data.callSid === callSid) {
        console.log('Transcription ready for call:', data.callSid)
        setStreamError('')
      }
    })

    newSocket.on('transcriptionEnded', (data: { callSid: string; streamSid: string; timestamp: string }) => {
      if (data.callSid === callSid) {
        console.log('Transcription ended for call:', data.callSid)
        setStreamActive(false)
        setStreamSid(null)
      }
    })

    newSocket.on('liveTranscript', (data: TranscriptMessage) => {
      if (data.callSid === callSid) {
        if (data.type === 'interim') {
          setCurrentInterim(data.text)
        } else {
          setTranscripts(prev => [...prev, data])
          setCurrentInterim('')
        }
      }
    })

    newSocket.on('utteranceEnd', (data: { callSid: string; streamSid: string; timestamp: string }) => {
      if (data.callSid === callSid) {
        setCurrentInterim('')
      }
    })

    newSocket.on('speechStarted', (data: { callSid: string; streamSid: string; timestamp: string }) => {
      if (data.callSid === callSid) {
        console.log('Speech started for call:', data.callSid)
      }
    })

    newSocket.on('transcriptionError', (data: { callSid: string; streamSid: string; error: string; timestamp: string }) => {
      if (data.callSid === callSid) {
        setStreamError(`Transcription error: ${data.error}`)
        setStreamActive(false)
      }
    })

    newSocket.on('streamStatus', (data: { streamSid: string; callSid: string; status: string; timestamp: string }) => {
      if (data.callSid === callSid) {
        console.log('Stream status update:', data.status)
        if (data.status === 'stopped') {
          setStreamActive(false)
          setStreamSid(null)
        }
      }
    })

    setSocket(newSocket)

    return () => {
      if (callSid) {
        newSocket.emit('leaveCallRoom', callSid)
      }
      newSocket.disconnect()
    }
  }, [router, callSid, phoneNumber])

  const stopTranscription = async () => {
    if (!callSid || !streamSid) return

    setIsStoppingStream(true)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/twilio/convert-conference', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ callSid, streamSid })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setStreamActive(false)
        setStreamSid(null)
      } else {
        setStreamError(data.error || 'Failed to stop transcription')
      }
    } catch (error) {
      setStreamError('Failed to stop transcription')
      console.error('Error stopping transcription:', error)
    } finally {
      setIsStoppingStream(false)
    }
  }

  const handleLogout = () => {
    if (socket) {
      socket.disconnect()
    }
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/')
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  const downloadTranscript = () => {
    if (transcripts.length === 0) return

    const transcriptText = transcripts
      .map(t => `[${formatTimestamp(t.timestamp)}] ${t.text}`)
      .join('\n')

    const blob = new Blob([transcriptText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transcript-${callSid}-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const clearTranscripts = () => {
    setTranscripts([])
    setCurrentInterim('')
  }

  if (loading) {
    return <LoadingSpinner fullScreen />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Navigation user={user} onLogout={handleLogout} />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <button
                  onClick={() => router.push(`/call-logs?phone=${encodeURIComponent(phoneNumber || '')}`)}
                  className="flex items-center text-blue-600 hover:text-blue-800 mb-4"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to Call Logs
                </button>
                <h2 className="text-3xl font-bold text-gray-900">Real-time Transcription</h2>
                <p className="mt-2 text-gray-600">
                  Live transcription for call {callSid?.slice(-8)}
                  {callDetails && (
                    <span className="ml-2">
                      • {callDetails.from} → {callDetails.to} ({formatDirection(callDetails.direction)})
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center space-x-4">
                {streamActive && (
                  <button
                    onClick={stopTranscription}
                    disabled={isStoppingStream}
                    className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {isStoppingStream ? (
                      <svg className="w-5 h-5 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-6.219-8.56" />
                      </svg>
                    )}
                    {isStoppingStream ? 'Stopping...' : 'Stop Transcription'}
                  </button>
                )}

                {transcripts.length > 0 && (
                  <>
                    <button
                      onClick={downloadTranscript}
                      className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Download
                    </button>

                    <button
                      onClick={clearTranscripts}
                      className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Clear
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Connection Status */}
          <div className="mb-6">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${socket?.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm text-gray-600">
                  {socket?.connected ? 'WebSocket Connected' : 'Connecting...'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${streamActive ? 'bg-green-500 animate-pulse' : isStartingStream ? 'bg-yellow-500 animate-pulse' : 'bg-gray-400'}`}></div>
                <span className="text-sm text-gray-600">
                  {streamActive ? 'Transcription Active' : isStartingStream ? 'Starting Transcription...' : 'Transcription Inactive'}
                </span>
              </div>
            </div>
          </div>

          {/* Error State */}
          {streamError && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
              {streamError}
            </div>
          )}

          {/* Transcription Container */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Live Transcription</h3>
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <span>Total messages: {transcripts.length}</span>
                  {streamActive && (
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-2"></div>
                      LIVE
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6">
              {!streamActive && !isStartingStream && transcripts.length === 0 && (
                <div className="text-center py-16">
                  <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  <h3 className="text-xl font-medium text-gray-900 mb-2">Initializing Transcription</h3>
                  <p className="text-gray-500">
                    Setting up real-time speech-to-text for this call...
                  </p>
                </div>
              )}

              {(streamActive || transcripts.length > 0) && (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {transcripts.map((transcript, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-1.586l-4.707 4.707z" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">{transcript.text}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatTimestamp(transcript.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Current interim transcript */}
                  {currentInterim && streamActive && (
                    <div className="flex items-start space-x-3 p-3 bg-yellow-50 rounded-lg border-l-4 border-yellow-400">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-yellow-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 italic">{currentInterim}</p>
                        <p className="text-xs text-yellow-600 mt-1">Speaking...</p>
                      </div>
                    </div>
                  )}

                  {streamActive && transcripts.length === 0 && !currentInterim && (
                    <div className="text-center py-8">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-6 h-6 text-green-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                      </div>
                      <p className="text-gray-600">Listening for speech...</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}