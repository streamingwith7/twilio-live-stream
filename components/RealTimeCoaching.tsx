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

interface CallAnalytics {
  conversationStage: 'opening' | 'discovery' | 'presentation' | 'objection' | 'closing';
  customerSentiment: 'positive' | 'negative' | 'neutral';
  agentPerformance: number;
  talkRatio: { agent: number; customer: number };
  keyMoments: string[];
  detectedIntents: string[];
  riskFactors: string[];
  opportunities: string[];
}

interface CallInsights {
  duration: number;
  totalTurns: number;
  analytics: CallAnalytics;
  tipCount: number;
  keyInsights: string[];
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
  const [tips, setTips] = useState<EnhancedCoachingTip[]>([]);
  const [analytics, setAnalytics] = useState<CallAnalytics | null>(null);
  const [insights, setInsights] = useState<CallInsights | null>(null);
  const [currentTip, setCurrentTip] = useState<EnhancedCoachingTip | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [coachingStats, setCoachingStats] = useState({
    totalTips: 0,
    highPriorityTips: 0,
    avgRelevanceScore: 0
  });

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

    // Handle enhanced coaching tips
    newSocket.on('enhancedCoachingTip', (tip: EnhancedCoachingTip) => {
      console.log('🤖 Received enhanced coaching tip:', tip)
      
      setCurrentTip(tip)
      setTips(prevTips => {
        const newTips = [tip, ...prevTips].slice(0, 5) // Keep last 5 tips
        return newTips
      })

      // Update stats
      setCoachingStats(prev => ({
        totalTips: prev.totalTips + 1,
        highPriorityTips: tip.priority === 'high' || tip.priority === 'urgent' 
          ? prev.highPriorityTips + 1 
          : prev.highPriorityTips,
        avgRelevanceScore: ((prev.avgRelevanceScore * prev.totalTips) + tip.relevanceScore) / (prev.totalTips + 1)
      }))
      
      // Auto-dismiss based on priority
      const dismissTime = tip.priority === 'urgent' ? 60000 : tip.priority === 'high' ? 45000 : 30000;
      setTimeout(() => {
        setCurrentTip(prevCurrent => prevCurrent?.id === tip.id ? null : prevCurrent)
      }, dismissTime)
    })

    // Handle analytics updates
    newSocket.on('analyticsUpdate', (data) => {
      console.log('📊 Analytics update:', data.analytics)
      setAnalytics(data.analytics)
    })

    // Handle call insights
    newSocket.on('callInsights', (data) => {
      console.log('💡 Call insights:', data.summary)
      setInsights(data.summary)
    })

