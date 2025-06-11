import { PhoneNumber, CallStatus } from '@/types'

interface PhoneCardProps {
  phone: PhoneNumber
  callStatus: CallStatus
  onClick?: (phoneNumber: string) => void
  isSelected?: boolean
}

export default function PhoneCard({ phone, callStatus, onClick, isSelected = false }: PhoneCardProps) {
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

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Status:</span>
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

        <div className="border-t pt-4">
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
      </div>
    </div>
  )
}