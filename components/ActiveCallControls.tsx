'use client'

import { useState } from 'react'

interface ActiveCallControlsProps {
  callStatus: string
  callerNumber: string
  isMuted: boolean
  volume: number
  onMute: () => void
  onHangup: () => void
  onVolumeChange: (volume: number) => void
  callDuration?: number
}

export default function ActiveCallControls({
  callStatus,
  callerNumber,
  isMuted,
  volume,
  onMute,
  onHangup,
  onVolumeChange,
  callDuration = 0
}: ActiveCallControlsProps) {
  const [showVolumeControl, setShowVolumeControl] = useState(false)

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getStatusColor = () => {
    switch (callStatus) {
      case 'connecting': return 'text-yellow-600 bg-yellow-100'
      case 'connected': return 'text-green-600 bg-green-100'
      case 'ringing': return 'text-blue-600 bg-blue-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusText = () => {
    switch (callStatus) {
      case 'connecting': return 'Connecting...'
      case 'connected': return 'Connected'
      case 'ringing': return 'Ringing...'
      default: return callStatus
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
      <div className="text-center">
        {/* Call Status */}
        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mb-4 ${getStatusColor()}`}>
          <div className="w-2 h-2 bg-current rounded-full mr-2 animate-pulse"></div>
          {getStatusText()}
        </div>

        {/* Caller Info */}
        <h3 className="text-xl font-semibold text-gray-900 mb-2">{callerNumber}</h3>
        
        {/* Call Duration */}
        {callStatus === 'connected' && (
          <p className="text-gray-600 mb-6">{formatDuration(callDuration)}</p>
        )}

        {/* Call Controls */}
        <div className="flex justify-center items-center space-x-4">
          {/* Mute Button */}
          <button
            onClick={onMute}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-200 shadow-md ${
              isMuted 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728m-5.657-2.829a3 3 0 010-4.243M9 9h.01M12 9v6m-6-6h3a1 1 0 01.8.4L12 12l2.2-2.6A1 1 0 0115 9h3" />
              </svg>
            )}
          </button>

          {/* Volume Control */}
          <div className="relative">
            <button
              onClick={() => setShowVolumeControl(!showVolumeControl)}
              className="w-12 h-12 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center transition-colors duration-200 shadow-md text-gray-700"
              title="Volume Control"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M9 9l3-3v12l-3-3H4a1 1 0 01-1-1V10a1 1 0 011-1h5z" />
              </svg>
            </button>

            {/* Volume Slider */}
            {showVolumeControl && (
              <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-lg border border-gray-200 p-3">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M9 9l3-3v12l-3-3H4a1 1 0 01-1-1V10a1 1 0 011-1h5z" />
                  </svg>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                    className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-xs text-gray-600">{Math.round(volume * 100)}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Hangup Button */}
          <button
            onClick={onHangup}
            className="w-12 h-12 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors duration-200 shadow-md text-white"
            title="Hang Up"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </button>
        </div>

        {/* Connection Status */}
        <div className="mt-4 text-xs text-gray-500">
          Browser calling • Click volume to adjust audio
        </div>
      </div>
    </div>
  )
} 