'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { io, Socket } from 'socket.io-client'
import { PhoneNumber, CallStatus, User } from '@/types'
import Navigation from '@/components/Navigation'
import Dialer from '@/components/Dialer'
import LiveStreamPlayer from '@/components/LiveStreamPlayer'
import LoadingSpinner from '@/components/LoadingSpinner'
import IncomingCallModal from '@/components/IncomingCallModal'
import RealTimeTranscription from '@/components/RealTimeTranscription'
import RealTimeCoaching from '@/components/RealTimeCoaching'
import { useVoiceClient } from '@/hooks/useVoiceClient'

interface ActiveCall {
  callSid: string
  from: string
  to: string
  status: string
  direction: string
  timestamp: string
}

export default function MakeCallPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([])
  const [socket, setSocket] = useState<Socket | null>(null)
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [incomingCall, setIncomingCall] = useState<any>(null)
  const [callDuration, setCallDuration] = useState(0)
  const [activeCallSid, setActiveCallSid] = useState<string | undefined>(undefined)
  const [isCallActive, setIsCallActive] = useState(false)
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

    if (!token || !userData) {
      router.push('/')
      return
    }

    setUser(JSON.parse(userData))
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

    newSocket.on('connect', () => {
      console.log('Connected to calling server')
    })

    newSocket.on('disconnect', () => {
      console.log('Disconnected from calling server')
    })

    // Listen for call events
    newSocket.on('callInitiated', (data: ActiveCall) => {
      console.log('Call initiated:', data)
      setActiveCalls(prev => [...prev, data])
      setActiveCallSid(data.callSid)
      setIsCallActive(true)
      setSuccess(`Call initiated to ${data.to}`)
      setTimeout(() => setSuccess(null), 5000)
    })

    newSocket.on('callStatusUpdate', (data: any) => {
      console.log('Call status update:', data)
      setActiveCalls(prev => 
        prev.map(call => 
          call.callSid === data.callSid 
            ? { ...call, status: data.status, timestamp: data.timestamp }
            : call
        )
      )

      // Remove completed calls after a delay and update call state
      if (['completed', 'failed', 'busy', 'no-answer'].includes(data.status)) {
        if (data.callSid === activeCallSid) {
          setIsCallActive(false)
          setActiveCallSid(undefined)
        }
        setTimeout(() => {
          setActiveCalls(prev => prev.filter(call => call.callSid !== data.callSid))
        }, 10000) // Remove after 10 seconds
      }
    })

    newSocket.on('outboundCallStatus', (data: any) => {
      console.log('Outbound call status:', data)
      setActiveCalls(prev => 
        prev.map(call => 
          call.callSid === data.callSid 
            ? { ...call, status: data.status, timestamp: data.timestamp }
            : call
        )
      )
    })

    // Listen for incoming calls from Twilio webhooks
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

  // Call duration timer for browser calls
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
    // The socket event will handle adding server-side calls to active calls
  }

  const handleError = (errorMessage: string) => {
    setError(errorMessage)
    setTimeout(() => setError(null), 5000)
  }

  const handleStreamEnd = (callSid: string) => {
    setActiveCalls(prev => prev.filter(call => call.callSid !== callSid))
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
    return <LoadingSpinner fullScreen />
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
            {/* Left Column - Dialer */}
            <div>
              <Dialer 
                phoneNumbers={phoneNumbers}
                onCallInitiated={handleCallInitiated}
                onError={handleError}
                voiceClient={voiceClient}
                activeCall={voiceClient.activeCall}
                callStatus={voiceClient.callStatus}
              />
            </div>

            {/* Right Column - Active Call Controls or Server-side Calls */}
            <div className="space-y-6">
              {activeCalls.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    {isVoiceCallActive ? 'Server-side Calls' : 'Active Calls'}
                  </h3>
                  <div className="space-y-3">
                    {activeCalls.map((call) => (
                      <div key={call.callSid} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(call.status)}`}>
                                {call.status}
                              </span>
                              <span className="ml-2 text-sm text-gray-600">
                                {call.direction === 'outbound' ? 'To' : 'From'}: {call.direction === 'outbound' ? call.to : call.from}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              Call SID: {call.callSid}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-900">{call.direction === 'outbound' ? call.from : call.to}</div>
                            <div className="text-xs text-gray-500">
                              {new Date(call.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                        
                                                 {/* Live Stream Player for active calls */}
                         {(call.status === 'in-progress' || call.status === 'ringing') && (
                           <div className="mt-4">
                             <LiveStreamPlayer
                               callSid={call.callSid}
                               phoneNumber={call.direction === 'outbound' ? call.to : call.from}
                               onStreamEnd={() => handleStreamEnd(call.callSid)}
                             />
                        </div>
                         )}
                      </div>
                    ))}
                  </div>
                  </div>
                )}

              {/* Help Text */}
              {!isVoiceCallActive && activeCalls.length === 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">Ready to make calls</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      {voiceClient.isReady 
                        ? 'Enter a phone number and click Call to start a browser call with audio.'
                        : 'Enter a phone number on the left to start making calls.'
                      }
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Real-Time Transcription Widget - Separated and Less Prominent */}
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
        socket={socket}
        isCallActive={isCallActive || isVoiceCallActive}
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