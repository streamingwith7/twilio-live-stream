'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User } from '@/types'
import Navigation from '@/components/Navigation'
import LoadingSpinner from '@/components/LoadingSpinner'

interface Prompt {
  id: string
  key: string
  name: string
  description?: string
  type: string
  content: string
  variables?: any
  isActive: boolean
  version: number
  createdAt: string
  updatedAt: string
  createdBy?: string
}

const PROMPT_TYPES = [
  'SALES_COACHING',
  'SENTIMENT_ANALYZER', 
  'STAGE_DETECTOR',
  'CALL_FEEDBACK',
  'COACHING_RULES',
  'PROMPT_HELPERS'
]

export default function PromptManagementPage() {
  const [user, setUser] = useState<User | null>(null)
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [formData, setFormData] = useState({
    key: '',
    name: '',
    description: '',
    type: 'SALES_COACHING',
    content: '',
    variables: '',
    isActive: true
  })
  const [filterType, setFilterType] = useState<string>('')
  const [filterActive, setFilterActive] = useState<string>('')
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')

    if (!token || !userData) {
      router.push('/auth/signin')
      return
    }

    try {
      setUser(JSON.parse(userData))
      fetchPrompts()
    } catch (error) {
      console.error('Error parsing user data:', error)
      router.push('/auth/signin')
    }
  }, [router])

  const fetchPrompts = async () => {
    try {
      const params = new URLSearchParams()
      if (filterType) params.append('type', filterType)
      if (filterActive) params.append('active', filterActive)

      const response = await fetch(`/api/prompts?${params}`)
      if (response.ok) {
        const data = await response.json()
        setPrompts(data.prompts)
      } else {
        setError('Failed to fetch prompts')
      }
    } catch (error) {
      console.error('Error fetching prompts:', error)
      setError('Error fetching prompts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!loading) {
      fetchPrompts()
    }
  }, [filterType, filterActive])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/')
  }

  const handleCreateNew = () => {
    setFormData({
      key: '',
      name: '',
      description: '',
      type: 'SALES_COACHING',
      content: '',
      variables: '',
      isActive: true
    })
    setIsCreating(true)
    setIsEditing(false)
    setSelectedPrompt(null)
  }

  const handleEdit = (prompt: Prompt) => {
    setFormData({
      key: prompt.key,
      name: prompt.name,
      description: prompt.description || '',
      type: prompt.type,
      content: prompt.content,
      variables: prompt.variables ? JSON.stringify(prompt.variables, null, 2) : '',
      isActive: prompt.isActive
    })
    setSelectedPrompt(prompt)
    setIsEditing(true)
    setIsCreating(false)
  }

  const handleSave = async () => {
    try {
      const payload = {
        ...formData,
        variables: formData.variables ? JSON.parse(formData.variables) : null
      }

      const url = isCreating ? '/api/prompts' : `/api/prompts/${selectedPrompt?.id}`
      const method = isCreating ? 'POST' : 'PUT'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        await fetchPrompts()
        setIsEditing(false)
        setIsCreating(false)
        setSelectedPrompt(null)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to save prompt')
      }
    } catch (error) {
      console.error('Error saving prompt:', error)
      setError('Error saving prompt')
    }
  }

  const handleDelete = async (promptId: string) => {
    if (!confirm('Are you sure you want to delete this prompt?')) return

    try {
      const response = await fetch(`/api/prompts/${promptId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchPrompts()
        if (selectedPrompt?.id === promptId) {
          setSelectedPrompt(null)
          setIsEditing(false)
        }
      } else {
        setError('Failed to delete prompt')
      }
    } catch (error) {
      console.error('Error deleting prompt:', error)
      setError('Error deleting prompt')
    }
  }

  const toggleActiveStatus = async (prompt: Prompt) => {
    try {
      const response = await fetch(`/api/prompts/${prompt.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...prompt,
          isActive: !prompt.isActive
        })
      })

      if (response.ok) {
        await fetchPrompts()
      } else {
        setError('Failed to update prompt status')
      }
    } catch (error) {
      console.error('Error updating prompt status:', error)
      setError('Error updating prompt status')
    }
  }

  const cancelEdit = () => {
    setIsEditing(false)
    setIsCreating(false)
    setSelectedPrompt(null)
    setError(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      <Navigation user={user} onLogout={handleLogout} />
      
      <main className="flex-1 max-w-7xl mx-auto w-full py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">Prompt Management</h2>
                <p className="mt-2 text-gray-600">Manage AI prompts for the coaching system</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="flex">
              <div className="w-1/3 border-r border-gray-200">
                <div className="p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Prompts ({prompts.length})</h3>
                  <div className="space-y-2">
                    {prompts.map((prompt) => (
                      <div
                        key={prompt.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedPrompt?.id === prompt.id
                            ? 'bg-blue-50 border-blue-200'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                        onClick={() => setSelectedPrompt(prompt)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <h4 className="font-medium text-gray-900">{prompt.name}</h4>
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                prompt.isActive 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {prompt.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500">{prompt.type.replace('_', ' ')}</p>
                            <p className="text-xs text-gray-400">v{prompt.version}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Prompt Details/Editor */}
              <div className="flex-1">
                {(isEditing || isCreating) ? (
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-medium text-gray-900">
                        {isCreating ? 'Create New Prompt' : 'Edit Prompt'}
                      </h3>
                      <div className="flex space-x-3">
                        <button
                          onClick={cancelEdit}
                          className="px-4 py-2 text-gray-600 hover:text-gray-800"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={!formData.key || !formData.name || !formData.content}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          Save
                        </button>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
                        <textarea
                          value={formData.content}
                          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm"
                          rows={100}
                          placeholder="Enter the prompt content..."
                        />
                      </div>
                    </div>
                  </div>
                ) : selectedPrompt ? (
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">{selectedPrompt.name}</h3>
                        <p className="text-sm text-gray-500">{selectedPrompt.description}</p>
                      </div>
                      <div className="flex space-x-3">
                        <button
                          onClick={() => toggleActiveStatus(selectedPrompt)}
                          className={`px-3 py-1 text-xs rounded-full ${
                            selectedPrompt.isActive
                              ? 'bg-red-100 text-red-800 hover:bg-red-200'
                              : 'bg-green-100 text-green-800 hover:bg-green-200'
                          }`}
                        >
                          {selectedPrompt.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleEdit(selectedPrompt)}
                          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(selectedPrompt.id)}
                          className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-700">Key:</span>
                          <p className="text-gray-900">{selectedPrompt.key}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Type:</span>
                          <p className="text-gray-900">{selectedPrompt.type.replace('_', ' ')}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Version:</span>
                          <p className="text-gray-900">v{selectedPrompt.version}</p>
                        </div>
                      </div>

                      <div>
                        <span className="font-medium text-gray-700 text-sm">Content:</span>
                        <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <pre className="text-sm text-gray-900 whitespace-pre-wrap font-mono">
                            {selectedPrompt.content}
                          </pre>
                        </div>
                      </div>

                      {selectedPrompt.variables && (
                        <div>
                          <span className="font-medium text-gray-700 text-sm">Variables:</span>
                          <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <pre className="text-sm text-gray-900 whitespace-pre-wrap font-mono">
                              {JSON.stringify(selectedPrompt.variables, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}

                      <div className="text-xs text-gray-500 pt-4 border-t border-gray-200">
                        <p>Created: {new Date(selectedPrompt.createdAt).toLocaleString()}</p>
                        <p>Updated: {new Date(selectedPrompt.updatedAt).toLocaleString()}</p>
                        {selectedPrompt.createdBy && <p>By: {selectedPrompt.createdBy}</p>}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center text-gray-500">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Select a prompt</h3>
                    <p>Choose a prompt from the list to view or edit its details.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 