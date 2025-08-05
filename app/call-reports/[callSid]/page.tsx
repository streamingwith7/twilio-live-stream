'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { User } from '@/types'
import Navigation from '@/components/Navigation'
import LoadingSpinner from '@/components/LoadingSpinner'

interface ConversationTurn {
  text: string
  intent: string
  speaker: "agent" | "customer"
  sentiment: string
  timestamp: string
  confidence: number
}

interface TipHistoryItem {
  id: string
  tip: string
  isUsed: boolean
  callSid: string
  urgency: string
  reasoning: string
  timestamp: string
  matchingTurns: string[]
  usageReasoning: string
  suggestedScript: string
  usageConfidence: number
  conversationStage: string
  comments?: TipComment[]
}

interface TipComment {
  id: string
  text: string
  timestamp: string
  author: string
}

interface UserSuggestion {
  id: string
  suggestion: string
  reasoning: string
  timestamp: string
  author: string
  conversationTurnIndex: number
  comments?: TipComment[]
}

interface NewReportData {
  turns: ConversationTurn[]
  tipHistory: TipHistoryItem[]
  userSuggestions?: UserSuggestion[]
}

interface MergedItem {
  type: 'conversation' | 'tip' | 'userSuggestion'
  timestamp: string
  data: ConversationTurn | TipHistoryItem | UserSuggestion
}

interface SentimentMoment {
  timestamp: string
  sentiment: "positive" | "neutral" | "negative"
  context: string
}

interface StageProgression {
  attempted: boolean
  score: number
  maxScore: number
  percentage: number
  notes: string
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
  sentimentAnalysis?: {
    overall: "positive" | "neutral" | "negative"
    timeline: string
    keyMoments: SentimentMoment[]
  }
  stageProgression?: {
    setTheStage: StageProgression
    "Walkthrough-Building-Rapport": StageProgression
    "DiscoverPersonalMotivation(s)": StageProgression
    dealKillers: StageProgression
    Transition: StageProgression
    "Solution-Offer": StageProgression
  }
  strengths?: string[]
  areasForImprovement?: string[]
  coachingAdvice?: string[]
  callSummary?: {
    repName?: string
    sellerName?: string
    propertyAddress?: string
    offerType?: string
    offerAmount?: string
    closeTimeline?: string
    wasOfferDiscussed?: boolean
    keyPainPoints?: string[]
    decisionMakers?: string
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
  reportData?: NewReportData
  feedback?: FeedbackData
  totalTurns: number
  totalTips: number
  usedTips: number
  createdAt: string
  updatedAt: string
  isTrained?: boolean
}

export default function CallReportDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [report, setReport] = useState<CallReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'conversation' | 'feedback' | 'stages'>('conversation')
  const [commentText, setCommentText] = useState('')
  const [isAddingComment, setIsAddingComment] = useState(false)
  const [activeCommentTip, setActiveCommentTip] = useState<string | null>(null)
  const [isAddingSuggestion, setIsAddingSuggestion] = useState(false)
  const [activeAddSuggestionTurn, setActiveAddSuggestionTurn] = useState<number | null>(null)
  const [suggestionText, setSuggestionText] = useState('')
  const [suggestionReasoning, setSuggestionReasoning] = useState('')
  const [isTraining, setIsTraining] = useState(false)
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

  const mergeConversationAndTips = (): MergedItem[] => {
    if (!report?.reportData) return []

    const { turns, tipHistory, userSuggestions } = report.reportData
    const merged: MergedItem[] = []

    turns.forEach(turn => {
      merged.push({
        type: 'conversation',
        timestamp: turn.timestamp,
        data: turn
      })
    })

    tipHistory.forEach(tip => {
      merged.push({
        type: 'tip',
        timestamp: tip.timestamp,
        data: tip
      })
    })

    if (userSuggestions) {
      userSuggestions.forEach(suggestion => {
        merged.push({
          type: 'userSuggestion',
          timestamp: suggestion.timestamp,
          data: suggestion
        })
      })
    }

    merged.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    return merged
  }

