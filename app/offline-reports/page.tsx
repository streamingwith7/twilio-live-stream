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
  recordingUrl?: string
  createdAt: string
  updatedAt: string
  managerComments?: Array<{
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
  }>
}

export default function OfflineReportsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [feedbacks, setFeedbacks] = useState<OfflineFeedback[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  
  // Form state
  const [transcript, setTranscript] = useState('')
  const [agent, setAgent] = useState('')
  const [seller, setSeller] = useState('')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

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
    fetchFeedbacks()
  }, [router])

  const fetchFeedbacks = async () => {
    try {
      setLoading(true)
      const response = await makeAuthenticatedRequest('/api/offline-reports')
      const data = await response.json()

      if (response.ok) {
        setFeedbacks(data)
      } else {
        setError(data.error || 'Failed to fetch feedbacks')
      }
    } catch (error) {
      console.error('Error fetching feedbacks:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch feedbacks')
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
      let recordingUrl = null

      // Upload audio file if provided
      if (audioFile) {
        setUploading(true)
        const formData = new FormData()
        formData.append('audio', audioFile)

        const uploadResponse = await makeAuthenticatedRequest('/api/upload-audio', {
          method: 'POST',
          body: formData
        })

        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json()
          recordingUrl = uploadData.fileUrl
        } else {
          const uploadError = await uploadResponse.json()
          setError(uploadError.error || 'Failed to upload audio file')
          setUploading(false)
          setSubmitting(false)
          return
        }
        setUploading(false)
      }

      const response = await makeAuthenticatedRequest('/api/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          transcript: transcript.trim(),
          agent: agent.trim(),
          seller: seller.trim(),
          recordingUrl: recordingUrl
        }),
      })

      if (response.ok) {
        // Clear form
        setTranscript('')
        setAgent('')
        setSeller('')
        setAudioFile(null)
        setShowForm(false)
        
        // Refresh feedbacks list
        await fetchFeedbacks()
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to generate feedback')
      }
    } catch (error) {
      console.error('Error submitting transcript:', error)
      setError(error instanceof Error ? error.message : 'Failed to generate feedback')
    } finally {
      setSubmitting(false)
      setUploading(false)
    }
  }

  const handleDelete = async (feedbackId: string) => {
    if (!confirm('Are you sure you want to delete this feedback?')) {
      return
    }

    try {
      const response = await makeAuthenticatedRequest(`/api/offline-reports?id=${feedbackId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setFeedbacks(prev => prev.filter(f => f.id !== feedbackId))
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to delete feedback')
      }
    } catch (error) {
      console.error('Error deleting feedback:', error)
      setError(error instanceof Error ? error.message : 'Failed to delete feedback')
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
                  <label htmlFor="audioFile" className="block text-sm font-medium text-gray-700 mb-1">
                    Call Recording (Optional)
                  </label>
                  <input
                    type="file"
                    id="audioFile"
                    accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.webm"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        // Validate file size (50MB limit)
                        const maxSize = 50 * 1024 * 1024
                        if (file.size > maxSize) {
                          setError('File too large. Maximum size is 50MB.')
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
                          setError('Invalid file type. Please upload an audio file (MP3, WAV, M4A, AAC, OGG, WebM).')
                          e.target.value = ''
                          return
                        }
                        
                        setError(null)
                        setAudioFile(file)
                      } else {
                        setAudioFile(null)
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Upload an audio file of the call so managers can listen while reviewing the analysis. Supported formats: MP3, WAV, M4A, AAC, OGG, WebM (max 50MB).
                  </p>
                  {audioFile && (
                    <div className="mt-2 p-2 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <span className="font-medium">Selected:</span> {audioFile.name} ({(audioFile.size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    </div>
                  )}
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
                    disabled={submitting || uploading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-lg transition-colors flex items-center space-x-2"
                  >
                    {uploading ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                          <path fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75" />
                        </svg>
                        <span>Uploading Audio...</span>
                      </>
                    ) : submitting ? (
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

          {/* Reports Table */}
          <div className="bg-white shadow-lg rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Past Analyses ({feedbacks.length})</h2>
            </div>
            <div className="overflow-x-auto">
              {feedbacks.length === 0 ? (
                <div className="p-12 text-center">
                  <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No analyses yet</h3>
                  <p className="text-gray-500">Submit your first transcript to get started</p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Agent
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Seller
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Score
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Recording
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {feedbacks.map((feedback) => (
                      <tr 
                        key={feedback.id} 
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => router.push(`/offline-reports/${feedback.id}`)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{feedback.agent}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{feedback.seller}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {feedback.feedback?.totalScore ? (
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getScoreColor(feedback.feedback.totalScore)}`}>
                              {feedback.feedback.totalScore}/100
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {feedback.recordingUrl ? (
                            <div className="flex items-center space-x-2">
                              <audio 
                                controls 
                                className="h-8"
                                onClick={(e) => e.stopPropagation()}
                                preload="none"
                              >
                                <source src={feedback.recordingUrl} type="audio/mpeg" />
                                <source src={feedback.recordingUrl} type="audio/wav" />
                                <source src={feedback.recordingUrl} type="audio/mp4" />
                                Your browser does not support the audio element.
                              </audio>
                              <a
                                href={feedback.recordingUrl}
                                download
                                onClick={(e) => e.stopPropagation()}
                                className="text-blue-600 hover:text-blue-900 text-xs"
                                title="Download audio file"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </a>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{formatDate(feedback.createdAt)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Link
                            href={`/offline-reports/${feedback.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-600 hover:text-blue-900 mr-4"
                          >
                            View Details
                          </Link>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(feedback.id)
                            }}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 