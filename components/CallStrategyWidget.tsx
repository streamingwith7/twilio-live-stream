'use client'

import { useState, useEffect } from 'react'
import { io, Socket } from 'socket.io-client'

interface ClientRequirement {
  id: string;
  requirement: string;
  confidence: number;
  category: 'product' | 'pricing' | 'timeline' | 'features' | 'support' | 'integration' | 'other';
  timestamp: string;
  source: string;
}

interface CallStrategy {
  id: string;
  callSid: string;
  overallObjective: string;
  keyRequirements: ClientRequirement[];
  recommendedApproach: string;
  focusAreas: string[];
  riskFactors: string[];
  opportunities: string[];
  nextSteps: string[];
  confidence: number;
  lastUpdated: string;
  version: number;
}

interface CallStrategyWidgetProps {
  callSid?: string;
  isCallActive: boolean;
  onError?: (error: string) => void;
}

export default function CallStrategyWidget({ 
  callSid, 
  isCallActive, 
  onError 
}: CallStrategyWidgetProps) {
  const [strategy, setStrategy] = useState<CallStrategy | null>(null);
  const [requirements, setRequirements] = useState<ClientRequirement[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    console.log('callSid --------------> ', callSid);
  }, [callSid])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token || !isCallActive) return
    
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
        newSocket.emit('joinStrategyRoom', callSid)
      }
    })

    newSocket.on('strategyRoomJoined', () => {})
    newSocket.on('newClientRequirements', (data) => {
      setRequirements(prev => [...data.requirements, ...prev])
    })
    newSocket.on('callStrategyUpdate', (data) => {
      setStrategy(data.strategy)
      setIsLoading(false)
    })
    newSocket.on('strategyError', (data) => {
      setError(data.error || 'Call strategy service error')
      onError?.(data.error || 'Call strategy service error')
      setIsLoading(false)
    })
    setSocket(newSocket)
    return () => {
      if (callSid) {
        newSocket.emit('leaveStrategyRoom', callSid)
      }
      newSocket.disconnect()
    }
  }, [callSid, isCallActive])

  useEffect(() => {
    if (!isCallActive) {
      setStrategy(null)
      setRequirements([])
      setError(null)
      setIsLoading(false)
    }
  }, [isCallActive])

  const getCategoryColor = (category: string) => {
    const colors = {
      product: 'bg-blue-100 text-blue-800',
      pricing: 'bg-green-100 text-green-800',
      timeline: 'bg-purple-100 text-purple-800',
      features: 'bg-orange-100 text-orange-800',
      support: 'bg-red-100 text-red-800',
      integration: 'bg-indigo-100 text-indigo-800',
      other: 'bg-gray-100 text-gray-800'
    };
    return colors[category as keyof typeof colors] || colors.other;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (!isCallActive && !strategy && requirements.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <h3 className="text-lg font-semibold text-gray-800">Call Strategy</h3>
          {strategy && (
            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
              v{strategy.version}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded"
        >
          {showDetails ? '📋 Details' : '📊 Summary'}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="p-3 bg-red-50 border-b border-red-200 text-red-600 text-xs mb-4">
            {error}
          </div>
        )}
        {isLoading && (
          <div className="text-center py-4">
            <div className="text-2xl mb-2">🎯</div>
            <p className="text-xs text-gray-500">Analyzing client requirements...</p>
          </div>
        )}
        {strategy && (
          <div className="space-y-3">
            <div className="bg-blue-50 rounded-lg p-3">
              <h4 className="text-xs font-medium text-blue-800 uppercase tracking-wide mb-2">
                🎯 Objective
              </h4>
              <p className="text-sm text-blue-900 leading-relaxed">
                {strategy.overallObjective}
              </p>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <h4 className="text-xs font-medium text-green-800 uppercase tracking-wide mb-2">
                📋 Approach
              </h4>
              <p className="text-sm text-green-900 leading-relaxed">
                {strategy.recommendedApproach}
              </p>
            </div>
            {showDetails && (
              <>
                {strategy.focusAreas.length > 0 && (
                  <div className="bg-yellow-50 rounded-lg p-3">
                    <h4 className="text-xs font-medium text-yellow-800 uppercase tracking-wide mb-2">
                      🎯 Focus Areas
                    </h4>
                    <ul className="text-sm text-yellow-900 space-y-1">
                      {strategy.focusAreas.map((area, i) => (
                        <li key={i} className="flex items-start">
                          <span className="mr-2">•</span>
                          <span>{area}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {strategy.riskFactors.length > 0 && (
                  <div className="bg-red-50 rounded-lg p-3">
                    <h4 className="text-xs font-medium text-red-800 uppercase tracking-wide mb-2">
                      ⚠️ Risk Factors
                    </h4>
                    <ul className="text-sm text-red-900 space-y-1">
                      {strategy.riskFactors.map((risk, i) => (
                        <li key={i} className="flex items-start">
                          <span className="mr-2">•</span>
                          <span>{risk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {strategy.opportunities.length > 0 && (
                  <div className="bg-emerald-50 rounded-lg p-3">
                    <h4 className="text-xs font-medium text-emerald-800 uppercase tracking-wide mb-2">
                      💡 Opportunities
                    </h4>
                    <ul className="text-sm text-emerald-900 space-y-1">
                      {strategy.opportunities.map((opp, i) => (
                        <li key={i} className="flex items-start">
                          <span className="mr-2">•</span>
                          <span>{opp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {strategy.nextSteps.length > 0 && (
                  <div className="bg-purple-50 rounded-lg p-3">
                    <h4 className="text-xs font-medium text-purple-800 uppercase tracking-wide mb-2">
                      👉 Next Steps
                    </h4>
                    <ul className="text-sm text-purple-900 space-y-1">
                      {strategy.nextSteps.map((step, i) => (
                        <li key={i} className="flex items-start">
                          <span className="mr-2">•</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
            {requirements.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3">
                <h4 className="text-xs font-medium text-gray-800 uppercase tracking-wide mb-2">
                  📝 Client Requirements ({requirements.length})
                </h4>
                <div className="space-y-2">
                  {requirements.slice(0, 3).map((req) => (
                    <div key={req.id} className="bg-white rounded p-2 border border-gray-200">
                      <div className="flex items-start justify-between mb-1">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(req.category)}`}>
                          {req.category}
                        </span>
                        <span className={`text-xs font-medium ${getConfidenceColor(req.confidence)}`}>
                          {Math.round(req.confidence * 100)}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-700 leading-relaxed">
                        {req.requirement}
                      </p>
                      <p className="text-xs text-gray-500 mt-1 italic">
                        "{req.source}"
                      </p>
                    </div>
                  ))}
                  {requirements.length > 3 && (
                    <p className="text-xs text-gray-500 text-center">
                      +{requirements.length - 3} more requirements
                    </p>
                  )}
                </div>
              </div>
            )}
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">Strategy Confidence</div>
              <div className={`text-lg font-bold ${getConfidenceColor(strategy.confidence)}`}>
                {Math.round(strategy.confidence * 100)}%
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Updated: {new Date(strategy.lastUpdated).toLocaleTimeString()}
              </div>
            </div>
          </div>
        )}
        {!strategy && !isLoading && isCallActive && (
          <div className="text-center py-4">
            <div className="text-2xl mb-2">🎯</div>
            <p className="text-xs text-gray-500 mb-2">
              Analyzing client requirements to build call strategy...
            </p>
            {requirements.length > 0 && (
              <p className="text-xs text-gray-400">
                Found {requirements.length} requirements so far
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
} 