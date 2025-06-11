import { CallStatus } from '@/types'

export const formatDuration = (duration: string | number): string => {
  const seconds = typeof duration === 'string' ? parseInt(duration) : duration
  if (seconds === 0) return 'Just started'
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`
}

export const formatDirection = (direction: string): string => {
  switch (direction) {
    case 'outbound-dial': return 'Outbound'
    case 'inbound': return 'Inbound'
    default: return direction
  }
}

export const getStatusColor = (status: CallStatus['status']): string => {
  switch (status) {
    case 'idle': return 'bg-gray-500'
    case 'ringing': return 'bg-yellow-500 animate-pulse'
    case 'in-progress': return 'bg-green-500 animate-pulse'
    case 'completed': return 'bg-blue-500'
    case 'busy': return 'bg-orange-500'
    case 'failed': return 'bg-red-500'
    default: return 'bg-gray-500'
  }
}

export const getStatusText = (status: CallStatus['status']): string => {
  switch (status) {
    case 'idle': return 'Ready'
    case 'ringing': return 'Ringing'
    case 'in-progress': return 'Active Call'
    case 'completed': return 'Call Ended'
    case 'busy': return 'Busy'
    case 'failed': return 'Failed'
    default: return 'Unknown'
  }
}

export const getStatusBadge = (status: string): string => {
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

export const formatPhoneNumber = (phoneNumber: string): string => {
  // Remove any non-digit characters
  const cleaned = phoneNumber.replace(/\D/g, '')

  // Format as (XXX) XXX-XXXX if it's a US number
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    const number = cleaned.slice(1)
    return `+1 (${number.slice(0, 3)}) ${number.slice(3, 6)}-${number.slice(6)}`
  } else if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }

  return phoneNumber
}

export const formatDateTime = (dateString: string): { date: string; time: string } => {
  const date = new Date(dateString)
  return {
    date: date.toLocaleDateString(),
    time: date.toLocaleTimeString()
  }
}