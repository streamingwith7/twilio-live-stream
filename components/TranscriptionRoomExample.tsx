'use client'

import { useState, useEffect } from 'react'
import { io, Socket } from 'socket.io-client'

interface TranscriptionRoomExampleProps {
  callSid: string
  onTranscriptReceived?: (transcript: any) => void
}

/**
 * Example component demonstrating the new transcription room functionality
 * This shows how to use the dedicated transcription room events for better organization
 */
export default function TranscriptionRoomExample({ 
  callSid, 
  onTranscriptReceived 
}: TranscriptionRoomExampleProps) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [transcriptionStatus, setTranscriptionStatus] = useState<'inactive' | 'active'>('inactive')
  const [transcripts, setTranscripts] = useState<any[]>([])
  const [activeTranscriptions, setActiveTranscriptions] = useState<any[]>([])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

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
      console.log('🎙️ Connected to transcription socket')
      setIsConnected(true)
      
      newSocket.emit('joinTranscriptionRoom', callSid)
      
      newSocket.emit('requestTranscriptionStatus', callSid)
      
      newSocket.emit('getActiveTranscriptions')
    })

    newSocket.on('disconnect', () => {
      console.log('🎙️ Disconnected from transcription socket')
      setIsConnected(false)
    })

    newSocket.on('transcriptionRoomJoined', (data) => {
      console.log('✅ Joined transcription room:', data)
    })

    newSocket.on('transcriptionRoomLeft', (data) => {
      console.log('👋 Left transcription room:', data)
    })

    newSocket.on('transcriptionRoomError', (data) => {
      console.error('❌ Transcription room error:', data.error)
    })

    newSocket.on('transcriptionStatus', (data) => {
      console.log('📊 Transcription status:', data)
      setTranscriptionStatus(data.status)
    })

    newSocket.on('transcriptionStatusError', (data) => {
      console.error('❌ Transcription status error:', data.error)
    })

    newSocket.on('transcriptionReady', (data) => {
      if (data.callSid === callSid) {
        console.log('🎙️ Transcription ready:', data)
        setTranscriptionStatus('active')
      }
    })

    newSocket.on('transcriptionEnded', (data) => {
      if (data.callSid === callSid) {
        console.log('🛑 Transcription ended:', data)
        setTranscriptionStatus('inactive')
      }
    })

    newSocket.on('liveTranscript', (data) => {
      if (data.callSid === callSid) {
        console.log('📝 Live transcript:', data)
        
        if (data.type === 'final') {
          setTranscripts(prev => [...prev, data])
          onTranscriptReceived?.(data)
        }
      }
    })

    newSocket.on('transcriptionError', (data) => {
      if (data.callSid === callSid) {
        console.error('❌ Transcription error:', data.error)
      }
    })

    newSocket.on('activeTranscriptions', (data) => {
      console.log('📋 Active transcriptions:', data)
      setActiveTranscriptions(data.transcriptions)
    })

    const heartbeatInterval = setInterval(() => {
      if (newSocket.connected) {
        newSocket.emit('heartbeat', { timestamp: Date.now() })
      }
    }, 30000)

    newSocket.on('heartbeatAck', (data) => {
      console.log('💓 Heartbeat acknowledged:', data)
    })

    setSocket(newSocket)

    return () => {
      clearInterval(heartbeatInterval)
      if (callSid) {
        newSocket.emit('leaveTranscriptionRoom', callSid)
      }
      newSocket.disconnect()
    }
  }, [callSid])

  const refreshTranscriptionStatus = () => {
    if (socket) {
      socket.emit('requestTranscriptionStatus', callSid)
    }
  }

  const refreshActiveTranscriptions = () => {
    if (socket) {
      socket.emit('getActiveTranscriptions')
    }
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-4">Transcription Room Example</h3>
      
      <div className="mb-4">
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm">
            {isConnected ? 'Connected to transcription room' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Transcription Status */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${
              transcriptionStatus === 'active' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
            }`}></div>
            <span className="text-sm">
              Transcription: {transcriptionStatus}
            </span>
          </div>
          <button
            onClick={refreshTranscriptionStatus}
            className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Refresh Status
          </button>
        </div>
      </div>

      {/* Active Transcriptions */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-md font-medium">Active Transcriptions ({activeTranscriptions.length})</h4>
          <button
            onClick={refreshActiveTranscriptions}
            className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
          >
            Refresh List
          </button>
        </div>
        <div className="max-h-32 overflow-y-auto">
          {activeTranscriptions.map((transcription, index) => (
            <div key={index} className="text-xs bg-gray-100 p-2 mb-1 rounded">
              <div>Call: {transcription.callSid}</div>
              <div>Stream: {transcription.streamSid}</div>
              <div>Started: {new Date(transcription.startTime).toLocaleTimeString()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Transcripts */}
      <div className="mb-4">
        <h4 className="text-md font-medium mb-2">Live Transcripts ({transcripts.length})</h4>
        <div className="max-h-48 overflow-y-auto bg-gray-50 p-3 rounded">
          {transcripts.map((transcript, index) => (
            <div key={index} className="mb-2 p-2 bg-white rounded text-sm">
              <div className="text-xs text-gray-500 mb-1">
                {new Date(transcript.timestamp).toLocaleTimeString()} - 
                Confidence: {Math.round((transcript.confidence || 0) * 100)}%
              </div>
              <div>{transcript.text}</div>
            </div>
          ))}
          {transcripts.length === 0 && (
            <div className="text-gray-500 text-sm">No transcripts yet...</div>
          )}
        </div>
      </div>

      {/* Call Info */}
      <div className="text-xs text-gray-500">
        Call SID: {callSid}
      </div>
    </div>
  )
} 