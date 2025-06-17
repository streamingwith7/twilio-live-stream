import { PhoneNumber, CallStatus } from '@/types'
import { useState } from 'react'

interface PhoneCardProps {
  phone: PhoneNumber
  callStatus: CallStatus
  onClick?: (phoneNumber: string) => void
  isSelected?: boolean
  onConnectionToggle?: (phoneNumber: PhoneNumber, action: 'connect' | 'disconnect') => Promise<void>
}

export default function PhoneCard({ 
  phone, 
  callStatus, 
  onClick, 
  isSelected = false, 
  onConnectionToggle 
}: PhoneCardProps) {
  const [isLoading, setIsLoading] = useState(false)

  const getStatusColor = (status: CallStatus['status']) => {
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

  const getStatusText = (status: CallStatus['status']) => {
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

  const handleClick = () => {
    if (onClick) {
      onClick(phone.phoneNumber)
    }
  }

  const handleConnectionToggle = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onConnectionToggle) return

    setIsLoading(true)
    try {
      const action = phone.isConnectedToPlatform ? 'disconnect' : 'connect'
      await onConnectionToggle(phone, action)
    } catch (error) {
      console.error('Failed to toggle connection:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className={`bg-white rounded-lg shadow-lg border border-gray-200 transition-all ${onClick ? 'cursor-pointer hover:shadow-xl hover:border-blue-200' : ''
        } ${isSelected ? 'ring-2 ring-blue-500 border-blue-300' : ''}`}
      onClick={handleClick}
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{phone.phoneNumber}</h3>
              <p className="text-sm text-gray-500">{phone.friendlyName}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${getStatusColor(callStatus.status)}`}></div>
            {onClick && (
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${isSelected ? 'transform rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </div>
        </div>

        {/* Connection Status */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Platform Connection:</span>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${phone.isConnectedToPlatform ? 'bg-green-500' : 'bg-gray-400'}`}></div>
              <span className={`text-xs font-semibold ${phone.isConnectedToPlatform ? 'text-green-600' : 'text-gray-600'}`}>
                {phone.isConnectedToPlatform ? 'Connected' : 'Not Connected'}
              </span>
            </div>
          </div>
          
          {phone.isConnectedToPlatform && (
            <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded mb-2">
              ✓ Real-time audio streaming enabled
            </div>
          )}
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Call Status:</span>
            <span className={`text-sm font-semibold ${callStatus.status === 'in-progress' ? 'text-green-600' :
              callStatus.status === 'ringing' ? 'text-yellow-600' :
                callStatus.status === 'failed' ? 'text-red-600' :
                  'text-gray-600'
              }`}>
              {getStatusText(callStatus.status)}
            </span>
          </div>

          {callStatus.from && (
            <div className="text-xs text-gray-500 mb-1">
              From: {callStatus.from}
            </div>
          )}

          {callStatus.to && (
            <div className="text-xs text-gray-500 mb-1">
              To: {callStatus.to}
            </div>
          )}

          {callStatus.duration && (
            <div className="text-xs text-gray-500 mb-1">
              Duration: {callStatus.duration}s
            </div>
          )}

          {callStatus.timestamp && (
            <div className="text-xs text-gray-500">
              Last Update: {new Date(callStatus.timestamp).toLocaleTimeString()}
            </div>
          )}
        </div>

        <div className="border-t pt-4 mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Capabilities:</h4>
          <div className="flex space-x-2">
            {phone.capabilities.voice && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Voice
              </span>
            )}
            {phone.capabilities.sms && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                SMS
              </span>
            )}
            {phone.capabilities.mms && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                MMS
              </span>
            )}
          </div>
        </div>

        {/* Connect/Disconnect Button */}
        {onConnectionToggle && phone.capabilities.voice && (
          <div className="border-t pt-4">
            <button
              onClick={handleConnectionToggle}
              disabled={isLoading}
              className={`w-full flex items-center justify-center px-4 py-2 rounded-lg font-medium text-sm transition-colors ${phone.isConnectedToPlatform
                  ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 hover:border-red-300'
                  : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 hover:border-blue-300'
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : phone.isConnectedToPlatform ? (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
                  </svg>
                  Disconnect from Closemydeals
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Connect with Closemydeals
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}