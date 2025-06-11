'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { io, Socket } from 'socket.io-client'
import { CallLog, CallLogsResponse, CallStatus, User } from '@/types'
import Navigation from '@/components/Navigation'
import LoadingSpinner from '@/components/LoadingSpinner'

export default function CallLogsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [callLogs, setCallLogs] = useState<CallLogsResponse | null>(null)
  const [loadingCallLogs, setLoadingCallLogs] = useState(false)
  const [callLogsError, setCallLogsError] = useState('')
  const [socket, setSocket] = useState<Socket | null>(null)
  const [realtimeCallStatus, setRealtimeCallStatus] = useState<CallStatus | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const phoneNumber = searchParams.get('phone')

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')

    if (!token || !userData) {
      router.push('/')
      return
    }

    if (!phoneNumber) {
      router.push('/dashboard')
      return
    }

    setUser(JSON.parse(userData))
    setLoading(false)

    // Setup WebSocket connection
    const newSocket = io({
      auth: {
        token: token
      }
    })

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket server')
    })

    newSocket.on('callStatusUpdate', (data: CallStatus) => {
      if (data.phoneNumber === phoneNumber) {
        setRealtimeCallStatus(data)
      }
    })

    setSocket(newSocket)
    fetchCallLogs(token, phoneNumber)

    // Refresh call logs every 30 seconds
    const interval = setInterval(() => {
      fetchCallLogs(token, phoneNumber)
    }, 30000)

    return () => {
      newSocket.disconnect()
      clearInterval(interval)
    }
  }, [router, phoneNumber])

  const fetchCallLogs = async (token: string, phone: string) => {
    setLoadingCallLogs(true)
    setCallLogsError('')

    try {
      const response = await fetch(`/api/twilio/call-logs?phone-number=${encodeURIComponent(phone)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (response.ok) {
        setCallLogs(data)
      } else {
        setCallLogsError(data.error || 'Failed to fetch call logs')
      }
    } catch (error) {
      setCallLogsError('Failed to fetch call logs')
    } finally {
      setLoadingCallLogs(false)
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

  const handleRefresh = () => {
    if (phoneNumber) {
      const token = localStorage.getItem('token')
      if (token) {
        fetchCallLogs(token, phoneNumber)
      }
    }
  }

  const formatDuration = (duration: string) => {
    const seconds = parseInt(duration)
    if (seconds === 0) return 'Just started'
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`
  }

  const formatDirection = (direction: string) => {
    switch (direction) {
      case 'outbound-dial': return 'Outbound'
      case 'inbound': return 'Inbound'
      default: return direction
    }
  }

  const getStatusBadge = (status: string) => {
    const baseClasses = "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"

    switch (status.toLowerCase()) {
      case 'in-progress':
        return `${baseClasses} bg-green-100 text-green-800`
      case 'ringing':
        return `${baseClasses} bg-yellow-100 text-yellow-800`
      case 'completed':
        return `${baseClasses} bg-blue-100 text-blue-800`
      case 'busy':
        return `${baseClasses} bg-orange-100 text-orange-800`
      case 'failed':
        return `${baseClasses} bg-red-100 text-red-800`
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`
    }
  }

  const CallLogCard = ({ call, type }: { call: CallLog; type: 'in-progress' | 'ringing' }) => (
    <div className={`bg-white rounded-lg p-4 border-l-4 shadow-sm ${type === 'in-progress' ? 'border-l-green-500' : 'border-l-yellow-500'
      }`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <span className="font-semibold text-gray-900">{call.from}</span>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            <span className="font-semibold text-gray-900">{call.to}</span>
          </div>
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <span>{formatDirection(call.direction)}</span>
            <span>{formatDuration(call.duration)}</span>
            <span className={getStatusBadge(call.status)}>{call.status}</span>
          </div>
        </div>
        <div className="text-right text-xs text-gray-500">
          <div>{new Date(call.dateCreated).toLocaleDateString()}</div>
          <div>{new Date(call.dateCreated).toLocaleTimeString()}</div>
        </div>
      </div>
      <div className="text-xs text-gray-400 font-mono">
        Call ID: {call.sid}
      </div>
    </div>
  )

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
                  onClick={() => router.push('/dashboard')}
                  className="flex items-center text-blue-600 hover:text-blue-800 mb-4"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to Dashboard
                </button>
                <h2 className="text-3xl font-bold text-gray-900">Call Logs</h2>
                <p className="mt-2 text-gray-600">Active calls for {phoneNumber}</p>
              </div>
              <button
                onClick={handleRefresh}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                disabled={loadingCallLogs}
              >
                <svg className={`w-5 h-5 mr-2 ${loadingCallLogs ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
          </div>

          {/* Connection Status */}
          <div className="mb-6">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${socket?.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm text-gray-600">
                  {socket?.connected ? 'Real-time updates active' : 'Connecting to real-time updates...'}
                </span>
              </div>
              {realtimeCallStatus && (
                <div className="flex items-center space-x-2 text-sm">
                  <span className="text-gray-600">Latest status:</span>
                  <span className={getStatusBadge(realtimeCallStatus.status)}>
                    {realtimeCallStatus.status}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Error State */}
          {callLogsError && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
              {callLogsError}
            </div>
          )}

          {/* Loading State */}
          {loadingCallLogs && (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
              <span className="ml-3 text-gray-600">Loading call logs...</span>
            </div>
          )}

          {/* Call Logs Content */}
          {callLogs && !loadingCallLogs && (
            <div className="space-y-8">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-gray-900">{callLogs.counts.inProgress}</h3>
                      <p className="text-sm text-gray-600">In Progress</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-gray-900">{callLogs.counts.ringing}</h3>
                      <p className="text-sm text-gray-600">Ringing</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-gray-900">{callLogs.counts.total}</h3>
                      <p className="text-sm text-gray-600">Total Active</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* In Progress Calls */}
              {callLogs.activeCalls.inProgress.length > 0 && (
                <div>
                  <div className="flex items-center mb-6">
                    <div className="w-3 h-3 bg-green-500 rounded-full mr-3 animate-pulse"></div>
                    <h3 className="text-2xl font-bold text-gray-900">In Progress Calls</h3>
                    <span className="ml-2 bg-green-100 text-green-800 text-sm font-medium px-2 py-1 rounded-full">
                      {callLogs.activeCalls.inProgress.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {callLogs.activeCalls.inProgress.map((call) => (
                      <CallLogCard key={call.sid} call={call} type="in-progress" />
                    ))}
                  </div>
                </div>
              )}

              {/* Ringing Calls */}
              {callLogs.activeCalls.ringing.length > 0 && (
                <div>
                  <div className="flex items-center mb-6">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full mr-3 animate-pulse"></div>
                    <h3 className="text-2xl font-bold text-gray-900">Ringing Calls</h3>
                    <span className="ml-2 bg-yellow-100 text-yellow-800 text-sm font-medium px-2 py-1 rounded-full">
                      {callLogs.activeCalls.ringing.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {callLogs.activeCalls.ringing.map((call) => (
                      <CallLogCard key={call.sid} call={call} type="ringing" />
                    ))}
                  </div>
                </div>
              )}

              {/* All Active Calls Table */}
              {callLogs.activeCalls.all.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-bold text-gray-900">All Active Calls</h3>
                    <span className="bg-gray-100 text-gray-800 text-sm font-medium px-2 py-1 rounded-full">
                      {callLogs.activeCalls.all.length} total
                    </span>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Call Details
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Direction
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Duration
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Started
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Call ID
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {callLogs.activeCalls.all.map((call) => (
                            <tr key={call.sid} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">
                                      {call.from} → {call.to}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm text-gray-900">{formatDirection(call.direction)}</span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={getStatusBadge(call.status)}>
                                  {call.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatDuration(call.duration)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <div>{new Date(call.dateCreated).toLocaleDateString()}</div>
                                <div>{new Date(call.dateCreated).toLocaleTimeString()}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400 font-mono">
                                {call.sid}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* No Active Calls */}
              {callLogs.counts.total === 0 && (
                <div className="text-center py-16">
                  <div className="max-w-md mx-auto">
                    <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <h3 className="text-xl font-medium text-gray-900 mb-2">No Active Calls</h3>
                    <p className="text-gray-500">
                      There are currently no active calls for {phoneNumber}.
                      Active calls will appear here in real-time.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}