  const scrollToMatchingTurn = (matchingTurns: string[]) => {
    if (!report?.reportData?.turns || matchingTurns.length === 0) return

    const mergedItems = mergeConversationAndTips()
    let conversationTurnCounter = 0
    let targetRefKey: string | null = null

    for (let i = 0; i < mergedItems.length; i++) {
      const item = mergedItems[i]
      if (item.type === 'conversation') {
        const turn = item.data as ConversationTurn
        const currentTurnIndex = conversationTurnCounter
        conversationTurnCounter++

        if (matchingTurns.some(matchingText =>
          turn.text.trim().toLowerCase().includes(matchingText.trim().toLowerCase()) ||
          matchingText.trim().toLowerCase().includes(turn.text.trim().toLowerCase())
        )) {
          targetRefKey = `turn-${currentTurnIndex}`
          break
        }
      }
    }

    if (targetRefKey) {
      const targetElement = turnRefs.current[targetRefKey]
      if (targetElement && conversationRef.current) {
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        })

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
      case 'userSuggestion':
        return (
          <div className="relative">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-400 via-purple-500 to-purple-600 rounded-full flex items-center justify-center shadow-xl border-3 border-white ring-2 ring-purple-200 transform hover:scale-105 transition-transform duration-200">
              <svg className="w-6 h-6 text-white drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 3v1m0 0l1.5 1.5M12 4L10.5 5.5M21 12h-1M4 12H3m15.364-6.364l-.707.707M6.343 6.343l-.707.707m12.728 0l-.707-.707M6.343 17.657l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-purple-500 border-2 border-white rounded-full flex items-center justify-center">
              <span className="text-xs font-bold text-white">U</span>
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

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600 bg-green-100'
    if (percentage >= 60) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'text-green-600 bg-green-100'
      case 'negative': return 'text-red-600 bg-red-100'
      default: return 'text-yellow-600 bg-yellow-100'
    }
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

  const handleAddComment = async (tipId: string) => {
    if (!commentText.trim()) return

    setIsAddingComment(true)
    try {
      const response = await fetch('/api/call-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          callSid,
          tipId,
          comment: commentText.trim(),
        }),
      })

