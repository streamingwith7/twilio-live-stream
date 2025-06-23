'use client'

import { useState, useEffect } from 'react'
import { io, Socket } from 'socket.io-client'

interface CoachingTip {
  id: string;
  type: 'suggestion' | 'opportunity' | 'next_step' | 'response';
  message: string;
  priority: 'low' | 'medium' | 'high';
  timestamp: string;
  context?: string;
  callSid?: string;
}

interface RealTimeCoachingProps {
  callSid?: string;
  isCallActive: boolean;
  onError?: (error: string) => void;
}

export default function RealTimeCoaching({ 
  callSid, 
  isCallActive, 
  onError 
}: RealTimeCoachingProps) {
  const [tips, setTips] = useState<CoachingTip[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [currentTip, setCurrentTip] = useState<CoachingTip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Initialize socket connection
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token || !isCallActive) return
    console.log('🤖 Initializing coaching socket for callSid:', callSid);
    
    const newSocket = io({
      auth: { token },
      transports: ['polling', 'websocket'],
      upgrade: true,
      timeout: 20000,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    })

    newSocket.on('connect', () => {
      if (callSid) {
        console.log('🤖 Connected to coaching socket', callSid)
        newSocket.emit('joinCoachingRoom', callSid)
      }
    })

    newSocket.on('coachingRoomJoined', (data) => {
      console.log('🤖 Joined coaching room:', data)
    })

    newSocket.on('coachingRoomError', (data) => {
      console.error('🤖 Coaching room error:', data)
      setError(data.error || 'Failed to join coaching room')
      onError?.(data.error || 'Failed to join coaching room')
    })

    newSocket.on('coachingTip', (tip: CoachingTip) => {
      console.log('🤖 Received coaching tip:', tip)
      setCurrentTip(tip)
      setTips(prevTips => {
        const newTips = [tip, ...prevTips].slice(0, 3)
        return newTips
      })
      
      // Auto-dismiss current tip after 45 seconds
      setTimeout(() => {
        setCurrentTip(prevCurrent => prevCurrent?.id === tip.id ? null : prevCurrent)
      }, 45000)
      
      // Remove tip from list after 2 minutes
      setTimeout(() => {
        setTips(prevTips => prevTips.filter(t => t.id !== tip.id))
      }, 120000)
    })

    newSocket.on('disconnect', () => {
      console.log('🤖 Disconnected from coaching socket')
    })

    newSocket.on('connect_error', (error) => {
      console.error('💥 Coaching socket connection error:', error)
      setError('Failed to connect to coaching service')
      onError?.('Failed to connect to coaching service')
    })

    setSocket(newSocket)

    return () => {
      if (callSid) {
        newSocket.emit('leaveCoachingRoom', callSid)
      }
      newSocket.disconnect()
    }
  }, [callSid, isCallActive])

  // Clear tips when call ends
  useEffect(() => {
    if (!isCallActive) {
      setTips([])
      setCurrentTip(null)
      setError(null)
    }
  }, [isCallActive])

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'suggestion':
        return '💡';
      case 'opportunity':
        return '🎯';
      case 'next_step':
        return '👉';
      case 'response':
        return '💬';
      default:
        return '🤖';
    }
  };

  const getTypeColor = (type: string, isMain = false) => {
    const baseColors = {
      suggestion: isMain ? 'bg-blue-500 text-white' : 'bg-blue-50 border-blue-200 text-blue-800',
      opportunity: isMain ? 'bg-green-500 text-white' : 'bg-green-50 border-green-200 text-green-800',
      next_step: isMain ? 'bg-purple-500 text-white' : 'bg-purple-50 border-purple-200 text-purple-800',
      response: isMain ? 'bg-orange-500 text-white' : 'bg-orange-50 border-orange-200 text-orange-800',
    };
    return baseColors[type as keyof typeof baseColors] || (isMain ? 'bg-gray-500 text-white' : 'bg-gray-50 border-gray-200 text-gray-800');
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-500 text-white border-red-500';
      case 'medium':
        return 'bg-yellow-500 text-white border-yellow-500';
      case 'low':
        return 'bg-gray-400 text-white border-gray-400';
      default:
        return 'bg-gray-400 text-white border-gray-400';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'suggestion':
        return 'Suggestion';
      case 'opportunity':
        return 'Opportunity';
      case 'next_step':
        return 'Next Step';
      case 'response':
        return 'Response';
      default:
        return 'Tip';
    }
  };

  const dismissCurrentTip = () => {
    setCurrentTip(null);
  };

  if (!isCallActive && tips.length === 0 && !currentTip) {
    return null;
  }

  return (
    <>
      {/* Main Current Tip - Large and Prominent */}
      {currentTip && !isMinimized && (
        <div className="fixed top-1/4 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl mx-4">
          <div className={`${getTypeColor(currentTip.type, true)} rounded-xl shadow-2xl border-2 border-white`}>
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{getTypeIcon(currentTip.type)}</span>
                  <div>
                    <h3 className="text-lg font-bold opacity-90">
                      AI Sales Coach
                    </h3>
                    <p className="text-sm opacity-75">
                      {getTypeLabel(currentTip.type)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${getPriorityBadge(currentTip.priority)}`}>
                    {currentTip.priority.toUpperCase()}
                  </span>
                  <button
                    onClick={dismissCurrentTip}
                    className="text-white hover:text-gray-200 text-xl font-bold ml-2"
                  >
                    ×
                  </button>
                </div>
              </div>
              
              <div className="mb-4">
                <p className="text-xl font-semibold leading-relaxed">
                  {currentTip.message}
                </p>
                {currentTip.context && (
                  <p className="text-sm opacity-80 mt-2">
                    {currentTip.context}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between text-sm opacity-75">
                <span>
                  {new Date(currentTip.timestamp).toLocaleTimeString()}
                </span>
                <button
                  onClick={() => setIsMinimized(true)}
                  className="underline hover:no-underline"
                >
                  Minimize
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compact Side Panel - Always Visible During Calls */}
      <div className={`fixed top-4 right-4 z-40 transition-all duration-300 ${isMinimized ? 'w-16' : 'w-96'}`}>
        <div className="bg-white rounded-lg shadow-lg border border-gray-200">
          <div className="flex items-center justify-between p-3 border-b border-gray-200">
            {!isMinimized && (
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <h3 className="text-sm font-semibold text-gray-800">AI Coach</h3>
                {currentTip && (
                  <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
                    Active
                  </span>
                )}
              </div>
            )}
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="text-gray-400 hover:text-gray-600 text-sm font-bold"
            >
              {isMinimized ? '+' : '−'}
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border-b border-red-200 text-red-600 text-sm">
              {error}
            </div>
          )}

          {!isMinimized && (
            <div className="p-3">
              <div className="text-sm text-gray-600 mb-3">
                {isCallActive ? 'Listening for conversation...' : 'Start a call to receive coaching tips'}
              </div>

              {tips.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                    Recent Tips ({tips.length})
                  </h4>
                  {tips.map((tip, index) => (
                    <div key={tip.id} className={`${getTypeColor(tip.type)} rounded-lg p-2 text-xs`}>
                      <div className="flex items-start justify-between mb-1">
                        <span className="font-medium">{getTypeLabel(tip.type)}</span>
                        <span className={`px-1 py-0.5 rounded text-xs font-bold ${getPriorityBadge(tip.priority)}`}>
                          {tip.priority}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed">{tip.message}</p>
                      <div className="text-xs opacity-75 mt-1">
                        {new Date(tip.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tips.length === 0 && isCallActive && (
                <div className="text-center py-4">
                  <div className="text-2xl mb-2">🤖</div>
                  <p className="text-xs text-gray-500">
                    Waiting for conversation to provide coaching tips...
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
} 