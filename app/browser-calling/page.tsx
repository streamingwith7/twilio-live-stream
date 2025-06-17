'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { io, Socket } from 'socket.io-client'
import { PhoneNumber, User } from '@/types'
import Navigation from '@/components/Navigation'
import Dialer from '@/components/Dialer'
import LoadingSpinner from '@/components/LoadingSpinner'
import IncomingCallModal from '@/components/IncomingCallModal'
import ActiveCallControls from '@/components/ActiveCallControls'
import { useVoiceClient } from '@/hooks/useVoiceClient'

export default function BrowserCallingPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([])
  const [socket, setSocket] = useState<Socket | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [incomingCall, setIncomingCall] = useState<any>(null)
  const [callDuration, setCallDuration] = useState(0)
  
  const router = useRouter()

  // Voice client handlers
  const handleVoiceError = useCallback((errorMessage: string) => {
    setError(errorMessage)
    setTimeout(() => setError(null), 5000)
  }, [])

  const handleIncomingCall = useCallback((call: any) => {
    setIncomingCall({
      callSid: call.sid || 'unknown',
      from: call.parameters?.From || 'Unknown Number',
      to: call.parameters?.To || '',
      timestamp: new Date().toISOString()
    })
  }, [])

  const handleCallStatusChange = useCallback((status: string, call: any) => {
    if (status === 'connected') {
      setIncomingCall(null)
    } else if (status === 'disconnected' || status === 'cancelled' || status === 'rejected') {
      setIncomingCall(null)
      setCallDuration(0)
    }
  }, [])

  // Voice client hook
  const voiceClient = useVoiceClient({
    user,
    onIncomingCall: handleIncomingCall,
    onCallStatusChange: handleCallStatusChange,
    onError: handleVoiceError
  })

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')

    if (!token || !userData) {
      router.push('/')
      return
    }

    setUser(JSON.parse(userData))
    setLoading(false)
    
    // Initialize WebSocket
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
      console.log('Connected to calling server')
    })

    newSocket.on('disconnect', () => {
      console.log('Disconnected from calling server')
    })

    // Listen for incoming calls from traditional phone system
    newSocket.on('incomingCall', (data: any) => {
      console.log('🔔 Incoming call received via Socket.IO:', data)
      
      // Don't show modal for this - just prepare for the incoming browser call
      // The Twilio Voice SDK will handle showing the actual call modal
      
      // Show a brief notification that a call is incoming
      setSuccess(`Incoming call from ${data.from} - Connecting...`)
      setTimeout(() => setSuccess(null), 3000)
      
      console.log('📱 Incoming call prepared - Twilio Voice SDK will handle the actual call')
    })

    setSocket(newSocket)
    fetchPhoneNumbers(token)

    return () => {
      newSocket.disconnect()
    }
  }, [router])

  // Call duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout
    
    if (voiceClient.callStatus === 'connected' && voiceClient.activeCall) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1)
      }, 1000)
    } else {
      setCallDuration(0)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [voiceClient.callStatus, voiceClient.activeCall])

  const fetchPhoneNumbers = async (token: string) => {
    try {
      const response = await fetch('/api/twilio/phone-numbers', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (response.ok) {
        setPhoneNumbers(data.phoneNumbers)
      } else {
        setError(data.error || 'Failed to fetch phone numbers')
      }
    } catch (error) {
      setError('Failed to connect to phone service')
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

  const handleAcceptCall = () => {
    voiceClient.answerCall()
    setIncomingCall(null)
  }

  const handleRejectCall = () => {
    voiceClient.rejectCall()
    setIncomingCall(null)
  }

  const handleHangupCall = () => {
    voiceClient.hangupCall()
  }

  const handleMuteToggle = () => {
    voiceClient.toggleMute()
  }

  const handleVolumeChange = (newVolume: number) => {
    voiceClient.adjustVolume(newVolume)
  }

  const handleBrowserCall = async (phoneNumber: string) => {
    try {
      setSuccess(`Initiating browser call to ${phoneNumber}`)
      await voiceClient.makeCall(phoneNumber)
      setTimeout(() => setSuccess(null), 5000)
    } catch (error) {
      setError('Failed to initiate browser call')
      setTimeout(() => setError(null), 5000)
    }
  }

  if (loading) {
    return <LoadingSpinner fullScreen />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Navigation user={user} onLogout={handleLogout} />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900">Browser Calling</h2>
            <p className="mt-2 text-gray-600">
              Make and receive calls directly in your browser with high-quality voice
            </p>
          </div>

          {/* Success Message */}
          {success && (
            <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {success}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          {/* Voice Client Status */}
          <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-3 ${voiceClient.isReady ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm font-medium text-gray-700">
                Browser Voice: {voiceClient.isReady ? 'Ready for calls' : 'Initializing...'}
              </span>
              {!voiceClient.isReady && (
                <div className="ml-2">
                  <LoadingSpinner size="sm" />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Dialer Section */}
            <div>
              <Dialer 
                phoneNumbers={phoneNumbers}
                onCallInitiated={handleBrowserCall}
                onError={handleVoiceError}
              />
            </div>

            {/* Active Call Controls */}
            <div>
              {voiceClient.activeCall && voiceClient.callStatus !== 'idle' && (
                <ActiveCallControls
                  callStatus={voiceClient.callStatus}
                  callerNumber={voiceClient.activeCall.parameters?.From || voiceClient.activeCall.to || 'Unknown'}
                  isMuted={voiceClient.isMuted}
                  volume={voiceClient.volume}
                  onMute={handleMuteToggle}
                  onHangup={handleHangupCall}
                  onVolumeChange={handleVolumeChange}
                  callDuration={callDuration}
                />
              )}

              {/* Call Instructions */}
              {!voiceClient.activeCall && voiceClient.callStatus === 'idle' && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">How Browser Calling Works</h3>
                  <div className="space-y-3 text-sm text-gray-600">
                    <div className="flex items-start">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                      <div>
                        <strong>Outbound Calls:</strong> Use the dialer to call any phone number directly from your browser
                      </div>
                    </div>
                    <div className="flex items-start">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                      <div>
                        <strong>Incoming Calls:</strong> Receive calls from any phone to your Twilio numbers in the browser
                      </div>
                    </div>
                    <div className="flex items-start">
                      <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                      <div>
                        <strong>Browser Notifications:</strong> Get desktop notifications for incoming calls
                      </div>
                    </div>
                    <div className="flex items-start">
                      <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                      <div>
                        <strong>Call Controls:</strong> Mute, adjust volume, and manage calls directly in the browser
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Incoming Call Modal */}
      {incomingCall && (
        <IncomingCallModal
          isOpen={!!incomingCall}
          callerNumber={incomingCall.from}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
          onClose={() => setIncomingCall(null)}
        />
      )}
    </div>
  )
} 