      if (response.ok) {
        const result = await response.json()

        // Update the report state with the new comment
        setReport(prev => {
          if (!prev || !prev.reportData) return prev

          const updatedReportData = { ...prev.reportData } as NewReportData

          // Try to find in tips first
          if (updatedReportData.tipHistory) {
            const tipIndex = updatedReportData.tipHistory.findIndex(tip => tip.id === tipId)
            if (tipIndex !== -1) {
              if (!updatedReportData.tipHistory[tipIndex].comments) {
                updatedReportData.tipHistory[tipIndex].comments = []
              }
              updatedReportData.tipHistory[tipIndex].comments!.push(result.comment)

              return {
                ...prev,
                reportData: updatedReportData
              }
            }
          }

          // If not found in tips, try user suggestions
          if (updatedReportData.userSuggestions) {
            const suggestionIndex = updatedReportData.userSuggestions.findIndex(suggestion => suggestion.id === tipId)
            if (suggestionIndex !== -1) {
              if (!updatedReportData.userSuggestions[suggestionIndex].comments) {
                updatedReportData.userSuggestions[suggestionIndex].comments = []
              }
              updatedReportData.userSuggestions[suggestionIndex].comments!.push(result.comment)
            }
          }

          return {
            ...prev,
            reportData: updatedReportData
          }
        })

        setCommentText('')
        setActiveCommentTip(null)
      } else {
        console.error('Failed to add comment')
      }
    } catch (error) {
      console.error('Error adding comment:', error)
    } finally {
      setIsAddingComment(false)
    }
  }

  const startAddingComment = (tipId: string) => {
    setActiveCommentTip(tipId)
    setCommentText('')
  }

  const cancelAddingComment = () => {
    setActiveCommentTip(null)
    setCommentText('')
  }

  const handleAddUserSuggestion = async (conversationTurnIndex: number) => {
    if (!suggestionText.trim() || !suggestionReasoning.trim()) return

    setIsAddingSuggestion(true)
    try {
      const response = await fetch('/api/call-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          callSid,
          userSuggestion: {
            suggestion: suggestionText.trim(),
            reasoning: suggestionReasoning.trim(),
            conversationTurnIndex,
          },
        }),
      })

      if (response.ok) {
        const result = await response.json()

        // Update the report state with the new user suggestion
        setReport(prev => {
          if (!prev || !prev.reportData) return prev

          const updatedReportData = { ...prev.reportData } as NewReportData
          if (!updatedReportData.userSuggestions) {
            updatedReportData.userSuggestions = []
          }
          updatedReportData.userSuggestions.push(result.userSuggestion)

          return {
            ...prev,
            reportData: updatedReportData
          }
        })

        setSuggestionText('')
        setSuggestionReasoning('')
        setActiveAddSuggestionTurn(null)
      } else {
        console.error('Failed to add user suggestion')
      }
    } catch (error) {
      console.error('Error adding user suggestion:', error)
    } finally {
      setIsAddingSuggestion(false)
    }
  }

  const startAddingSuggestion = (conversationTurnIndex: number) => {
    setActiveAddSuggestionTurn(conversationTurnIndex)
    setSuggestionText('')
    setSuggestionReasoning('')
  }

  const cancelAddingSuggestion = () => {
    setActiveAddSuggestionTurn(null)
    setSuggestionText('')
    setSuggestionReasoning('')
  }

  const handleTrainAgent = async () => {
    if (!report?.reportData) return

    setIsTraining(true)
    try {
      // Prepare training content from report data
      const trainingContent = JSON.stringify({
        callSid: report.callSid,
        reportData: report.reportData,
        feedback: report.feedback,
        fromNumber: report.fromNumber,
        toNumber: report.toNumber,
        duration: report.duration,
        createdAt: report.createdAt
      }, null, 2)

      // Upload to Pinecone for training
      const response = await fetch('/api/assistant/resource', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: trainingContent
        }),
      })

      if (response.ok) {
        // Update the call report to mark as trained
        const updateResponse = await fetch('/api/call-reports', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            callSid: report.callSid,
            isTrained: true
          }),
        })

        if (updateResponse.ok) {
          setReport(prev => prev ? { ...prev, isTrained: true } : prev)
          console.log('Agent successfully trained with call data')
        }
      } else {
        console.error('Failed to train agent')
      }
    } catch (error) {
      console.error('Error training agent:', error)
    } finally {
      setIsTraining(false)
    }
  }

  const renderConversationTab = () => {
    const mergedItems = mergeConversationAndTips()
    let conversationTurnCounter = 0

    return (
      <div ref={conversationRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50">
        {mergedItems.length > 0 ? (
          mergedItems.map((item, index) => {
            if (item.type === 'conversation') {
              const turn = item.data as ConversationTurn
              const currentTurnIndex = conversationTurnCounter
              conversationTurnCounter++

              if (turn.speaker === 'customer') {
                return (
                  <div key={`customer-${index}`}>
                    <div
                      ref={el => { turnRefs.current[`turn-${currentTurnIndex}`] = el }}
                      className="flex justify-start transition-all duration-200 rounded-lg"
                    >
                      <div className="flex items-end space-x-3 max-w-md">
                        {getAvatar('customer')}
                        <div className="bg-white text-gray-900 rounded-2xl px-4 py-3 shadow-sm border border-gray-200">
                          <p className="text-sm whitespace-pre-wrap">{turn.text}</p>
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-xs text-gray-500">
                              {formatTimestamp(turn.timestamp)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center mt-4 mb-2">
                      <button
                        onClick={() => startAddingSuggestion(currentTurnIndex)}
                        className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 text-sm rounded-lg transition-colors flex items-center space-x-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        <span>Add Suggestion</span>
                      </button>
                    </div>

                    {activeAddSuggestionTurn === currentTurnIndex && (
                      <div className="max-w-md mx-auto mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                        <h4 className="text-sm font-medium text-purple-900 mb-3">Add Your Suggestion</h4>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-purple-700 mb-1">
                              Suggestion
                            </label>
                            <textarea
                              value={suggestionText}
                              onChange={(e) => setSuggestionText(e.target.value)}
                              placeholder="What should have been suggested here?"
                              className="w-full p-2 text-sm border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                              rows={3}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-purple-700 mb-1">
                              Reasoning
                            </label>
                            <textarea
                              value={suggestionReasoning}
                              onChange={(e) => setSuggestionReasoning(e.target.value)}
                              placeholder="Why should this have been suggested?"
                              className="w-full p-2 text-sm border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                              rows={2}
                            />
                          </div>
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={cancelAddingSuggestion}
                              className="px-3 py-2 text-sm text-purple-600 hover:text-purple-800"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleAddUserSuggestion(currentTurnIndex)}
                              disabled={!suggestionText.trim() || !suggestionReasoning.trim() || isAddingSuggestion}
                              className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50"
                            >
                              {isAddingSuggestion ? 'Adding...' : 'Add Suggestion'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              } else if (turn.speaker === 'agent') {
                return (
                  <div key={`agent-${index}`}>
                    <div
                      ref={el => { turnRefs.current[`turn-${currentTurnIndex}`] = el }}
                      className="flex justify-end transition-all duration-200 rounded-lg"
                    >
                      <div className="flex items-end space-x-3 max-w-md flex-row-reverse space-x-reverse">
                        {getAvatar('agent')}
                        <div className="bg-white text-gray-900 rounded-2xl px-4 py-3 shadow-sm border border-gray-200">
                          <p className="text-sm whitespace-pre-wrap">{turn.text}</p>
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-xs text-gray-500">
                              {formatTimestamp(turn.timestamp)}
                            </p>
                            {turn.sentiment && (
                              <span className={`text-xs px-2 py-1 rounded-full font-medium ${getSentimentColor(turn.sentiment)}`}>
                                {turn.sentiment}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Add Suggestion Button */}
                    <div className="flex justify-center mt-4 mb-2">
                      <button
                        onClick={() => startAddingSuggestion(currentTurnIndex)}
                        className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 text-sm rounded-lg transition-colors flex items-center space-x-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        <span>Add Suggestion</span>
                      </button>
                    </div>

                    {/* Add Suggestion Form */}
                    {activeAddSuggestionTurn === currentTurnIndex && (
                      <div className="max-w-md mx-auto mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                        <h4 className="text-sm font-medium text-purple-900 mb-3">Add Your Suggestion</h4>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-purple-700 mb-1">
                              Suggestion
                            </label>
                            <textarea
                              value={suggestionText}
                              onChange={(e) => setSuggestionText(e.target.value)}
                              placeholder="What should have been suggested here?"
                              className="w-full p-2 text-sm border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                              rows={3}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-purple-700 mb-1">
                              Reasoning
                            </label>
                            <textarea
                              value={suggestionReasoning}
                              onChange={(e) => setSuggestionReasoning(e.target.value)}
                              placeholder="Why should this have been suggested?"
                              className="w-full p-2 text-sm border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                              rows={2}
                            />
                          </div>
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={cancelAddingSuggestion}
                              className="px-3 py-2 text-sm text-purple-600 hover:text-purple-800"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleAddUserSuggestion(currentTurnIndex)}
                              disabled={!suggestionText.trim() || !suggestionReasoning.trim() || isAddingSuggestion}
                              className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50"
                            >
                              {isAddingSuggestion ? 'Adding...' : 'Add Suggestion'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              }
            } else if (item.type === 'tip') {
              const tip = item.data as TipHistoryItem
              return (
                <div key={`tip-${index}`} className="flex justify-end">
                  <div className="flex items-end space-x-3 max-w-md flex-row-reverse space-x-reverse">
                    {getAvatar('tip')}
                    <div
                      className={`bg-gradient-to-r from-green-500 to-green-600 text-white rounded-2xl px-4 py-3 shadow-lg transition-all duration-200 ${tip.isUsed ? 'cursor-pointer hover:from-green-600 hover:to-green-700' : ''
                        }`}
                      onClick={() => tip.isUsed && scrollToMatchingTurn(tip.matchingTurns)}
                    >
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-xs font-medium text-green-100">AI Coach</span>
                        <span className="text-xs text-green-200">
                          {formatTimestamp(tip.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-white">{tip.tip}</p>

                      {/* Show suggested script if available */}
                      {tip.suggestedScript && (
                        <div className="mt-2 pt-2 border-t border-green-400 border-opacity-30">
                          <p className="text-xs text-green-200 italic">
                            {tip.suggestedScript}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center justify-center mt-3">
                        {tip.isUsed ? (
                          <span className="text-xs text-green-200 flex items-center space-x-2 bg-green-900 bg-opacity-30 px-2 py-1 rounded-full">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span>Used</span>
                            {tip.matchingTurns.length > 0 && (
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

                      <div className="mt-3 pt-3 border-t border-green-400 border-opacity-30">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs text-green-200 flex items-center space-x-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            <span>Comments ({tip.comments?.length || 0})</span>
                          </div>
                          <button
                            onClick={() => startAddingComment(tip.id)}
                            className="text-xs text-green-200 hover:text-white flex items-center space-x-1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            <span className="font-bold">Add Comment</span>
                          </button>
                        </div>

                        {tip.comments && tip.comments.length > 0 && (
                          <div className="space-y-2 mb-3">
                            {tip.comments.map((comment) => (
                              <div key={comment.id} className="bg-green-900 bg-opacity-20 rounded-lg p-2">
                                <p className="text-xs text-green-100">{comment.text}</p>
                                <div className="flex items-center justify-between mt-1">
                                  <span className="text-xs text-green-300">{comment.author}</span>
                                  <span className="text-xs text-green-300">
                                    {new Date(comment.timestamp).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {activeCommentTip === tip.id && (
                          <div className="mt-2">
                            <textarea
                              value={commentText}
                              onChange={(e) => setCommentText(e.target.value)}
                              placeholder="Add a comment about this tip..."
                              className="w-full p-2 text-sm bg-green-900 bg-opacity-20 border border-green-400 border-opacity-30 rounded-lg text-green-100 placeholder-green-300 focus:outline-none focus:ring-2 focus:ring-green-300"
                              rows={3}
                            />
                            <div className="flex justify-end space-x-2 mt-2">
                              <button
                                onClick={cancelAddingComment}
                                className="px-3 py-1 text-xs text-green-200 hover:text-white"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleAddComment(tip.id)}
                                disabled={!commentText.trim() || isAddingComment}
                                className="px-3 py-1 text-xs bg-green-700 text-white rounded hover:bg-green-600 disabled:opacity-50"
                              >
                                {isAddingComment ? 'Adding...' : 'Add Comment'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            } else if (item.type === 'userSuggestion') {
              const suggestion = item.data as UserSuggestion
              return (
                <div key={`userSuggestion-${index}`} className="flex justify-end">
                  <div className="flex items-end space-x-3 max-w-md flex-row-reverse space-x-reverse">
                    {getAvatar('userSuggestion')}
                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-2xl px-4 py-3 shadow-lg transition-all duration-200">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-xs font-medium text-purple-100">User Suggestion</span>
                        <span className="text-xs text-purple-200">
                          {formatTimestamp(suggestion.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-white">{suggestion.suggestion}</p>

                      {/* Show reasoning */}
                      {suggestion.reasoning && (
                        <div className="mt-2 pt-2 border-t border-purple-400 border-opacity-30">
                          <p className="text-xs text-purple-200">
                            <span className="font-medium">Reasoning:</span> {suggestion.reasoning}
                          </p>
                        </div>
                      )}

                      {/* Comments Section for User Suggestions */}
                      <div className="mt-3 pt-3 border-t border-purple-400 border-opacity-30">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs text-purple-200 flex items-center space-x-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            <span>Comments ({suggestion.comments?.length || 0})</span>
                          </div>
                          <button
                            onClick={() => startAddingComment(suggestion.id)}
                            className="text-xs text-purple-200 hover:text-white flex items-center space-x-1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            <span className="font-bold">Add Comment</span>
                          </button>
                        </div>

                        {suggestion.comments && suggestion.comments.length > 0 && (
                          <div className="space-y-2 mb-3">
                            {suggestion.comments.map((comment) => (
                              <div key={comment.id} className="bg-purple-900 bg-opacity-20 rounded-lg p-2">
                                <p className="text-xs text-purple-100">{comment.text}</p>
                                <div className="flex items-center justify-between mt-1">
                                  <span className="text-xs text-purple-300">{comment.author}</span>
                                  <span className="text-xs text-purple-300">
                                    {new Date(comment.timestamp).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {activeCommentTip === suggestion.id && (
                          <div className="mt-2">
                            <textarea
                              value={commentText}
                              onChange={(e) => setCommentText(e.target.value)}
                              placeholder="Add a comment about this suggestion..."
                              className="w-full p-2 text-sm bg-purple-900 bg-opacity-20 border border-purple-400 border-opacity-30 rounded-lg text-purple-100 placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-300"
                              rows={3}
                            />
                            <div className="flex justify-end space-x-2 mt-2">
                              <button
                                onClick={cancelAddingComment}
                                className="px-3 py-1 text-xs text-purple-200 hover:text-white"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleAddComment(suggestion.id)}
                                disabled={!commentText.trim() || isAddingComment}
                                className="px-3 py-1 text-xs bg-purple-700 text-white rounded hover:bg-purple-600 disabled:opacity-50"
                              >
                                {isAddingComment ? 'Adding...' : 'Add Comment'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            }

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
  }

  const renderStagesTab = () => {
    const feedback = report?.feedback
    const { stageProgression } = feedback!;

    if (!feedback?.stageProgression) {
      return (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No stage data available</h3>
            <p className="text-gray-500">This call report doesn't contain stage progression data.</p>
          </div>
        </div>
      )
    }

    const stageLabels = {
      setTheStage: 'Set the Stage',
      "Walkthrough-Building-Rapport": 'Walkthrough / Building Rapport',
      "DiscoverPersonalMotivation(s)": 'Discover the Personal Motivation(s) That Will Lead to Action',
      dealKillers: 'Deal Killer (Risk/Discomfort,Relationships,Time,Competition/Options)',
      Transition: 'Transition',
      "Solution-Offer": 'Solution/Offer'
    }

    return (
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Sentiment Analysis */}
        {feedback.sentimentAnalysis && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Sentiment Analysis</h3>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Overall Sentiment:</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getSentimentColor(feedback.sentimentAnalysis.overall)}`}>
                  {feedback.sentimentAnalysis.overall}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">Timeline: {feedback.sentimentAnalysis.timeline}</p>
            </div>

            {feedback.sentimentAnalysis.keyMoments && feedback.sentimentAnalysis.keyMoments.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Key Sentiment Moments</h4>
                <div className="space-y-3">
                  {feedback.sentimentAnalysis.keyMoments.map((moment, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getSentimentColor(moment.sentiment)}`}>
                        {moment.sentiment}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">{moment.context}</p>
                        <p className="text-xs text-gray-500 mt-1">{moment.timestamp}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stage Progression */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center mb-6">
            <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center mr-3">
              <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Stage Progression</h3>
          </div>

          <div className="space-y-4">
            {stageProgression ? (["setTheStage", "Walkthrough-Building-Rapport", "DiscoverPersonalMotivation(s)", "dealKillers", "Transition", "Solution-Offer"] as const).map((stageKey) => (
              <div key={stageKey} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-900">
                    {stageLabels[stageKey as keyof typeof stageLabels] || stageKey}
                  </h4>
                  <div className="flex items-center space-x-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPercentageColor(stageProgression[stageKey].percentage)}`}>
                      {stageProgression[stageKey].percentage}%
                    </span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(stageProgression[stageKey].score)}`}>
                      {stageProgression[stageKey].score}/{stageProgression[stageKey].maxScore}
                    </span>
                  </div>
                </div>
 
                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${stageProgression[stageKey].percentage >= 80 ? 'bg-green-500' :
                      stageProgression[stageKey].percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                    style={{ width: `${stageProgression[stageKey].percentage}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className={`px-2 py-1 rounded ${stageProgression[stageKey].attempted ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {stageProgression[stageKey].attempted ? 'Attempted' : 'Not Attempted'}
                  </span>
                </div>

                {stageProgression[stageKey].notes && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-700">{stageProgression[stageKey].notes}</p>
                  </div>
                )}
              </div>
            )) : <></>}
          </div>
        </div>

        {/* Strengths */}
        {feedback.strengths && feedback.strengths.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Strengths</h3>
            </div>
            <ul className="space-y-2">
              {feedback.strengths.map((strength, index) => (
                <li key={index} className="flex items-start space-x-2">
                  <svg className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-gray-700">{strength}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Areas for Improvement */}
        {feedback.areasForImprovement && feedback.areasForImprovement.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Areas for Improvement</h3>
            </div>
            <ul className="space-y-2">
              {feedback.areasForImprovement.map((area, index) => (
                <li key={index} className="flex items-start space-x-2">
                  <svg className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-gray-700">{area}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Coaching Advice */}
        {feedback.coachingAdvice && feedback.coachingAdvice.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Coaching Advice</h3>
            </div>
            <ul className="space-y-2">
              {feedback.coachingAdvice.map((advice, index) => (
                <li key={index} className="flex items-start space-x-2">
                  <svg className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9.664 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-gray-700">{advice}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

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

        {/* Enhanced Call Summary */}
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
              {feedback.callSummary.sellerName && (
                <div>
                  <span className="text-sm font-medium text-gray-600">Seller Name:</span>
                  <p className="text-gray-900">{feedback.callSummary.sellerName}</p>
                </div>
              )}
              {feedback.callSummary.propertyAddress && (
                <div>
                  <span className="text-sm font-medium text-gray-600">Property Address:</span>
                  <p className="text-gray-900">{feedback.callSummary.propertyAddress}</p>
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
              {feedback.callSummary.decisionMakers && (
                <div>
                  <span className="text-sm font-medium text-gray-600">Decision Makers:</span>
                  <p className="text-gray-900">{feedback.callSummary.decisionMakers}</p>
                </div>
              )}
              {feedback.callSummary.wasOfferDiscussed !== undefined && (
                <div>
                  <span className="text-sm font-medium text-gray-600">Offer Discussed:</span>
                  <p className="text-gray-900">{feedback.callSummary.wasOfferDiscussed ? 'Yes' : 'No'}</p>
                </div>
              )}
            </div>

            {/* Key Pain Points */}
            {feedback.callSummary.keyPainPoints && feedback.callSummary.keyPainPoints.length > 0 && (
              <div className="mt-4">
                <span className="text-sm font-medium text-gray-600 block mb-2">Key Pain Points:</span>
                <div className="flex flex-wrap gap-2">
                  {feedback.callSummary.keyPainPoints.map((painPoint, index) => (
                    <span key={index} className="px-3 py-1 bg-red-100 text-red-800 text-sm rounded-full">
                      {painPoint}
                    </span>
                  ))}
                </div>
              </div>
            )}
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
                <div className="flex items-center space-x-3 mb-2">
                  <h2 className="text-3xl font-bold text-gray-900">Call Report Details</h2>
                  {report.isTrained && (
                    <span className="bg-green-100 text-green-800 text-sm font-medium px-2.5 py-0.5 rounded-full">
                      Trained
                    </span>
                  )}
                  {report.feedback?.sentimentAnalysis && (
                    <span className={`text-sm font-medium px-2.5 py-0.5 rounded-full ${getSentimentColor(report.feedback.sentimentAnalysis.overall)}`}>
                      {report.feedback.sentimentAnalysis.overall} sentiment
                    </span>
                  )}
                </div>
                <p className="text-gray-600">Call SID: {report.callSid}</p>

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
              <div className="flex space-x-3">
                <button
                  onClick={handleTrainAgent}
                  disabled={isTraining}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                >
                  {isTraining ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                        <path fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75" />
                      </svg>
                      <span>Training...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>{report?.isTrained ? 'Re-train Agent' : 'Train Agent'}</span>
                    </>
                  )}
                </button>
                <Link
                  href="/call-reports"
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Back to Reports
                </Link>
              </div>
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
                  onClick={() => setActiveTab('stages')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'stages'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span>Stages & Analytics</span>
                    {report.feedback?.stageProgression && (
                      <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">
                        Available
                      </span>
                    )}
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

            {activeTab === 'conversation' && renderConversationTab()}
            {activeTab === 'stages' && renderStagesTab()}
            {activeTab === 'feedback' && renderFeedbackTab()}
          </div>
        </div>
      </main>
    </div>
  )
}