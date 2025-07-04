'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { User } from '@/types'
import Navigation from '@/components/Navigation'
import LoadingSpinner from '@/components/LoadingSpinner'

interface Turn {
  agent?: string
  customer?: string
  tip?: {
    isUsed: boolean
    content: string
    timestamp: string
  }
  timestamp: string
}

interface CallReport {
  id: string
  callSid: string
  reportData: {
    turns: Turn[]
  }
  totalTurns: number
  totalTips: number
  usedTips: number
  createdAt: string
  updatedAt: string
}

export default function CallReportDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [report, setReport] = useState<CallReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const callSid = params.callSid as string

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')

    if (!token || !userData) {
      router.push('/')
      return
    }

    setUser(JSON.parse(userData))
    
    if (callSid) {
      fetchReport()
    }
  }, [callSid, router])

  const fetchReport = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/call-reports?callSid=${callSid}`)
      const data = await response.json()
      
      if (response.ok) {
        console.log('Report data received:', data)
        setReport(data)
      } else {
        setError(data.error || 'Failed to fetch report')
      }
    } catch (error) {
      console.error('Error fetching report:', error)
      setError('Failed to fetch report')
    } finally {
      setLoading(false)
    }
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    })
  }

  const getMessageType = (turn: Turn) => {
    if (turn.agent) return 'agent'
    if (turn.customer) return 'customer'
    if (turn.tip) return 'tip'
    return 'unknown'
  }

  const getMessageContent = (turn: Turn) => {
    if (turn.agent) return turn.agent
    if (turn.customer) return turn.customer
    if (turn.tip) return turn.tip.content
    return ''
  }

  const getMessageStyle = (type: string) => {
    switch (type) {
      case 'agent':
        return 'bg-green-500 text-white'
      case 'customer':
        return 'bg-gray-200 text-gray-900'
      case 'tip':
        return 'bg-blue-500 text-white'
      default:
        return 'bg-gray-200 text-gray-900'
    }
  }

  const getAvatar = (type: string) => {
    switch (type) {
      case 'agent':
        return (
          <div className="relative">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 rounded-full flex items-center justify-center shadow-xl border-3 border-white ring-2 ring-orange-200 transform hover:scale-105 transition-transform duration-200">
              <svg className="w-6 h-6 text-white drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-orange-500 border-2 border-white rounded-full flex items-center justify-center">
              <span className="text-xs font-bold text-white">A</span>
            </div>
          </div>
        )
      case 'customer':
        return (
          <div className="relative">
            <div className="w-12 h-12 bg-gradient-to-br from-sky-400 via-blue-500 to-sky-600 rounded-full flex items-center justify-center shadow-xl border-3 border-white ring-2 ring-blue-200 transform hover:scale-105 transition-transform duration-200">
              <svg className="w-6 h-6 text-white drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-500 border-2 border-white rounded-full flex items-center justify-center">
              <span className="text-xs font-bold text-white">C</span>
            </div>
          </div>
        )
      case 'tip':
        return (
          <div className="relative">
            <div className="w-12 h-12 bg-gradient-to-br from-green-400 via-green-500 to-green-600 rounded-full flex items-center justify-center shadow-xl border-3 border-white ring-2 ring-green-200 transform hover:scale-105 transition-transform duration-200">
              <svg className="w-6 h-6 text-white drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-white rounded-full flex items-center justify-center">
              <span className="text-xs font-bold text-white">AI</span>
            </div>
          </div>
        )
      default:
        return (
          <div className="relative">
            <div className="w-12 h-12 bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600 rounded-full flex items-center justify-center shadow-xl border-3 border-white ring-2 ring-gray-200 transform hover:scale-105 transition-transform duration-200">
              <svg className="w-6 h-6 text-white drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-gray-500 border-2 border-white rounded-full flex items-center justify-center">
              <span className="text-xs font-bold text-white">?</span>
            </div>
          </div>
        )
    }
  }

  const getSenderName = (type: string) => {
    switch (type) {
      case 'agent':
        return 'Agent'
      case 'customer':
        return 'Customer'
      case 'tip':
        return 'AI Coach'
      default:
        return 'Unknown'
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/')
  }

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading conversation..." />
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <Navigation user={user} onLogout={handleLogout} />
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <Link
                href="/call-reports"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Back to Reports
              </Link>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <Navigation user={user} onLogout={handleLogout} />
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Report Not Found</h2>
              <Link
                href="/call-reports"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Back to Reports
              </Link>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      <Navigation user={user} onLogout={handleLogout} />

      <main className="flex-1 max-w-7xl mx-auto w-full py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0 h-full flex flex-col">
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">Call Report Details</h2>
                <p className="mt-2 text-gray-600">Call SID: {report.callSid}</p>
                <p className="mt-1 text-sm text-gray-500">
                  {new Date(report.createdAt).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
              <Link
                href="/call-reports"
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Back to Reports
              </Link>
            </div>
          </div>

          <div className="bg-white shadow overflow-hidden sm:rounded-lg flex-1 flex flex-col">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Conversation</h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">Real-time communication with AI coaching tips</p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50">
              {report.reportData?.turns?.length > 0 ? (
                report.reportData.turns.map((turn, index) => {
                  console.log('Processing turn:', turn)
                  if (turn.customer && !turn.agent && !turn.tip) {
                    return (
                      <div key={`customer-${index}`} className="flex justify-start">
                        <div className="flex items-end space-x-3 max-w-md">
                          {getAvatar('customer')}
                          <div className="bg-white text-gray-900 rounded-2xl px-4 py-3 shadow-sm border border-gray-200">
                            <p className="text-sm whitespace-pre-wrap">{turn.customer}</p>
                            <p className="text-xs mt-2 text-gray-500">
                              {formatTimestamp(turn.timestamp)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  }

                  if (turn.agent) {
                    return (
                      <div key={`agent-${index}`} className="space-y-4">
                        {turn.tip && (
                          <div className="flex justify-end">
                            <div className="flex items-end space-x-3 max-w-md flex-row-reverse space-x-reverse">
                              {getAvatar('tip')}
                              <div className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-2xl px-4 py-3 shadow-lg">
                                <div className="flex items-center space-x-2 mb-2">
                                  <span className="text-xs font-medium text-green-100">AI Coach</span>
                                  <span className="text-xs text-green-200">
                                    {formatTimestamp(turn.tip.timestamp)}
                                  </span>
                                </div>
                                <p className="text-sm text-white">{turn.tip.content}</p>
                                <div className="flex items-center justify-center mt-3">
                                  {turn.tip.isUsed ? (
                                    <span className="text-xs text-green-200 flex items-center space-x-2 bg-green-900 bg-opacity-30 px-2 py-1 rounded-full">
                                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                      </svg>
                                      <span>Used</span>
                                    </span>
                                  ) : (
                                    <span className="text-xs text-green-200 flex items-center space-x-2 bg-green-900 bg-opacity-30 px-2 py-1 rounded-full">
                                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                      </svg>
                                      <span>Not Used</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Agent Message */}
                        <div className="flex justify-end">
                          <div className="flex items-end space-x-3 max-w-md flex-row-reverse space-x-reverse">
                            {getAvatar('agent')}
                            <div className="bg-white text-gray-900 rounded-2xl px-4 py-3 shadow-sm border border-gray-200">
                              <p className="text-sm whitespace-pre-wrap">{turn.agent}</p>
                              <p className="text-xs mt-2 text-gray-500">
                                {formatTimestamp(turn.timestamp)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  }

                  // Handle any other cases
                  return null
                })
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No conversation data</h3>
                  <p className="text-gray-500">This call report doesn't contain any conversation data.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 