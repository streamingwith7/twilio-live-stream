'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { User } from '@/types'
import Navigation from '@/components/Navigation'
import LoadingSpinner from '@/components/LoadingSpinner'

interface ManagerComment {
  id: string
  sectionName: string
  sectionKey?: string
  agreement: string
  comment: string
  manager: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  createdAt: string
}

interface OfflineFeedback {
  id: string
  agent: string
  seller: string
  feedback: any
  transcript: string
  recordingUrl?: string
  managerComments?: ManagerComment[]
  createdAt: string
  updatedAt: string
}

export default function OfflineReportDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [feedback, setFeedback] = useState<OfflineFeedback | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [managerComments, setManagerComments] = useState<ManagerComment[]>([])
  const [activeCommentSection, setActiveCommentSection] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const [commentAgreement, setCommentAgreement] = useState('agree')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const feedbackId = params.id as string

  // Helper function for authenticated API calls
  const makeAuthenticatedRequest = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('token')
    
    if (!token) {
      throw new Error('No authentication token found')
    }

    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`
      }
    })
  }

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')

    if (!token || !userData) {
      router.push('/')
      return
    }

    setUser(JSON.parse(userData))

    if (feedbackId) {
      fetchFeedback()
    }
  }, [feedbackId, router])

  const fetchFeedback = async () => {
    try {
      setLoading(true)
      const response = await makeAuthenticatedRequest('/api/offline-reports')
      const data = await response.json()

      if (response.ok) {
        const selectedFeedback = data.find((f: OfflineFeedback) => f.id === feedbackId)
        if (selectedFeedback) {
          setFeedback(selectedFeedback)
          setManagerComments(selectedFeedback.managerComments || [])
        } else {
          setError('Feedback not found')
        }
      } else {
        setError(data.error || 'Failed to fetch feedback')
      }
    } catch (error) {
      console.error('Error fetching feedback:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch feedback')
    } finally {
      setLoading(false)
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

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600 bg-green-100'
    if (percentage >= 60) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  const getEvaluationColor = (evaluation: string) => {
    if (evaluation.includes('OK') || evaluation.includes('Partial') || evaluation.includes('Good') || evaluation.includes('Strong')) return 'text-yellow-600 bg-yellow-100'
    if (evaluation.includes('Missed') || evaluation.includes('No') || evaluation.includes('Not Attempted')) return 'text-red-600 bg-red-100'
    return 'text-green-600 bg-green-100'
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/')
  }

  const handleSubmitComment = async (sectionName: string, sectionKey?: string) => {
    if (!commentText.trim() || !feedbackId) return

    setSubmittingComment(true)
    try {
      const response = await makeAuthenticatedRequest('/api/manager-comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          feedbackId,
          sectionName,
          sectionKey: sectionKey || null,
          agreement: commentAgreement,
          comment: commentText.trim()
        }),
      })

      if (response.ok) {
        const result = await response.json()
        // Update local state with the new/updated comment
        setManagerComments(prev => {
          const existing = prev.find(c => 
            c.sectionName === sectionName && 
            c.sectionKey === sectionKey && 
            c.manager.id === user?.id
          )
          
          if (existing) {
            return prev.map(c => 
              c.id === existing.id ? result.comment : c
            )
          } else {
            return [...prev, result.comment]
          }
        })
        
        // Clear form
        setCommentText('')
        setCommentAgreement('agree')
        setActiveCommentSection(null)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to submit comment')
      }
    } catch (error) {
      console.error('Error submitting comment:', error)
      setError(error instanceof Error ? error.message : 'Failed to submit comment')
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleUploadRecording = async () => {
    if (!audioFile || !feedbackId) return

    setUploading(true)
    setUploadError(null)

    try {
      // Upload the audio file
      const formData = new FormData()
      formData.append('audio', audioFile)

      const uploadResponse = await makeAuthenticatedRequest('/api/upload-audio', {
        method: 'POST',
        body: formData
      })

      if (!uploadResponse.ok) {
        const uploadError = await uploadResponse.json()
        throw new Error(uploadError.error || 'Failed to upload audio file')
      }

      const uploadData = await uploadResponse.json()
      const recordingUrl = uploadData.fileUrl

      // Update the feedback with the recording URL
      const updateResponse = await makeAuthenticatedRequest('/api/offline-reports', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          feedbackId,
          recordingUrl
        }),
      })

      if (!updateResponse.ok) {
        const updateError = await updateResponse.json()
        throw new Error(updateError.error || 'Failed to update feedback with recording')
      }

      // Update local state
      setFeedback(prev => prev ? { ...prev, recordingUrl } : null)
      
      // Clear form and close upload section
      setAudioFile(null)
      setShowUploadForm(false)
      
    } catch (error) {
      console.error('Error uploading recording:', error)
      setUploadError(error instanceof Error ? error.message : 'Failed to upload recording')
    } finally {
      setUploading(false)
    }
  }

  const getExistingComment = (sectionName: string, sectionKey?: string) => {
    return managerComments.find(c => 
      c.sectionName === sectionName && 
      c.sectionKey === sectionKey &&
      c.manager.id === user?.id
    )
  }

  const renderCommentSection = (sectionName: string, sectionKey?: string) => {
    const existingComment = getExistingComment(sectionName, sectionKey)
    const commentKey = sectionKey ? `${sectionName}-${sectionKey}` : sectionName
    const isActive = activeCommentSection === commentKey

    return (
      <div className="mt-4 border-t border-gray-200 pt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-700">Manager Review</h4>
          {!isActive && (
            <button
              onClick={() => {
                setActiveCommentSection(commentKey)
                if (existingComment) {
                  setCommentText(existingComment.comment)
                  setCommentAgreement(existingComment.agreement)
                }
              }}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {existingComment ? 'Edit Comment' : 'Add Comment'}
            </button>
          )}
        </div>

        {/* Existing Comments */}
        {managerComments
          .filter(c => c.sectionName === sectionName && c.sectionKey === sectionKey)
          .map((comment) => (
            <div key={comment.id} className="mb-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-900">
                    {comment.manager.firstName} {comment.manager.lastName}
                  </span>
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                    comment.agreement === 'agree' ? 'bg-green-100 text-green-800' :
                    comment.agreement === 'disagree' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {comment.agreement === 'agree' ? 'Agrees' : 
                     comment.agreement === 'disagree' ? 'Disagrees' : 
                     'Partially Agrees'}
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {formatDate(comment.createdAt)}
                </span>
              </div>
              <p className="text-sm text-gray-700">{comment.comment}</p>
            </div>
          ))}

        {/* Comment Form */}
        {isActive && (
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Assessment
                </label>
                <div className="flex space-x-4">
                  {[
                    { value: 'agree', label: 'Agree', color: 'green' },
                    { value: 'partially_agree', label: 'Partially Agree', color: 'yellow' },
                    { value: 'disagree', label: 'Disagree', color: 'red' }
                  ].map((option) => (
                    <label key={option.value} className="flex items-center">
                      <input
                        type="radio"
                        name="agreement"
                        value={option.value}
                        checked={commentAgreement === option.value}
                        onChange={(e) => setCommentAgreement(e.target.value)}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comments & Reasoning
                </label>
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Explain your assessment and provide feedback..."
                  rows={3}
                  className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => {
                    setActiveCommentSection(null)
                    setCommentText('')
                    setCommentAgreement('agree')
                  }}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSubmitComment(sectionName, sectionKey)}
                  disabled={!commentText.trim() || submittingComment}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {submittingComment ? 'Saving...' : existingComment ? 'Update' : 'Save'} Comment
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderFeedbackDetails = (feedbackData: any) => {
    if (!feedbackData) return null

    return (
      <div className="space-y-6">
        {/* Overall Performance */}
        {feedbackData.totalScore !== undefined && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Overall Performance</h3>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(feedbackData.totalScore)}`}>
                {feedbackData.totalScore}/100
              </div>
            </div>

            {feedbackData.callType && (
              <p className="text-sm text-gray-600 mb-4">
                <span className="font-medium">Call Type:</span> {feedbackData.callType}
              </p>
            )}

            {feedbackData.scores && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(feedbackData.scores).map(([key, score]: [string, any]) => (
                  <div key={key} className="text-center">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 ${getScoreColor(score)}`}>
                      <span className="text-lg font-bold">{score}</span>
                    </div>
                    <p className="text-xs text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                  </div>
                ))}
              </div>
            )}
            
            {/* Manager Comment Section for Overall Performance */}
            {renderCommentSection('Overall Performance')}
          </div>
        )}

        {/* What Went Well */}
        {feedbackData.whatWentWell && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">What Went Well</h3>
            </div>
            <p className="text-gray-700 leading-relaxed">{feedbackData.whatWentWell}</p>
            
            {/* Manager Comment Section for What Went Well */}
            {renderCommentSection('What Went Well')}
          </div>
        )}

        {/* Strengths */}
        {feedbackData.strengths && feedbackData.strengths.length > 0 && (
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
              {feedbackData.strengths.map((strength: string, index: number) => (
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
        {((feedbackData.areasForImprovement && feedbackData.areasForImprovement.length > 0) || feedbackData.improvementArea1 || feedbackData.improvementArea2) && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Areas for Improvement</h3>
            </div>
            
            {feedbackData.areasForImprovement && feedbackData.areasForImprovement.length > 0 && (
              <ul className="space-y-2 mb-4">
                {feedbackData.areasForImprovement.map((area: string, index: number) => (
                  <li key={index} className="flex items-start space-x-2">
                    <svg className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm text-gray-700">{area}</span>
                  </li>
                ))}
              </ul>
            )}

            {(feedbackData.improvementArea1 || feedbackData.improvementArea2) && (
              <div className="space-y-4">
                {feedbackData.improvementArea1 && (
                  <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <h4 className="font-medium text-yellow-800 mb-2">Improvement Area 1</h4>
                    <p className="text-yellow-700 text-sm">{feedbackData.improvementArea1}</p>
                  </div>
                )}
                {feedbackData.improvementArea2 && (
                  <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <h4 className="font-medium text-yellow-800 mb-2">Improvement Area 2</h4>
                    <p className="text-yellow-700 text-sm">{feedbackData.improvementArea2}</p>
                  </div>
                )}
              </div>
            )}
            
            {/* Manager Comment Section for Areas for Improvement */}
            {renderCommentSection('Areas for Improvement')}
          </div>
        )}

        {/* Coaching Advice */}
        {feedbackData.coachingAdvice && feedbackData.coachingAdvice.length > 0 && (
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
              {feedbackData.coachingAdvice.map((advice: string, index: number) => (
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

        {/* Sentiment Analysis */}
        {feedbackData.sentimentAnalysis && (
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
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getSentimentColor(feedbackData.sentimentAnalysis.overall)}`}>
                  {feedbackData.sentimentAnalysis.overall}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">Timeline: {feedbackData.sentimentAnalysis.timeline}</p>
            </div>

            {feedbackData.sentimentAnalysis.keyMoments && feedbackData.sentimentAnalysis.keyMoments.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Key Sentiment Moments</h4>
                <div className="space-y-3">
                  {feedbackData.sentimentAnalysis.keyMoments.map((moment: any, index: number) => (
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
        {feedbackData.stageProgression && (
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
              {(["setTheStage", "Walkthrough", "Building-Rapport", "DiscoverPersonalMotivation(s)", "dealKillers", "Transition", "Solution-Offer"] as const).map((stageKey) => {
                const stageData = feedbackData.stageProgression[stageKey];
                if (!stageData) return null;

                const stageLabels = {
                  setTheStage: 'Set the Stage',
                  "Walkthrough": 'Walkthrough',
                  "Building-Rapport": 'Building Rapport',
                  "DiscoverPersonalMotivation(s)": 'Discover the Personal Motivation(s) That Will Lead to Action',
                  dealKillers: 'Deal Killer (Risk/Discomfort,Relationships,Time,Competition/Options)',
                  Transition: 'Transition',
                  "Solution-Offer": 'Solution/Offer'
                };

                return (
                  <div key={stageKey} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-gray-900">
                        {stageLabels[stageKey as keyof typeof stageLabels] || stageKey}
                      </h4>
                      <div className="flex items-center space-x-3">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPercentageColor(stageData.percentage)}`}>
                          {stageData.percentage}%
                        </span>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(stageData.score)}`}>
                          {stageData.score}/{stageData.maxScore}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          stageData.percentage >= 80 ? 'bg-green-500' :
                          stageData.percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${stageData.percentage}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-sm mb-3">
                      <span className={`px-2 py-1 rounded ${stageData.attempted ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {stageData.attempted ? 'Attempted' : 'Not Attempted'}
                      </span>
                    </div>

                    {stageData.notes && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-700">{stageData.notes}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* Manager Comment Section for Stage Progression */}
            {renderCommentSection('Stage Progression')}
          </div>
        )}

        {/* Quick Evaluation */}
        {feedbackData.quickEvaluation && (
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
              {Object.entries(feedbackData.quickEvaluation).map(([key, evaluation]: [string, any]) => (
                <div key={key} className="flex flex-col p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700 capitalize mb-2">
                    {key.replace(/([A-Z])/g, ' $1').trim()}:
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium self-start ${getEvaluationColor(evaluation)}`}>
                    {evaluation.split(' - ')[0]}
                  </span>
                  {evaluation.includes(' - ') && (
                    <p className="text-xs text-gray-600 mt-2">{evaluation.split(' - ')[1]}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Enhanced Call Summary */}
        {feedbackData.callSummary && (
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
              {feedbackData.callSummary.repName && (
                <div>
                  <span className="text-sm font-medium text-gray-600">Rep Name:</span>
                  <p className="text-gray-900">{feedbackData.callSummary.repName}</p>
                </div>
              )}
              {feedbackData.callSummary.sellerName && (
                <div>
                  <span className="text-sm font-medium text-gray-600">Seller Name:</span>
                  <p className="text-gray-900">{feedbackData.callSummary.sellerName}</p>
                </div>
              )}
              {feedbackData.callSummary.propertyAddress && (
                <div>
                  <span className="text-sm font-medium text-gray-600">Property Address:</span>
                  <p className="text-gray-900">{feedbackData.callSummary.propertyAddress}</p>
                </div>
              )}
              {feedbackData.callSummary.offerType && (
                <div>
                  <span className="text-sm font-medium text-gray-600">Offer Type:</span>
                  <p className="text-gray-900">{feedbackData.callSummary.offerType}</p>
                </div>
              )}
              {feedbackData.callSummary.offerAmount && (
                <div>
                  <span className="text-sm font-medium text-gray-600">Offer Amount:</span>
                  <p className="text-gray-900">{feedbackData.callSummary.offerAmount}</p>
                </div>
              )}
              {feedbackData.callSummary.closeTimeline && (
                <div>
                  <span className="text-sm font-medium text-gray-600">Close Timeline:</span>
                  <p className="text-gray-900">{feedbackData.callSummary.closeTimeline}</p>
                </div>
              )}
              {feedbackData.callSummary.decisionMakers && (
                <div>
                  <span className="text-sm font-medium text-gray-600">Decision Makers:</span>
                  <p className="text-gray-900">{feedbackData.callSummary.decisionMakers}</p>
                </div>
              )}
              {feedbackData.callSummary.wasOfferDiscussed !== undefined && (
                <div>
                  <span className="text-sm font-medium text-gray-600">Offer Discussed:</span>
                  <p className="text-gray-900">{feedbackData.callSummary.wasOfferDiscussed ? 'Yes' : 'No'}</p>
                </div>
              )}
            </div>

            {feedbackData.callSummary.keyPainPoints && feedbackData.callSummary.keyPainPoints.length > 0 && (
              <div className="mt-4">
                <span className="text-sm font-medium text-gray-600 block mb-2">Key Pain Points:</span>
                <div className="flex flex-wrap gap-2">
                  {feedbackData.callSummary.keyPainPoints.map((painPoint: string, index: number) => (
                      <span key={index} className="px-3 py-1 bg-red-100 text-red-800 text-sm rounded-full">
                      {painPoint}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {feedbackData.callSummary.creativeFinancingDetails && (
              <div className="mt-4">
                <span className="text-sm font-medium text-gray-600 block mb-2">Creative Financing Details:</span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-600">PITI:</span>
                    <p className="text-gray-900">{feedbackData.callSummary.creativeFinancingDetails.piti}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Mortgage Balance:</span>
                    <p className="text-gray-900">{feedbackData.callSummary.creativeFinancingDetails.mortgageBalance}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Behind on Payments:</span>
                    <p className="text-gray-900">{feedbackData.callSummary.creativeFinancingDetails.behindOnPayments}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {feedbackData.scriptReference && (
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
              <p className="text-indigo-800 font-medium">{feedbackData.scriptReference}</p>
            </div>
          </div>
        )}

        {feedbackData.timestampQuote && (
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
              <p className="text-orange-800 italic">"{feedbackData.timestampQuote}"</p>
            </div>
          </div>
        )}

        {/* Outcome & Next Steps */}
        {feedbackData.outcomeNextStep && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Outcome & Next Steps</h3>
            </div>
            <p className="text-gray-700 leading-relaxed">{feedbackData.outcomeNextStep}</p>
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading feedback details..." />
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
                href="/offline-reports"
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

  if (!feedback) {
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
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Feedback Not Found</h2>
              <Link
                href="/offline-reports"
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Navigation user={user} onLogout={handleLogout} />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <Link
                  href="/offline-reports"
                  className="text-blue-600 hover:text-blue-800 flex items-center space-x-2 mb-4"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span>Back to Reports</span>
                </Link>
                <div className="flex items-center space-x-3 mb-2">
                  <h1 className="text-3xl font-bold text-gray-900">
                    Analysis: {feedback.agent} → {feedback.seller}
                  </h1>
                  {feedback.feedback?.sentimentAnalysis && (
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getSentimentColor(feedback.feedback.sentimentAnalysis.overall)}`}>
                      {feedback.feedback.sentimentAnalysis.overall} sentiment
                    </span>
                  )}
                </div>
                <p className="text-gray-600">Generated on {formatDate(feedback.createdAt)}</p>
                
                {/* Upload Recording Section */}
                <div className="mt-4">
                  {!feedback.recordingUrl && !showUploadForm && (
                    <button
                      onClick={() => setShowUploadForm(true)}
                      className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span>Upload Call Recording</span>
                    </button>
                  )}
                  
                  {feedback.recordingUrl && !showUploadForm && (
                    <button
                      onClick={() => setShowUploadForm(true)}
                      className="inline-flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <span>Replace Recording</span>
                    </button>
                  )}
                  
                                     {showUploadForm && (
                     <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                       <div className="flex items-center justify-between mb-4">
                         <h4 className="text-sm font-medium text-blue-900">
                           {feedback.recordingUrl ? 'Replace Call Recording' : 'Upload Call Recording'}
                         </h4>
                         <button
                           onClick={() => {
                             setShowUploadForm(false)
                             setAudioFile(null)
                             setUploadError(null)
                           }}
                           className="text-blue-600 hover:text-blue-800 text-sm"
                         >
                           Cancel
                         </button>
                       </div>
                       
                       {uploadError && (
                         <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
                           {uploadError}
                         </div>
                       )}
                       
                       <div className="space-y-3">
                         <div>
                           <input
                             type="file"
                             accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.webm"
                             onChange={(e) => {
                               const file = e.target.files?.[0]
                               if (file) {
                                 // Validate file size (50MB limit)
                                 const maxSize = 50 * 1024 * 1024
                                 if (file.size > maxSize) {
                                   setUploadError('File too large. Maximum size is 50MB.')
                                   e.target.value = ''
                                   return
                                 }
                                 
                                 // Validate file type
                                 const allowedTypes = [
                                   'audio/mpeg',
                                   'audio/mp3', 
                                   'audio/wav',
                                   'audio/mp4',
                                   'audio/m4a',
                                   'audio/aac',
                                   'audio/ogg',
                                   'audio/webm'
                                 ]
                                 
                                 if (!allowedTypes.includes(file.type)) {
                                   setUploadError('Invalid file type. Please upload an audio file (MP3, WAV, M4A, AAC, OGG, WebM).')
                                   e.target.value = ''
                                   return
                                 }
                                 
                                 setUploadError(null)
                                 setAudioFile(file)
                               } else {
                                 setAudioFile(null)
                               }
                             }}
                             className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                           />
                           <p className="text-xs text-blue-600 mt-1">
                             Supported formats: MP3, WAV, M4A, AAC, OGG, WebM (max 50MB)
                           </p>
                         </div>
                         
                         {audioFile && (
                           <div className="p-2 bg-white border border-blue-200 rounded-lg">
                             <p className="text-sm text-blue-800">
                               <span className="font-medium">Selected:</span> {audioFile.name} ({(audioFile.size / 1024 / 1024).toFixed(2)} MB)
                             </p>
                           </div>
                         )}
                         
                         <div className="flex justify-end">
                           <button
                             onClick={handleUploadRecording}
                             disabled={!audioFile || uploading}
                             className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                           >
                             {uploading ? (
                               <>
                                 <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                   <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                                   <path fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75" />
                                 </svg>
                                 <span>Uploading...</span>
                               </>
                             ) : (
                               <>
                                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                 </svg>
                                 <span>{feedback.recordingUrl ? 'Replace Recording' : 'Upload Recording'}</span>
                               </>
                             )}
                           </button>
                         </div>
                       </div>
                     </div>
                   )}
                 </div>
                
                {feedback.recordingUrl && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center space-x-3 mb-3">
                      <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                      </svg>
                      <h4 className="text-sm font-medium text-blue-900">Call Recording</h4>
                    </div>
                    <audio 
                      controls 
                      className="w-full mb-3"
                      preload="metadata"
                    >
                      <source src={feedback.recordingUrl} type="audio/mpeg" />
                      <source src={feedback.recordingUrl} type="audio/wav" />
                      <source src={feedback.recordingUrl} type="audio/mp4" />
                      <source src={feedback.recordingUrl} type="audio/m4a" />
                      Your browser does not support the audio element.
                    </audio>
                    <div className="flex items-center space-x-3">
                      <a
                        href={feedback.recordingUrl}
                        download
                        className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-800 text-sm"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>Download</span>
                      </a>
                      <span className="text-xs text-blue-600">
                        Listen while reviewing the analysis below
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Feedback Details */}
          <div className="space-y-6">
            {renderFeedbackDetails(feedback.feedback)}
            
            {/* Call Transcript */}
            {feedback.transcript && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center mb-4">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Call Transcript</h3>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                    {feedback.transcript}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
} 