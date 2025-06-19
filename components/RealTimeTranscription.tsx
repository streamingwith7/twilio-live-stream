'use client'

import { useState, useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

interface TranscriptMessage {
  transcript: string
  confidence?: number
  timestamp: string
  final: boolean
  track: 'inbound_track' | 'outbound_track'
  callSid: string
}

interface RealTimeTranscriptionProps {
  callSid?: string
  isCallActive: boolean
  onError?: (error: string) => void
}

export default function RealTimeTranscription({ 
  callSid, 
  isCallActive, 
  onError 
}: RealTimeTranscriptionProps) {
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcriptMessages, setTranscriptMessages] = useState<TranscriptMessage[]>([])
  const [currentTranscript, setCurrentTranscript] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [socket, setSocket] = useState<Socket | null>(null)
  const transcriptContainerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight
    }
  }, [transcriptMessages, currentTranscript])

  // Initialize socket connection
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token || !isCallActive) return

    const newSocket = io({
      auth: { token },
      transports: ['polling', 'websocket'],
      upgrade: true,
      timeout: 20000,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    })

    newSocket.on('connect', () => {
      console.log('📞 Connected to transcription socket')
      if (callSid) {
        newSocket.emit('joinTranscriptionRoom', callSid)
      }
    })

    newSocket.on('transcriptionStarted', (data) => {
      console.log('🎙️ Transcription started:', data)
      setIsTranscribing(true)
      setError(null)
    })

    newSocket.on('transcriptionContent', (data) => {
      console.log('📝 Transcription content:', data)
      
      if (data.Final === 'true') {
        // Final transcript
        const transcriptData = JSON.parse(data.TranscriptionData)
        const message: TranscriptMessage = {
          transcript: transcriptData.transcript,
          confidence: transcriptData.confidence,
          timestamp: data.Timestamp,
          final: true,
          track: data.Track,
          callSid: data.CallSid
        }
        
        setTranscriptMessages(prev => [...prev, message])
        setCurrentTranscript('')
      } else {
        // Interim transcript
        const transcriptData = JSON.parse(data.TranscriptionData)
        setCurrentTranscript(transcriptData.transcript)
      }
    })

    newSocket.on('transcriptionStopped', (data) => {
      console.log('🛑 Transcription stopped:', data)
      setIsTranscribing(false)
      setCurrentTranscript('')
    })

    newSocket.on('transcriptionError', (data) => {
      console.error('❌ Transcription error:', data)
      setError(data.TranscriptionError || 'Transcription error occurred')
      setIsTranscribing(false)
      onError?.(data.TranscriptionError || 'Transcription error occurred')
    })

    newSocket.on('disconnect', () => {
      console.log('📞 Disconnected from transcription socket')
      setIsTranscribing(false)
    })

    newSocket.on('connect_error', (error) => {
      console.error('💥 Socket connection error:', error)
      setError('Failed to connect to transcription service')
    })

    setSocket(newSocket)

    return () => {
      if (callSid) {
        newSocket.emit('leaveTranscriptionRoom', callSid)
      }
      newSocket.disconnect()
    }
  }, [callSid, isCallActive])

  const startTranscription = async () => {
    if (!callSid) {
      setError('No active call to transcribe')
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/twilio/start-transcription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          callSid,
          languageCode: 'en-US',
          track: 'both_tracks'
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setIsTranscribing(true)
        setError(null)
        setTranscriptMessages([])
      } else {
        setError(data.error || 'Failed to start transcription')
        onError?.(data.error || 'Failed to start transcription')
      }
    } catch (error: any) {
      console.error('Error starting transcription:', error)
      setError('Failed to start transcription')
      onError?.('Failed to start transcription')
    }
  }

  const stopTranscription = async () => {
    if (!callSid) return

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/twilio/stop-transcription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ callSid })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setIsTranscribing(false)
        setCurrentTranscript('')
      } else {
        setError(data.error || 'Failed to stop transcription')
      }
    } catch (error: any) {
      console.error('Error stopping transcription:', error)
      setError('Failed to stop transcription')
    }
  }

  const clearTranscripts = () => {
    setTranscriptMessages([])
    setCurrentTranscript('')
  }

  const getSpeakerLabel = (track: string) => {
    return track === 'inbound_track' ? 'Caller' : 'Agent'
  }

  const getSpeakerColor = (track: string) => {
    return track === 'inbound_track' ? 'text-blue-600' : 'text-green-600'
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  if (!isCallActive) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center text-gray-500">
          <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          <p>Start a call to enable real-time transcription</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <svg className="mr-2 h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            Real-Time Transcription
          </h3>
          <div className="flex items-center space-x-3">
            {isTranscribing && (
              <div className="flex items-center text-sm text-red-600">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-2"></div>
                LIVE
              </div>
            )}
            <div className="flex space-x-2">
              {!isTranscribing ? (
                <button
                  onClick={startTranscription}
                  disabled={!callSid}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Start Transcription
                </button>
              ) : (
                <button
                  onClick={stopTranscription}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 flex items-center"
                >
                  <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9l6 6m0-6l-6 6" />
                  </svg>
                  Stop Transcription
                </button>
              )}
              <button
                onClick={clearTranscripts}
                className="px-3 py-2 bg-gray-500 text-white text-sm font-medium rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
                title="Clear transcripts"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border-b border-red-200 text-red-600 text-sm">
          {error}
        </div>
      )}

      <div 
        ref={transcriptContainerRef}
        className="h-64 overflow-y-auto p-4 space-y-3"
      >
        {transcriptMessages.length === 0 && !currentTranscript && (
          <div className="text-center text-gray-500 py-8">
            <svg className="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.955 8.955 0 01-2.318-.306C9.2 18.68 7.65 17.03 7 15c-.732-2.292-.732-4.708 0-7 .65-2.03 2.2-3.68 3.682-4.694A8.955 8.955 0 0113 3c4.418 0 8 3.582 8 8z" />
            </svg>
            {isTranscribing ? 'Listening for speech...' : 'No transcripts yet'}
          </div>
        )}

        {transcriptMessages.map((message, index) => (
          <div key={index} className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className={`text-sm font-medium ${getSpeakerColor(message.track)}`}>
                {getSpeakerLabel(message.track)}
              </span>
              <span className="text-xs text-gray-500">
                {formatTimestamp(message.timestamp)}
              </span>
            </div>
            <p className="text-gray-900">{message.transcript}</p>
            {message.confidence && (
              <div className="mt-1 text-xs text-gray-500">
                Confidence: {Math.round(message.confidence * 100)}%
              </div>
            )}
          </div>
        ))}

        {currentTranscript && (
          <div className="bg-blue-50 rounded-lg p-3 border-l-4 border-blue-400">
            <div className="flex items-center mb-1">
              <span className="text-sm font-medium text-blue-600">Live:</span>
              <div className="ml-2 flex space-x-1">
                <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse"></div>
                <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse" style={{animationDelay: '0.1s'}}></div>
                <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
              </div>
            </div>
            <p className="text-blue-900 italic">{currentTranscript}</p>
          </div>
        )}
      </div>

      <div className="p-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
        <div className="flex items-center justify-between">
          <span>
            Total transcripts: {transcriptMessages.length}
          </span>
          {isTranscribing && (
            <span className="text-green-600">
              ● Powered by Twilio Real-Time Transcription
            </span>
          )}
        </div>
      </div>
    </div>
  )
} 