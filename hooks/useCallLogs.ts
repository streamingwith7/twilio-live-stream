import { useState, useEffect } from 'react'
import { CallLogsResponse } from '@/types'

export const useCallLogs = (phoneNumber: string | null) => {
  const [callLogs, setCallLogs] = useState<CallLogsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchCallLogs = async (phone: string) => {
    const token = localStorage.getItem('token')
    if (!token) return

    setLoading(true)
    setError('')

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
        setError(data.error || 'Failed to fetch call logs')
      }
    } catch (error) {
      setError('Failed to fetch call logs')
    } finally {
      setLoading(false)
    }
  }

  const refreshCallLogs = () => {
    if (phoneNumber) {
      fetchCallLogs(phoneNumber)
    }
  }

  useEffect(() => {
    if (phoneNumber) {
      fetchCallLogs(phoneNumber)
    }
  }, [phoneNumber])

  return {
    callLogs,
    loading,
    error,
    refreshCallLogs
  }
}