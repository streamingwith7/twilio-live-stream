'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { io, Socket } from 'socket.io-client'
import { PhoneNumber, CallStatus, User } from '@/types'
import Navigation from '@/components/Navigation'
import Dialer from '@/components/Dialer'
import LoadingSpinner from '@/components/LoadingSpinner'
import IncomingCallModal from '@/components/IncomingCallModal'
import RealTimeTranscription from '@/components/RealTimeTranscription'
import RealTimeCoaching from '@/components/RealTimeCoaching'
import CallStrategyWidget from '@/components/CallStrategyWidget'
import { useVoiceClient } from '@/hooks/useVoiceClient'

interface ActiveCall {
  callSid: string
  from: string
  to: string
  status: string
  direction: string
  timestamp: string
  caller: string
}

export default function MakeCallPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([])
  const [socket, setSocket] = useState<Socket | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [incomingCall, setIncomingCall] = useState<any>(null)
  const [callDuration, setCallDuration] = useState(0)
  const [activeCallSid, setActiveCallSid] = useState<string | undefined>(undefined)
  const [isCallActive, setIsCallActive] = useState(false)
  const router = useRouter()

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

  useEffect(() => {
    console.log('activeCallSid ----------------> ', activeCallSid);
  }, [activeCallSid])

  const handleCallStatusChange = useCallback((status: string, call: any) => {
    if (status === 'connected') {
      setIncomingCall(null)
      setIsCallActive(true)
      setSuccess('Call connected successfully')
      setTimeout(() => setSuccess(null), 3000)
    } else if (status === 'disconnected' || status === 'cancelled' || status === 'rejected') {
      setIncomingCall(null)
      setCallDuration(0)
      setIsCallActive(false)
      setActiveCallSid(undefined)
      if (status === 'disconnected') {
        setSuccess('Call ended')
        setTimeout(() => setSuccess(null), 3000)
      }
    }
  }, [])

  const voiceClient = useVoiceClient({
    user,
    onIncomingCall: handleIncomingCall,
    onCallStatusChange: handleCallStatusChange,
    onError: handleVoiceError
  })

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    const tempUser = JSON.parse(userData || '{}');
    if (!token || !userData) {
      router.push('/')
      return
    }

    setUser(tempUser)
    setLoading(false)
    
    const newSocket = io({
      auth: {
        token: token
      },
      transports: ['polling', 'websocket'],
      upgrade: true,
      timeout: 20000,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    })
    newSocket.on('callInitiated', (data: ActiveCall) => {
      if(data.caller.includes(tempUser?.id)) {
        setActiveCallSid(data.callSid)
        setIsCallActive(true)
        setSuccess(`Call initiated to ${data.to}`)
        setTimeout(() => setSuccess(null), 5000)
      }
    })

    newSocket.on('callStatusUpdate', (data: any) => {
      console.log('Call status update:', data)

      if (['completed', 'failed', 'busy', 'no-answer'].includes(data.status)) {
        if (data.callSid === activeCallSid) {
          setIsCallActive(false)
          setActiveCallSid(undefined)
        }
      }
    })


    newSocket.on('incomingCall', (data: any) => {
      console.log('🔔 Incoming call received via Socket.IO:', data)
      
      setIncomingCall({
        callSid: data.callSid,
        from: data.from,
        to: data.to,
        timestamp: data.timestamp
      })

      setActiveCallSid(data.callSid);

      console.log('📱 Incoming call modal should now be visible')
    })

    setSocket(newSocket)
    fetchPhoneNumbers(token)

    return () => {
      newSocket.disconnect()
    }
  }, [router])

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

  const handleCallInitiated = (callData: any) => {
    console.log('Call initiated from dialer:', callData)
    if (callData.type === 'browser-call') {
      setSuccess(`Browser call initiated to ${callData.to}`)
      setTimeout(() => setSuccess(null), 3000)
    }
  }

  const handleError = (errorMessage: string) => {
    setError(errorMessage)
    setTimeout(() => setError(null), 5000)
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ringing': return 'text-yellow-600 bg-yellow-100'
      case 'in-progress': return 'text-green-600 bg-green-100'
      case 'completed': return 'text-blue-600 bg-blue-100'
      case 'busy': return 'text-orange-600 bg-orange-100'
      case 'failed': return 'text-red-600 bg-red-100'
      case 'no-answer': return 'text-gray-600 bg-gray-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading application..." />
  }

  const isVoiceCallActive = voiceClient.activeCall && 
    (voiceClient.callStatus === 'connecting' || voiceClient.callStatus === 'ringing' || voiceClient.callStatus === 'connected')

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Navigation user={user} onLogout={handleLogout} />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900">Make Calls</h2>
            <p className="mt-2 text-gray-600">
              {voiceClient.isReady 
                ? 'Browser calling enabled - Make calls with high-quality audio directly in your browser'
                : 'Use your connected phone numbers to make outbound calls directly from the platform'
              }
            </p>
            {voiceClient.isReady && (
              <div className="mt-2 flex items-center text-sm text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                Voice client ready for browser calling
              </div>
            )}
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              {voiceClient.isLoadingToken && (
                <div className="mb-4 flex items-center justify-center p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <LoadingSpinner size="sm" message="Initializing voice calling..." />
                </div>
              )}
              <Dialer 
                phoneNumbers={phoneNumbers}
                onCallInitiated={handleCallInitiated}
                onError={handleError}
                voiceClient={voiceClient}
                activeCall={voiceClient.activeCall}
                callStatus={voiceClient.callStatus}
              />
            </div>
            <div>
              <CallStrategyWidget 
                callSid={activeCallSid || voiceClient.activeCall?.callSid}
                isCallActive={isCallActive || isVoiceCallActive}
                onError={handleError}
              />
            </div>
          </div>

          {(isCallActive || isVoiceCallActive) && (
            <div className="mt-8">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1">
                <details className="group">
                  <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 rounded">
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-700">Live Transcription</span>
                      <span className="text-xs text-gray-400">(Optional - Click to view)</span>
                    </div>
                    <svg className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <div className="border-t border-gray-100">
                    <RealTimeTranscription 
                      callSid={activeCallSid}
                      isCallActive={isCallActive}
                      onError={handleError}
                    />
                  </div>
                </details>
              </div>
            </div>
          )}
        </div>
      </main>

      <RealTimeCoaching 
        callSid={activeCallSid || voiceClient.activeCall?.callSid}
        isCallActive={isCallActive || isVoiceCallActive}
        onError={handleError}
      />

      {incomingCall && (
        <IncomingCallModal
          isOpen={true}
          callerNumber={incomingCall.from}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
          onClose={() => setIncomingCall(null)}
        />
      )}
    </div>
  )
} 