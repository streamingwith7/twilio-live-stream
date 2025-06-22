'use client'

import { useEffect, useState } from 'react'
import { Socket } from 'socket.io-client'

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
  socket: Socket | null;
  isCallActive: boolean;
}

export default function RealTimeCoaching({ socket, isCallActive }: RealTimeCoachingProps) {
  const [tips, setTips] = useState<CoachingTip[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [currentTip, setCurrentTip] = useState<CoachingTip | null>(null);

  useEffect(() => {
    if (!socket) return;

    const handleCoachingTip = (tip: CoachingTip) => {
      console.log('🤖 Received coaching tip:', tip);
      
      // Set as current tip for prominent display
      setCurrentTip(tip);
      
      // Add to history and keep only last 3 tips
      setTips(prevTips => {
        const newTips = [tip, ...prevTips].slice(0, 3);
        return newTips;
      });

      // Auto-remove current tip after 45 seconds
      setTimeout(() => {
        setCurrentTip(prevCurrent => prevCurrent?.id === tip.id ? null : prevCurrent);
      }, 45000);

      // Remove from history after 2 minutes
      setTimeout(() => {
        setTips(prevTips => prevTips.filter(t => t.id !== tip.id));
      }, 120000);
    };

    socket.on('coachingTip', handleCoachingTip);

    return () => {
      socket.off('coachingTip', handleCoachingTip);
    };
  }, [socket]);

  // Clear tips when call ends
  useEffect(() => {
    if (!isCallActive) {
      setTips([]);
      setCurrentTip(null);
    }
  }, [isCallActive]);

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

          {!isMinimized && (
            <div className="max-h-80 overflow-y-auto">
              {tips.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  {isCallActive ? 'Listening for conversation...' : 'Start a call to receive coaching tips'}
                </div>
              ) : (
                <div className="space-y-2 p-3">
                  <div className="text-xs text-gray-500 font-medium mb-2">Recent Tips:</div>
                  {tips.map((tip, index) => (
                    <div
                      key={tip.id}
                      className={`p-3 rounded-lg border transition-all duration-300 ${getTypeColor(tip.type)} ${
                        tip.id === currentTip?.id ? 'ring-2 ring-blue-400' : ''
                      } ${index > 0 ? 'opacity-75' : ''}`}
                    >
                      <div className="flex items-start space-x-2">
                        <span className="text-sm">{getTypeIcon(tip.type)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium">
                              {getTypeLabel(tip.type)}
                            </span>
                            <span className="text-xs opacity-50">
                              {new Date(tip.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-sm font-medium leading-relaxed">
                            {tip.message}
                          </p>
                          {tip.id === currentTip?.id && (
                            <button
                              onClick={() => setCurrentTip(tip)}
                              className="text-xs underline mt-1 hover:no-underline"
                            >
                              View Full
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translate(-50%, -60%);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%);
          }
        }
        .animate-slide-in {
          animation: slideIn 0.5s ease-out;
        }
      `}</style>
    </>
  );
} 