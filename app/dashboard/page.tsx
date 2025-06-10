'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { io, Socket } from 'socket.io-client'

interface PhoneNumber {
  sid: string
  phoneNumber: string
  friendlyName: string
  capabilities: {
    voice: boolean
    sms: boolean
    mms: boolean
  }
}

interface CallStatus {
  phoneNumber: string
  status: 'idle' | 'ringing' | 'in-progress' | 'completed' | 'busy' | 'failed'
  callSid?: string
  from?: string
  to?: string
  duration?: number
  timestamp?: string
}

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([])
  const [callStatuses, setCallStatuses] = useState<Record<string, CallStatus>>({})
  const [socket, setSocket] = useState<Socket | null>(null)
  const [twilioError, setTwilioError] = useState('')
  const router = useRouter()

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
      }
    })

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket server')
    })

    newSocket.on('callStatusUpdate', (data: CallStatus) => {
      setCallStatuses(prev => ({
        ...prev,
        [data.phoneNumber]: data
      }))
    })

    setSocket(newSocket)
    fetchPhoneNumbers(token)

    return () => {
      newSocket.disconnect()
    }
  }, [router])

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
        const initialStatuses: Record<string, CallStatus> = {}
        data.phoneNumbers.forEach((phone: PhoneNumber) => {
          initialStatuses[phone.phoneNumber] = {
            phoneNumber: phone.phoneNumber,
            status: 'idle'
          }
        })
        setCallStatuses(initialStatuses)
      } else {
        setTwilioError(data.error || 'Failed to fetch phone numbers')
      }
    } catch (error) {
      setTwilioError('Failed to connect to Twilio service')
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

  const getStatusColor = (status: CallStatus['status']) => {
    switch (status) {
      case 'idle': return 'bg-gray-500'
      case 'ringing': return 'bg-yellow-500 animate-pulse'
      case 'in-progress': return 'bg-green-500 animate-pulse'
      case 'completed': return 'bg-blue-500'
      case 'busy': return 'bg-orange-500'
      case 'failed': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusText = (status: CallStatus['status']) => {
    switch (status) {
      case 'idle': return 'Ready'
      case 'ringing': return 'Ringing'
      case 'in-progress': return 'Active Call'
      case 'completed': return 'Call Ended'
      case 'busy': return 'Busy'
      case 'failed': return 'Failed'
      default: return 'Unknown'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-400 to-purple-600 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h1 className="text-xl font-bold text-gray-900">AI Deal Assistant Dashboard</h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">Welcome, {user?.firstName || user?.email}</span>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900">Phone Numbers & Call Status</h2>
            <p className="mt-2 text-gray-600">Monitor your Twilio phone numbers and real-time call activity</p>
          </div>

          <div className="mb-6">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${socket?.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm text-gray-600">
                {socket?.connected ? 'Real-time updates active' : 'Connecting to real-time updates...'}
              </span>
            </div>
          </div>

          {twilioError && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
              {twilioError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {phoneNumbers.map((phone) => {
              const callStatus = callStatuses[phone.phoneNumber] || { phoneNumber: phone.phoneNumber, status: 'idle' }
              
              return (
                <div key={phone.sid} className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{phone.phoneNumber}</h3>
                        <p className="text-sm text-gray-500">{phone.friendlyName}</p>
                      </div>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(callStatus.status)}`}></div>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Status:</span>
                      <span className={`text-sm font-semibold ${
                        callStatus.status === 'in-progress' ? 'text-green-600' :
                        callStatus.status === 'ringing' ? 'text-yellow-600' :
                        callStatus.status === 'failed' ? 'text-red-600' :
                        'text-gray-600'
                      }`}>
                        {getStatusText(callStatus.status)}
                      </span>
                    </div>
                    
                    {callStatus.from && (
                      <div className="text-xs text-gray-500 mb-1">
                        From: {callStatus.from}
                      </div>
                    )}
                    
                    {callStatus.to && (
                      <div className="text-xs text-gray-500 mb-1">
                        To: {callStatus.to}
                      </div>
                    )}
                    
                    {callStatus.duration && (
                      <div className="text-xs text-gray-500 mb-1">
                        Duration: {callStatus.duration}s
                      </div>
                    )}
                    
                    {callStatus.timestamp && (
                      <div className="text-xs text-gray-500">
                        Last Update: {new Date(callStatus.timestamp).toLocaleTimeString()}
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Capabilities:</h4>
                    <div className="flex space-x-2">
                      {phone.capabilities.voice && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Voice
                        </span>
                      )}
                      {phone.capabilities.sms && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          SMS
                        </span>
                      )}
                      {phone.capabilities.mms && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          MMS
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Empty State */}
          {phoneNumbers.length === 0 && !twilioError && (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No phone numbers found</h3>
              <p className="mt-1 text-sm text-gray-500">
                Configure your Twilio credentials to see your phone numbers here.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
} 