'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { io, Socket } from 'socket.io-client'
import { PhoneNumber, CallStatus, User } from '@/types'
import Navigation from '@/components/Navigation'
import PhoneCard from '@/components/PhoneCard'
import LoadingSpinner from '@/components/LoadingSpinner'

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
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

  const handleLogout = () => {
    if (socket) {
      socket.disconnect()
    }
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/')
  }

  const handlePhoneClick = (phoneNumber: string) => {
    router.push(`/call-logs?phone=${encodeURIComponent(phoneNumber)}`)
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
      } else {
        setTwilioError(data.error || `Failed to ${action} phone number`)
        setTimeout(() => setTwilioError(''), 5000)
      }
    } catch (error) {
      setTwilioError(`Failed to ${action} phone number`)
      setTimeout(() => setTwilioError(''), 5000)
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
            <h2 className="text-3xl font-bold text-gray-900">Phone Numbers & Call Status</h2>
            <p className="mt-2 text-gray-600">Monitor your Twilio phone numbers and real-time call activity</p>
            <div className="mt-4 flex space-x-4">
              <button
                onClick={() => router.push('/phone-numbers')}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Manage Phone Numbers
              </button>
              <button
                onClick={() => router.push('/call-reports')}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                View Call Reports
              </button>
            </div>
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
        </div>
      </main>
    </div>
  )
}