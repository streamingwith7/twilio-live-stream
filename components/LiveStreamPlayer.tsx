'use client'

import { useEffect, useState, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

interface LiveStreamPlayerProps {
  callSid: string
  phoneNumber: string
  onStreamEnd?: () => void
}

interface StreamEvent {
  streamSid: string
  callSid: string
  status: string
  timestamp: string
}

interface AudioData {
  streamSid: string
  callSid: string
  audioData: string
  timestamp: string
}

export default function LiveStreamPlayer({ 
  callSid, 
  phoneNumber, 
  onStreamEnd 
}: LiveStreamPlayerProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [streamStatus, setStreamStatus] = useState<string>('connecting')
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  const [socket, setSocket] = useState<Socket | null>(null)
  const [volume, setVolume] = useState(0.8)
  const [error, setError] = useState<string | null>(null)
  
  const audioContextRef = useRef<AudioContext | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const audioBufferQueue = useRef<AudioBuffer[]>([])
  const isProcessingAudio = useRef(false)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    // Initialize Socket.IO connection
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
      console.log('Connected to streaming server')
      setIsConnected(true)
      setStreamStatus('connected')
      
      // Join the call room for this specific call
      newSocket.emit('joinCallRoom', callSid)
    })

    newSocket.on('disconnect', () => {
      console.log('Disconnected from streaming server')
      setIsConnected(false)
      setStreamStatus('disconnected')
    })

    // Listen for stream events
    newSocket.on('streamStarted', (data: StreamEvent) => {
      console.log('Stream started:', data)
      setStreamStatus('streaming')
      initializeAudioContext()
    })

    newSocket.on('streamStopped', (data: StreamEvent) => {
      console.log('Stream stopped:', data)
      setStreamStatus('stopped')
      setIsPlaying(false)
      cleanupAudioContext()
      if (onStreamEnd) onStreamEnd()
    })

    newSocket.on('audioData', (data: AudioData) => {
      if (data.callSid === callSid) {
        processAudioData(data.audioData)
      }
    })

    newSocket.on('error', (error: any) => {
      console.error('Socket error:', error)
      setError('Connection error occurred')
    })

    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
      cleanupAudioContext()
    }
  }, [callSid, onStreamEnd])

  const initializeAudioContext = async () => {
    try {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)()
      const gainNode = context.createGain()
      gainNode.connect(context.destination)
      gainNode.gain.value = volume

      audioContextRef.current = context
      gainNodeRef.current = gainNode
      setAudioContext(context)
      
      console.log('Audio context initialized')
    } catch (err) {
      console.error('Failed to initialize audio context:', err)
      setError('Audio initialization failed')
    }
  }

  const cleanupAudioContext = () => {
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    gainNodeRef.current = null
    audioBufferQueue.current = []
    setAudioContext(null)
  }

  const processAudioData = async (base64Audio: string) => {
    if (!audioContextRef.current || !gainNodeRef.current || isProcessingAudio.current) {
      return
    }

    try {
      isProcessingAudio.current = true
      
      // Decode base64 audio data
      const audioData = atob(base64Audio)
      const audioBuffer = new ArrayBuffer(audioData.length)
      const view = new Uint8Array(audioBuffer)
      
      for (let i = 0; i < audioData.length; i++) {
        view[i] = audioData.charCodeAt(i)
      }

      // Decode audio buffer
      const decodedBuffer = await audioContextRef.current.decodeAudioData(audioBuffer)
      
      // Play the audio
      const source = audioContextRef.current.createBufferSource()
      source.buffer = decodedBuffer
      source.connect(gainNodeRef.current)
      source.start()
      
      if (!isPlaying) {
        setIsPlaying(true)
      }
      
    } catch (err) {
      console.error('Error processing audio data:', err)
    } finally {
      isProcessingAudio.current = false
    }
  }

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume)
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = newVolume
    }
  }

  const handlePlayPause = async () => {
    if (!audioContext) {
      await initializeAudioContext()
      return
    }

    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    } else if (audioContext.state === 'running') {
      await audioContext.suspend()
    }
  }

  const getStatusColor = () => {
    switch (streamStatus) {
      case 'streaming': return 'text-green-600'
      case 'connected': return 'text-blue-600'
      case 'connecting': return 'text-yellow-600'
      case 'stopped': return 'text-gray-600'
      case 'disconnected': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getStatusText = () => {
    switch (streamStatus) {
      case 'streaming': return 'Live Stream Active'
      case 'connected': return 'Connected - Waiting for Stream'
      case 'connecting': return 'Connecting...'
      case 'stopped': return 'Stream Ended'
      case 'disconnected': return 'Disconnected'
      default: return 'Unknown Status'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Live Audio Stream</h3>
          <p className="text-sm text-gray-500">
            {phoneNumber} • Call ID: {callSid.substring(0, 8)}...
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${streamStatus === 'streaming' ? 'bg-green-500 animate-pulse' : 
            streamStatus === 'connected' ? 'bg-blue-500' : 
            streamStatus === 'connecting' ? 'bg-yellow-500' : 'bg-gray-400'}`}>
          </div>
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {/* Audio Controls */}
        <div className="flex items-center space-x-4">
          <button
            onClick={handlePlayPause}
            disabled={!isConnected || streamStatus === 'stopped'}
            className={`flex items-center justify-center w-12 h-12 rounded-full transition-colors ${
              isPlaying 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-green-500 hover:bg-green-600 text-white'
            } ${!isConnected || streamStatus === 'stopped' ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isPlaying ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </button>

          {/* Volume Control */}
          <div className="flex items-center space-x-2 flex-1">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-sm text-gray-500 w-12">{Math.round(volume * 100)}%</span>
          </div>
        </div>

        {/* Stream Info */}
        <div className="text-xs text-gray-500">
          {streamStatus === 'streaming' && (
            <p>🔴 Real-time audio streaming from {phoneNumber}</p>
          )}
          {streamStatus === 'connected' && (
            <p>⏳ Waiting for call to start streaming...</p>
          )}
          {streamStatus === 'stopped' && (
            <p>⏹️ Stream has ended</p>
          )}
        </div>
      </div>
    </div>
  )
} 