    // Handle final summary
    newSocket.on('finalCoachingSummary', (data) => {
      console.log('📋 Final coaching summary:', data.summary)
      setInsights(data.summary)
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
      setTips([])
      setCurrentTip(null)
      setAnalytics(null)
      setInsights(null)
      setError(null)
      setCoachingStats({ totalTips: 0, highPriorityTips: 0, avgRelevanceScore: 0 })
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

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'text-green-600';
      case 'negative': return 'text-red-600';
      case 'neutral': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'opening': return 'bg-blue-100 text-blue-800';
      case 'discovery': return 'bg-purple-100 text-purple-800';
      case 'presentation': return 'bg-green-100 text-green-800';
      case 'objection': return 'bg-orange-100 text-orange-800';
      case 'closing': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!isCallActive && tips.length === 0 && !currentTip) {
    return null;
  }

  return (
    <>
      {/* Main Current Tip - Enhanced with more details */}
      {currentTip && !isMinimized && (
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
                      <span className={`px-2 py-1 rounded-full text-xs ${getStageColor(currentTip.conversationStage)}`}>
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

      {/* Enhanced Side Panel */}
      <div className={`fixed top-4 right-4 z-40 transition-all duration-300 ${isMinimized ? 'w-16' : 'w-96'}`}>
        <div className="bg-white rounded-lg shadow-lg border border-gray-200">
          <div className="flex items-center justify-between p-3 border-b border-gray-200">
            {!isMinimized && (
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <h3 className="text-sm font-semibold text-gray-800">Enhanced AI Coach</h3>
                {currentTip && (
                  <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
                    Active
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center space-x-1">
              {!isMinimized && (
                <button
                  onClick={() => setShowAnalytics(!showAnalytics)}
                  className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded"
                >
                  📊
                </button>
              )}
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                {isMinimized ? '+' : '−'}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border-b border-red-200 text-red-600 text-xs">
              {error}
            </div>
          )}

          {!isMinimized && (
            <div className="p-3 max-h-96 overflow-y-auto">
              {/* Analytics Section */}
              {showAnalytics && analytics && (
                <div className="mb-4 pb-3 border-b border-gray-100">
                  <h4 className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">
                    Live Analytics
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span>Stage:</span>
                      <span className={`px-2 py-1 rounded-full ${getStageColor(analytics.conversationStage)}`}>
                        {analytics.conversationStage}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Customer Sentiment:</span>
                      <span className={`font-medium ${getSentimentColor(analytics.customerSentiment)}`}>
                        {analytics.customerSentiment}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Talk Ratio:</span>
                      <span className="text-gray-600">
                        Agent {analytics.talkRatio.agent.toFixed(0)}% | Customer {analytics.talkRatio.customer.toFixed(0)}%
                      </span>
                    </div>
                    {analytics.riskFactors.length > 0 && (
                      <div>
                        <span className="text-red-600 font-medium">⚠️ Risks:</span>
                        <div className="mt-1 space-y-1">
                          {analytics.riskFactors.slice(0, 2).map((risk, i) => (
                            <div key={i} className="text-red-600 text-xs pl-2">• {risk}</div>
                          ))}
                        </div>
                      </div>
                    )}
                    {analytics.opportunities.length > 0 && (
                      <div>
                        <span className="text-green-600 font-medium">🎯 Opportunities:</span>
                        <div className="mt-1 space-y-1">
                          {analytics.opportunities.slice(0, 2).map((opp, i) => (
                            <div key={i} className="text-green-600 text-xs pl-2">• {opp}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Coaching Stats */}
              <div className="mb-3 pb-3 border-b border-gray-100">
                <h4 className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">
                  Coaching Stats
                </h4>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center">
                    <div className="font-bold text-lg text-blue-600">{coachingStats.totalTips}</div>
                    <div className="text-gray-500">Tips</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-lg text-red-600">{coachingStats.highPriorityTips}</div>
                    <div className="text-gray-500">High Priority</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-lg text-green-600">{coachingStats.avgRelevanceScore.toFixed(0)}%</div>
                    <div className="text-gray-500">Avg Score</div>
                  </div>
                </div>
              </div>

              {/* Recent Tips */}
              {tips.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                    Recent Tips ({tips.length})
                  </h4>
                  {tips.map((tip) => (
                    <div key={tip.id} className={`${getTypeColor(tip.type, tip.priority)} rounded-lg p-2 text-xs border`}>
                      <div className="flex items-start justify-between mb-1">
                        <span className="font-medium capitalize">{tip.type.replace('_', ' ')}</span>
                        <div className="flex items-center space-x-1">
                          <span className={`px-1 py-0.5 rounded text-xs font-bold ${getPriorityBadge(tip.priority)}`}>
                            {tip.priority}
                          </span>
                          <span className="text-xs opacity-60">{tip.relevanceScore}%</span>
                        </div>
                      </div>
                      <p className="text-xs leading-relaxed mb-1">{tip.message}</p>
                      {tip.suggestedResponse && (
                        <p className="text-xs italic opacity-75 bg-black bg-opacity-10 p-1 rounded">
                          💬 "{tip.suggestedResponse}"
                        </p>
                      )}
                      <div className="text-xs opacity-60 mt-1">
                        {new Date(tip.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Status Message */}
              {tips.length === 0 && isCallActive && (
                <div className="text-center py-4">
                  <div className="text-2xl mb-2">🤖</div>
                  <p className="text-xs text-gray-500 mb-2">
                    Enhanced AI coaching is analyzing your conversation...
                  </p>
                  {analytics && (
                    <p className="text-xs text-gray-400">
                      Stage: {analytics.conversationStage} • Sentiment: {analytics.customerSentiment}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}