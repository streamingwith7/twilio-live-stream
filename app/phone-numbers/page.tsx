'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { io, Socket } from 'socket.io-client'
import { PhoneNumber, CallStatus, User } from '@/types'
import Navigation from '@/components/Navigation'
import PhoneCard from '@/components/PhoneCard'
import LoadingSpinner from '@/components/LoadingSpinner'

export default function PhoneNumbersPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([])
  const [callStatuses, setCallStatuses] = useState<Record<string, CallStatus>>({})
  const [socket, setSocket] = useState<Socket | null>(null)
  const [twilioError, setTwilioError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null)
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
      },
      transports: ['polling', 'websocket'],
      upgrade: true,
      timeout: 20000,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
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

  const handleConnectionToggle = async (phone: PhoneNumber, action: 'connect' | 'disconnect') => {
    const token = localStorage.getItem('token')
    if (!token) return

    try {
      const response = await fetch('/api/twilio/phone-numbers', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sid: phone.sid,
          action: action
        })
      })

      const data = await response.json()

      if (response.ok) {
        // Update the phone number in the state
        setPhoneNumbers(prev => prev.map(p => 
          p.sid === phone.sid ? data.phoneNumber : p
        ))
        
        setSuccessMessage(
          action === 'connect' 
            ? `${phone.phoneNumber} has been connected to Closemydeals platform for real-time streaming`
            : `${phone.phoneNumber} has been disconnected from Closemydeals platform`
        )
        
        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(''), 5000)
      } else {
        setTwilioError(data.error || `Failed to ${action} phone number`)
        setTimeout(() => setTwilioError(''), 5000)
      }
    } catch (error) {
      setTwilioError(`Failed to ${action} phone number`)
      setTimeout(() => setTwilioError(''), 5000)
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

  const handlePhoneClick = (phoneNumber: string) => {
    setSelectedPhone(selectedPhone === phoneNumber ? null : phoneNumber)
  }

  const connectedCount = phoneNumbers.filter(phone => phone.isConnectedToPlatform).length
  const totalCount = phoneNumbers.length

  if (loading) {
    return <LoadingSpinner fullScreen />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Navigation user={user} onLogout={handleLogout} />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">Phone Numbers Management</h2>
                <p className="mt-2 text-gray-600">
                  Manage your Twilio phone numbers and configure real-time audio streaming
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">{connectedCount}/{totalCount}</div>
                  <div className="text-sm text-gray-500">Connected</div>
                </div>
                <button
                  onClick={() => fetchPhoneNumbers(localStorage.getItem('token') || '')}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Connection Status */}
          <div className="mb-6">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${socket?.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm text-gray-600">
                {socket?.connected ? 'Real-time updates active' : 'Connecting to real-time updates...'}
              </span>
            </div>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {successMessage}
            </div>
          )}

          {/* Error Message */}
          {twilioError && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {twilioError}
            </div>
          )}

          {/* Connected vs Disconnected Overview */}
          {phoneNumbers.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Connected Numbers</h3>
                    <p className="text-sm text-gray-500">Real-time streaming enabled</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-2xl font-bold text-green-600">{connectedCount}</span>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Available to Connect</h3>
                    <p className="text-sm text-gray-500">Not configured for streaming</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                    <span className="text-2xl font-bold text-gray-600">{totalCount - connectedCount}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Phone Numbers Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {phoneNumbers.map((phone) => {
              const callStatus = callStatuses[phone.phoneNumber] || {
                phoneNumber: phone.phoneNumber,
                status: 'idle' as const
              }

              return (
                <PhoneCard
                  key={phone.sid}
                  phone={phone}
                  callStatus={callStatus}
                  onClick={handlePhoneClick}
                  isSelected={selectedPhone === phone.phoneNumber}
                  onConnectionToggle={handleConnectionToggle}
                />
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

          {/* Help Section */}
          <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">How it works</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-blue-800 mb-2">Connect with Closemydeals</h4>
                <p className="text-sm text-blue-700">
                  When you connect a phone number, it configures Twilio to send all incoming and outgoing calls 
                  to our platform with real-time audio streaming enabled.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-blue-800 mb-2">Real-time Features</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Live audio streaming to platform users</li>
                  <li>• Real-time call transcription</li>
                  <li>• Call monitoring and analytics</li>
                  <li>• Automatic call logging</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 