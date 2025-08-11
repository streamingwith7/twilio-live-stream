'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { User } from '@/types'
import Navigation from '@/components/Navigation'
import LoadingSpinner from '@/components/LoadingSpinner'

interface OfflineFeedback {
  id: string
  agent: string
  seller: string
  feedback: any
  transcript: string
  createdAt: string
  updatedAt: string
}

export default function OfflineReportsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [feedbacks, setFeedbacks] = useState<OfflineFeedback[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFeedback, setSelectedFeedback] = useState<OfflineFeedback | null>(null)
  const [showForm, setShowForm] = useState(false)
  
  // Form state
  const [transcript, setTranscript] = useState('')
  const [agent, setAgent] = useState('')
  const [seller, setSeller] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')

    if (!token || !userData) {
      router.push('/')
      return
    }

    setUser(JSON.parse(userData))
    fetchFeedbacks()
  }, [router])

  const fetchFeedbacks = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/offline-reports')
      const data = await response.json()

      if (response.ok) {
        setFeedbacks(data)
      } else {
        setError(data.error || 'Failed to fetch feedbacks')
      }
    } catch (error) {
      console.error('Error fetching feedbacks:', error)
      setError('Failed to fetch feedbacks')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!transcript.trim() || !agent.trim() || !seller.trim()) {
      setError('Please fill in all fields')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript: transcript.trim(),
          agent: agent.trim(),
          seller: seller.trim()
        }),
      })

      if (response.ok) {
        // Clear form
        setTranscript('')
        setAgent('')
        setSeller('')
        setShowForm(false)
        
        // Refresh feedbacks list
        await fetchFeedbacks()
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to generate feedback')
      }
    } catch (error) {
      console.error('Error submitting transcript:', error)
      setError('Failed to generate feedback')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (feedbackId: string) => {
    if (!confirm('Are you sure you want to delete this feedback?')) {
      return
    }

    try {
      const response = await fetch(`/api/offline-reports?id=${feedbackId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setFeedbacks(prev => prev.filter(f => f.id !== feedbackId))
        if (selectedFeedback?.id === feedbackId) {
          setSelectedFeedback(null)
        }
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to delete feedback')
      }
    } catch (error) {
      console.error('Error deleting feedback:', error)
      setError('Failed to delete feedback')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600 bg-green-100'
    if (score >= 6) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'text-green-600 bg-green-100'
      case 'negative': return 'text-red-600 bg-red-100'
      default: return 'text-yellow-600 bg-yellow-100'
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/')
  }

  const renderFeedbackDetails = (feedback: any) => {
    if (!feedback) return null

    return (
      <div className="space-y-6">
        {/* Overall Performance */}
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
                {Object.entries(feedback.scores).map(([key, score]: [string, any]) => (
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
              {feedback.strengths.map((strength: string, index: number) => (
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
        {((feedback.areasForImprovement && feedback.areasForImprovement.length > 0) || feedback.improvementArea1 || feedback.improvementArea2) && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Areas for Improvement</h3>
            </div>
            
            {feedback.areasForImprovement && feedback.areasForImprovement.length > 0 && (
              <ul className="space-y-2 mb-4">
                {feedback.areasForImprovement.map((area: string, index: number) => (
                  <li key={index} className="flex items-start space-x-2">
                    <svg className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm text-gray-700">{area}</span>
                  </li>
                ))}
              </ul>
            )}

            {(feedback.improvementArea1 || feedback.improvementArea2) && (
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
            )}
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
              {feedback.coachingAdvice.map((advice: string, index: number) => (
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

        {/* Raw Feedback Display for debugging */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Raw Feedback Data</h4>
          <pre className="text-xs text-gray-600 whitespace-pre-wrap overflow-auto max-h-64">
            {JSON.stringify(feedback, null, 2)}
          </pre>
        </div>
      </div>
    )
  }

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading offline reports..." />
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
                <h1 className="text-3xl font-bold text-gray-900">Offline Call Analysis</h1>
                <p className="mt-2 text-gray-600">
                  Analyze call transcripts and get AI-powered feedback on sales performance
                </p>
              </div>
              <button
                onClick={() => setShowForm(!showForm)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>{showForm ? 'Cancel' : 'Analyze New Transcript'}</span>
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
              <span className="block sm:inline">{error}</span>
              <button
                onClick={() => setError(null)}
                className="absolute top-0 bottom-0 right-0 px-4 py-3"
              >
                <svg className="fill-current h-6 w-6 text-red-500" role="button" viewBox="0 0 20 20">
                  <path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/>
                </svg>
              </button>
            </div>
          )}

          {/* Form */}
          {showForm && (
            <div className="bg-white shadow-lg rounded-lg p-6 mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Submit Transcript for Analysis</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="agent" className="block text-sm font-medium text-gray-700 mb-1">
                      Agent Name
                    </label>
                    <input
                      type="text"
                      id="agent"
                      value={agent}
                      onChange={(e) => setAgent(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter agent name"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="seller" className="block text-sm font-medium text-gray-700 mb-1">
                      Seller Name
                    </label>
                    <input
                      type="text"
                      id="seller"
                      value={seller}
                      onChange={(e) => setSeller(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter seller name"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="transcript" className="block text-sm font-medium text-gray-700 mb-1">
                    Call Transcript
                  </label>
                  <textarea
                    id="transcript"
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    rows={10}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Paste the call transcript here..."
                    required
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-lg transition-colors flex items-center space-x-2"
                  >
                    {submitting ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                          <path fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75" />
                        </svg>
                        <span>Analyzing...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Analyze Transcript</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Feedbacks List */}
            <div className="lg:col-span-1">
              <div className="bg-white shadow-lg rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Past Analyses ({feedbacks.length})</h2>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {feedbacks.length === 0 ? (
                    <div className="p-6 text-center">
                      <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-gray-500">No analyses yet</p>
                      <p className="text-sm text-gray-400 mt-1">Submit your first transcript to get started</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {feedbacks.map((feedback) => (
                        <div
                          key={feedback.id}
                          className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                            selectedFeedback?.id === feedback.id ? 'bg-blue-50 border-r-4 border-blue-500' : ''
                          }`}
                          onClick={() => setSelectedFeedback(feedback)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {feedback.agent} → {feedback.seller}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {formatDate(feedback.createdAt)}
                              </p>
                              {feedback.feedback?.totalScore && (
                                <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-2 ${getScoreColor(feedback.feedback.totalScore)}`}>
                                  Score: {feedback.feedback.totalScore}/100
                                </div>
                              )}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDelete(feedback.id)
                              }}
                              className="ml-2 text-red-400 hover:text-red-600"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Feedback Details */}
            <div className="lg:col-span-2">
              {selectedFeedback ? (
                <div className="bg-white shadow-lg rounded-lg">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                          Analysis: {selectedFeedback.agent} → {selectedFeedback.seller}
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                          Generated on {formatDate(selectedFeedback.createdAt)}
                        </p>
                      </div>
                      {selectedFeedback.feedback?.sentimentAnalysis && (
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getSentimentColor(selectedFeedback.feedback.sentimentAnalysis.overall)}`}>
                          {selectedFeedback.feedback.sentimentAnalysis.overall} sentiment
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="p-6 max-h-96 overflow-y-auto">
                    {renderFeedbackDetails(selectedFeedback.feedback)}
                  </div>
                </div>
              ) : (
                <div className="bg-white shadow-lg rounded-lg">
                  <div className="p-12 text-center">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Select an Analysis</h3>
                    <p className="text-gray-500">Choose a feedback report from the list to view detailed analysis</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 