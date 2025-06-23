'use client'

import { useState, useEffect } from 'react'
import { io, Socket } from 'socket.io-client'

interface EnhancedCoachingTip {
  id: string;
  type: 'suggestion' | 'opportunity' | 'next_step' | 'response' | 'warning' | 'strategy';
  category: 'rapport' | 'discovery' | 'presentation' | 'objection_handling' | 'closing' | 'general';
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  relevanceScore: number;
  timestamp: string;
  context: string;
  callSid: string;
  conversationStage: string;
  suggestedResponse?: string;
  reasoning: string;
  expectedOutcome?: string;
}

interface EnhancedRealTimeCoachingProps {
  callSid?: string;
  isCallActive: boolean;
  onError?: (error: string) => void;
}

export default function EnhancedRealTimeCoaching({ 
  callSid, 
  isCallActive, 
  onError 
}: EnhancedRealTimeCoachingProps) {
  const [currentTip, setCurrentTip] = useState<EnhancedCoachingTip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Initialize socket connection
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token || !isCallActive) return
    
    console.log('🤖 Initializing enhanced coaching socket for callSid:', callSid);
    
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
        console.log('🤖 Connected to enhanced coaching socket', callSid)
        newSocket.emit('joinCoachingRoom', callSid)
      }
    })

    newSocket.on('coachingRoomJoined', (data) => {
      console.log('🤖 Joined enhanced coaching room:', data)
    })

    newSocket.on('enhancedCoachingTip', (tip: EnhancedCoachingTip) => {
      console.log('🤖 Received enhanced coaching tip:', tip)
      
      setCurrentTip(tip)
      
      const dismissTime = tip.priority === 'urgent' ? 60000 : tip.priority === 'high' ? 45000 : 30000;
      setTimeout(() => {
        setCurrentTip(prevCurrent => prevCurrent?.id === tip.id ? null : prevCurrent)
      }, dismissTime)
    })

    newSocket.on('coachingError', (data) => {
      console.error('🤖 Enhanced coaching error:', data)
      setError(data.error || 'Enhanced coaching service error')
      onError?.(data.error || 'Enhanced coaching service error')
    })

    setSocket(newSocket)

    return () => {
      if (callSid) {
        newSocket.emit('leaveCoachingRoom', callSid)
      }
      newSocket.disconnect()
    }
  }, [callSid, isCallActive])

  // Clear state when call ends
  useEffect(() => {
    if (!isCallActive) {
      setCurrentTip(null)
      setError(null)
    }
  }, [isCallActive])

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'suggestion': return '💡';
      case 'opportunity': return '🎯';
      case 'next_step': return '👉';
      case 'response': return '💬';
      case 'warning': return '⚠️';
      case 'strategy': return '🎭';
      default: return '🤖';
    }
  };

  const getTypeColor = (type: string, priority: string, isMain = false) => {
    if (priority === 'urgent') {
      return isMain ? 'bg-red-600 text-white border-red-700' : 'bg-red-50 border-red-200 text-red-800';
    }
    
    const baseColors = {
      suggestion: isMain ? 'bg-blue-500 text-white' : 'bg-blue-50 border-blue-200 text-blue-800',
      opportunity: isMain ? 'bg-green-500 text-white' : 'bg-green-50 border-green-200 text-green-800',
      next_step: isMain ? 'bg-purple-500 text-white' : 'bg-purple-50 border-purple-200 text-purple-800',
      response: isMain ? 'bg-orange-500 text-white' : 'bg-orange-50 border-orange-200 text-orange-800',
      warning: isMain ? 'bg-red-500 text-white' : 'bg-red-50 border-red-200 text-red-800',
      strategy: isMain ? 'bg-indigo-500 text-white' : 'bg-indigo-50 border-indigo-200 text-indigo-800',
    };
    return baseColors[type as keyof typeof baseColors] || (isMain ? 'bg-gray-500 text-white' : 'bg-gray-50 border-gray-200 text-gray-800');
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-600 text-white border-red-600 animate-pulse';
      case 'high': return 'bg-red-500 text-white border-red-500';
      case 'medium': return 'bg-yellow-500 text-white border-yellow-500';
      case 'low': return 'bg-gray-400 text-white border-gray-400';
      default: return 'bg-gray-400 text-white border-gray-400';
    }
  };

  if (!isCallActive && !currentTip) {
    return null;
  }

  return (
    <>
      {/* Main Current Tip - Enhanced with more details */}
      {currentTip && (
        <div className="fixed top-1/4 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-3xl mx-4">
          <div className={`${getTypeColor(currentTip.type, currentTip.priority, true)} rounded-xl shadow-2xl border-2 border-white`}>
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{getTypeIcon(currentTip.type)}</span>
                  <div>
                    <h3 className="text-lg font-bold opacity-90">
                      AI Sales Coach
                    </h3>
                    <div className="flex items-center space-x-2">
                      <p className="text-sm opacity-75 capitalize">
                        {currentTip.type.replace('_', ' ')}
                      </p>
                      <span className="px-2 py-1 rounded-full text-xs bg-white bg-opacity-20">
                        {currentTip.conversationStage}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${getPriorityBadge(currentTip.priority)}`}>
                    {currentTip.priority.toUpperCase()}
                  </span>
                  <div className="text-xs opacity-75">
                    Score: {currentTip.relevanceScore}%
                  </div>
                  <button
                    onClick={() => setCurrentTip(null)}
                    className="text-white hover:text-gray-200 text-xl font-bold ml-2"
                  >
                    ×
                  </button>
                </div>
              </div>
              
              <div className="mb-4">
                <p className="text-xl font-semibold leading-relaxed mb-3">
                  {currentTip.message}
                </p>
                
                {currentTip.suggestedResponse && (
                  <div className="bg-black bg-opacity-20 rounded-lg p-3 mb-3">
                    <p className="text-sm font-medium opacity-90 mb-1">💬 Suggested Response:</p>
                    <p className="text-sm opacity-80 italic">"{currentTip.suggestedResponse}"</p>
                  </div>
                )}

                <div className="text-sm opacity-80">
                  <p className="mb-1"><strong>Why:</strong> {currentTip.reasoning}</p>
                  {currentTip.expectedOutcome && (
                    <p><strong>Expected Outcome:</strong> {currentTip.expectedOutcome}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-sm opacity-75">
                <span>
                  {new Date(currentTip.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}