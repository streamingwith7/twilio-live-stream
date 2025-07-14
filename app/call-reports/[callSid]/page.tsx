'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { User } from '@/types'
import Navigation from '@/components/Navigation'
import LoadingSpinner from '@/components/LoadingSpinner'

interface Turn {
  agent?: string
  customer?: string
  tip?: string
  isUsed?: boolean
  timestamp: string
  usedTimestamp?: string
}

interface FeedbackData {
  scores?: {
    rapport?: number
    dealKillers?: number
    propertyInfo?: number
    nextStepsClose?: number
    decisionProcess?: number
    solutionFraming?: number
    advanceAgreement?: number
    motivationDiscovery?: number
  }
  callType?: string
  totalScore?: number
  callSummary?: {
    repName?: string
    offerType?: string
    offerAmount?: string
    closeTimeline?: string
    wasOfferDiscussed?: boolean
    creativeFinancingDetails?: {
      piti?: string
      mortgageBalance?: string
      behindOnPayments?: string
    }
  }
  whatWentWell?: string
  timestampQuote?: string
  outcomeNextStep?: string
  quickEvaluation?: {
    rapport?: string
    dealKillers?: string
    propertyInfo?: string
    closeNextStep?: string
    decisionProcess?: string
    solutionFraming?: string
    advanceAgreement?: string
    motivationDiscovery?: string
  }
  scriptReference?: string
  improvementArea1?: string
  improvementArea2?: string
}

