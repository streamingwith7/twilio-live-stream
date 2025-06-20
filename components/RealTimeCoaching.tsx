'use client'

import { useEffect, useState } from 'react'
import { Socket } from 'socket.io-client'

interface CoachingTip {
  id: string;
  type: 'suggestion' | 'warning' | 'opportunity' | 'next_step';
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
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!socket) return;

    const handleCoachingTip = (tip: CoachingTip) => {
      console.log('🤖 Received coaching tip:', tip);
      
      setTips(prevTips => {
        // Add new tip and keep only last 5 tips
        const newTips = [tip, ...prevTips].slice(0, 5);
        return newTips;
      });

      // Auto-remove tip after 30 seconds
      setTimeout(() => {
        setTips(prevTips => prevTips.filter(t => t.id !== tip.id));
      }, 30000);
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
    }
  }, [isCallActive]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'suggestion':
        return '💡';
      case 'warning':
        return '⚠️';
      case 'opportunity':
        return '🎯';
      case 'next_step':
        return '👉';
      default:
        return '🤖';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'suggestion':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'warning':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'opportunity':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'next_step':
        return 'bg-purple-50 border-purple-200 text-purple-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-gray-100 text-gray-600 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  if (!isCallActive && tips.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 w-80 z-50">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200">
        <div className="flex items-center justify-between p-3 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <h3 className="text-sm font-semibold text-gray-800">AI Sales Coach</h3>
          </div>
          <button
            onClick={() => setIsVisible(!isVisible)}
            className="text-gray-400 hover:text-gray-600 text-sm"
          >
            {isVisible ? '−' : '+'}
          </button>
        </div>

        {isVisible && (
          <div className="max-h-96 overflow-y-auto">
            {tips.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                {isCallActive ? 'Listening for conversation...' : 'Start a call to receive coaching tips'}
              </div>
            ) : (
              <div className="space-y-2 p-3">
                {tips.map((tip) => (
                  <div
                    key={tip.id}
                    className={`p-3 rounded-lg border transition-all duration-300 ${getTypeColor(tip.type)} animate-fade-in`}
                  >
                    <div className="flex items-start space-x-2">
                      <span className="text-sm">{getTypeIcon(tip.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium capitalize">
                            {tip.type.replace('_', ' ')}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityBadge(tip.priority)}`}>
                            {tip.priority}
                          </span>
                        </div>
                        <p className="text-sm font-medium leading-relaxed">
                          {tip.message}
                        </p>
                        {tip.context && (
                          <p className="text-xs opacity-75 mt-1">
                            {tip.context}
                          </p>
                        )}
                        <p className="text-xs opacity-50 mt-1">
                          {new Date(tip.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
} 