interface CallReport {
  id: string
  callSid: string
  fromNumber?: string
  toNumber?: string
  recordingUrl?: string
  duration?: number
  reportData?: {
    turns: Turn[]
  }
  feedback?: FeedbackData
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
  const [activeTab, setActiveTab] = useState<'conversation' | 'feedback'>('conversation')
  const conversationRef = useRef<HTMLDivElement>(null)
  const turnRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

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
      second: '2-digit',
      hour12: true
    })
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  const scrollToUsedTimestamp = (usedTimestamp: string) => {
    if (!report?.reportData?.turns) return

    // Find the turn that matches the usedTimestamp
    const targetTurnIndex = report.reportData.turns.findIndex(turn => 
      turn.timestamp === usedTimestamp && (turn.agent || turn.customer)
    )

    if (targetTurnIndex !== -1) {
      const targetElement = turnRefs.current[`turn-${targetTurnIndex}`]
      if (targetElement && conversationRef.current) {
        // Scroll the conversation container to the target element
        const containerRect = conversationRef.current.getBoundingClientRect()
        const elementRect = targetElement.getBoundingClientRect()
        const scrollTop = conversationRef.current.scrollTop + elementRect.top - containerRect.top - 100 // 100px offset for better visibility

        conversationRef.current.scrollTo({
          top: scrollTop,
          behavior: 'smooth'
        })

        // Add a temporary highlight effect
        targetElement.classList.add('ring-2', 'ring-blue-400', 'ring-opacity-75')
        setTimeout(() => {
          targetElement.classList.remove('ring-2', 'ring-blue-400', 'ring-opacity-75')
        }, 2000)
      }
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

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600 bg-green-100'
    if (score >= 6) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  const getEvaluationColor = (evaluation: string) => {
    if (evaluation.includes('OK') || evaluation.includes('Partial')) return 'text-yellow-600 bg-yellow-100'
    if (evaluation.includes('Missed') || evaluation.includes('No') || evaluation.includes('Unclear') || evaluation.includes('Vague') || evaluation.includes('Rushed')) return 'text-red-600 bg-red-100'
    return 'text-green-600 bg-green-100'
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/')
  }

  const renderConversationTab = () => (
    <div ref={conversationRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50">
      {report?.reportData?.turns?.length && report.reportData.turns.length > 0 ? (
        report.reportData.turns.map((turn, index) => {
          console.log('Processing turn:', turn)

          if (turn.customer && !turn.agent && !turn.tip) {
            return (
              <div 
                key={`customer-${index}`} 
                ref={el => { turnRefs.current[`turn-${index}`] = el }}
                className="flex justify-start transition-all duration-200 rounded-lg"
              >
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

          if (turn.agent && !turn.tip) {
            return (
              <div 
                key={`agent-${index}`} 
                ref={el => { turnRefs.current[`turn-${index}`] = el }}
                className="flex justify-end transition-all duration-200 rounded-lg"
              >
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
            )
          }

          if (turn.tip) {
            return (
              <div key={`tip-${index}`} className="flex justify-end">
                <div className="flex items-end space-x-3 max-w-md flex-row-reverse space-x-reverse">
                  {getAvatar('tip')}
                  <div 
                    className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-2xl px-4 py-3 shadow-lg cursor-pointer hover:from-green-600 hover:to-green-700 transition-all duration-200"
                    onClick={() => turn.usedTimestamp && scrollToUsedTimestamp(turn.usedTimestamp)}
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-xs font-medium text-green-100">AI Coach</span>
                      <span className="text-xs text-green-200">
                        {formatTimestamp(turn.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-white">{turn.tip}</p>
                    
                    {/* Show used timestamp if available */}
                    {turn.usedTimestamp && (
                      <div className="mt-2 pt-2 border-t border-green-400 border-opacity-30">
                        <p className="text-xs text-green-200">
                          Applied at: {formatTimestamp(turn.usedTimestamp)}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-center mt-3">
                      {turn.isUsed ? (
                        <span className="text-xs text-green-200 flex items-center space-x-2 bg-green-900 bg-opacity-30 px-2 py-1 rounded-full">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span>Used</span>
                          {turn.usedTimestamp && (
                            <span className="text-green-300">• Click to view</span>
                          )}
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
  )

  const renderFeedbackTab = () => {
    const feedback = report?.feedback

    if (!feedback) {
      return (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No feedback available</h3>
            <p className="text-gray-500">This call report doesn't contain any feedback data.</p>
          </div>
        </div>
      )
    }

    return (
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {feedback.totalScore !== undefined && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Overall Performance</h3>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(feedback.totalScore)}`}>
                {feedback.totalScore}/100
              </div>
            </div>

            {feedback.callType && (
              <p className="text-sm text-gray-600 mb-4">
                <span className="font-medium">Call Type:</span> {feedback.callType}
              </p>
            )}

            {feedback.scores && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(feedback.scores).map(([key, score]) => (
                  <div key={key} className="text-center">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 ${getScoreColor(score)}`}>
                      <span className="text-lg font-bold">{score}</span>
                    </div>
                    <p className="text-xs text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* What Went Well */}
        {feedback.whatWentWell && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">What Went Well</h3>
            </div>
            <p className="text-gray-700 leading-relaxed">{feedback.whatWentWell}</p>
          </div>
        )}

        {(feedback.improvementArea1 || feedback.improvementArea2) && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Areas for Improvement</h3>
            </div>
            <div className="space-y-4">
              {feedback.improvementArea1 && (
                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <h4 className="font-medium text-yellow-800 mb-2">Improvement Area 1</h4>
                  <p className="text-yellow-700 text-sm">{feedback.improvementArea1}</p>
                </div>
              )}
              {feedback.improvementArea2 && (
                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <h4 className="font-medium text-yellow-800 mb-2">Improvement Area 2</h4>
                  <p className="text-yellow-700 text-sm">{feedback.improvementArea2}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick Evaluation */}
        {feedback.quickEvaluation && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Quick Evaluation</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(feedback.quickEvaluation).map(([key, evaluation]) => (
                <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}:
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${getEvaluationColor(evaluation)}`}>
                    {evaluation.split(' - ')[0]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Call Summary */}
        {feedback.callSummary && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Call Summary</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {feedback.callSummary.repName && (
                <div>
                  <span className="text-sm font-medium text-gray-600">Rep Name:</span>
                  <p className="text-gray-900">{feedback.callSummary.repName}</p>
                </div>
              )}
              {feedback.callSummary.offerType && (
                <div>
                  <span className="text-sm font-medium text-gray-600">Offer Type:</span>
                  <p className="text-gray-900">{feedback.callSummary.offerType}</p>
                </div>
              )}
              {feedback.callSummary.offerAmount && (
                <div>
                  <span className="text-sm font-medium text-gray-600">Offer Amount:</span>
                  <p className="text-gray-900">{feedback.callSummary.offerAmount}</p>
                </div>
              )}
              {feedback.callSummary.closeTimeline && (
                <div>
                  <span className="text-sm font-medium text-gray-600">Close Timeline:</span>
                  <p className="text-gray-900">{feedback.callSummary.closeTimeline}</p>
                </div>
              )}
              {feedback.callSummary.wasOfferDiscussed !== undefined && (
                <div>
                  <span className="text-sm font-medium text-gray-600">Offer Discussed:</span>
                  <p className="text-gray-900">{feedback.callSummary.wasOfferDiscussed ? 'Yes' : 'No'}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Script Reference */}
        {feedback.scriptReference && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Script Reference</h3>
            </div>
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <p className="text-indigo-800 font-medium">{feedback.scriptReference}</p>
            </div>
          </div>
        )}

        {/* Outcome & Next Steps */}
        {feedback.outcomeNextStep && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Outcome & Next Steps</h3>
            </div>
            <p className="text-gray-700 leading-relaxed">{feedback.outcomeNextStep}</p>
          </div>
        )}

        {/* Timestamp Quote */}
        {feedback.timestampQuote && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Key Quote</h3>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-orange-800 italic">"{feedback.timestampQuote}"</p>
            </div>
          </div>
        )}
      </div>
    )
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

                {/* Call Details */}
                {(report.fromNumber || report.toNumber || report.duration) && (
                  <div className="mt-3 space-y-1">
                    {report.fromNumber && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">From:</span> {report.fromNumber}
                      </p>
                    )}
                    {report.toNumber && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">To:</span> {report.toNumber}
                      </p>
                    )}
                    {report.duration && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Duration:</span> {formatDuration(report.duration)}
                      </p>
                    )}
                    {report.recordingUrl && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Recording:</span>{' '}
                        <a
                          href={report.recordingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline"
                        >
                          Listen to Recording
                        </a>
                      </p>
                    )}
                  </div>
                )}

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
            {/* Tab Navigation */}
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab('conversation')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'conversation'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span>Conversation</span>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('feedback')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'feedback'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Feedback</span>
                    {report.feedback && (
                      <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">
                        Available
                      </span>
                    )}
                  </div>
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            {activeTab === 'conversation' ? renderConversationTab() : renderFeedbackTab()}
          </div>
        </div>
      </main>
    </div>
  )
}