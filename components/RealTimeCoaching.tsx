'use client'

import { useState, useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

interface CoachingTip {
  id: string;
  tip: string;
  suggestedScript?: string;
  urgency: 'low' | 'medium' | 'high';
  reasoning: string;
  callSid: string;
  timestamp: string;
  conversationStage: string;
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

interface SimpleRealTimeCoachingProps {
  callSid?: string;
  isCallActive: boolean;
  onError?: (error: string) => void;
}

export default function SimpleRealTimeCoaching({
  callSid,
  isCallActive,
  onError
}: SimpleRealTimeCoachingProps) {
  const [tips, setTips] = useState<CoachingTip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [analytics, setAnalytics] = useState<CallAnalytics | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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

    newSocket.on('enhancedCoachingTip', (tip: CoachingTip) => {
      console.log('🤖 Received coaching tip:', tip)

      setTips(prevTips => {
        const newTips = [...prevTips, tip];
        return newTips;
      });
      setPosition({ x: 0, y: 0 });

      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 100);
    })

    newSocket.on('analyticsUpdate', (data) => {
      console.log('🤖 Received analytics update:', data)
      setAnalytics(data.analytics);
    })

    newSocket.on('coachingError', (data) => {
      console.error('🤖 Coaching error:', data)
      setError(data.error || 'Coaching service error')
      onError?.(data.error || 'Coaching service error')
    })

    setSocket(newSocket)

    return () => {
      if (callSid) {
        newSocket.emit('leaveCoachingRoom', callSid)
      }
      newSocket.disconnect()
    }
  }, [callSid, isCallActive])

  useEffect(() => {
    if (!isCallActive) {
      setTips([])
      setError(null)
      setAnalytics(null)
      setPosition({ x: 0, y: 0 });
    }
  }, [isCallActive])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!modalRef.current) return;

    setIsDragging(true);
    const rect = modalRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;

    const maxX = window.innerWidth - 600;
    const maxY = window.innerHeight - 300;

    setPosition({
      x: Math.max(-300, Math.min(maxX - 300, newX - window.innerWidth / 2)),
      y: Math.max(-150, Math.min(maxY - 150, newY - window.innerHeight / 4))
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, dragOffset]);

  const getUrgencyIcon = (urgency: string) => {
    switch (urgency) {
      case 'high': return '🚨';
      case 'medium': return '⚠️';
      case 'low': return '💡';
      default: return '🤖';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high': return 'border-red-500 bg-red-900';
      case 'medium': return 'border-orange-500 bg-orange-900';
      case 'low': return 'border-blue-500 bg-blue-900';
      default: return 'border-slate-500 bg-slate-900';
    }
  };

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'opening': return '👋';
      case 'discovery': return '🔍';
      case 'presentation': return '📋';
      case 'objection': return '⚠️';
      case 'closing': return '🤝';
      default: return '💬';
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return '😊';
      case 'negative': return '😞';
      case 'neutral': return '😐';
      default: return '🤔';
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'text-green-400';
      case 'negative': return 'text-red-400';
      case 'neutral': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  if (!isCallActive && tips.length === 0) {
    return null;
  }

  return (
    <>
      {(tips.length > 0 || analytics) && (
        <div
          ref={modalRef}
          className="fixed z-50 w-full max-w-2xl mx-4"
          style={{
            top: `calc(25% + ${position.y}px)`,
            left: `calc(50% + ${position.x}px)`,
            transform: 'translate(-50%, -50%)',
            cursor: isDragging ? 'grabbing' : 'grab'
          }}
        >
          <div
            className="flex items-center justify-between px-3 py-2 bg-slate-800 text-white border border-slate-700 rounded-t-lg cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
          >
            <div className="flex items-center space-x-2">
              <span className="text-lg">🤖</span>
              <span className="text-sm font-medium opacity-90">AI Coach</span>
              {tips.length > 1 && (
                <span className="text-xs bg-blue-600 px-2 py-1 rounded-full">
                  {tips.length} tips
                </span>
              )}
            </div>
            <button
              onClick={() => setTips([])}
              className="text-white hover:text-gray-300 text-lg font-bold opacity-75 hover:opacity-100"
              onMouseDown={(e) => e.stopPropagation()}
            >
              ×
            </button>
          </div>

          {analytics && (
            <div className="bg-slate-700 border-x border-slate-600 px-4 py-3">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="flex items-center space-x-2">
                  <span className="text-slate-300">Stage:</span>
                  <span className="flex items-center space-x-1">
                    <span>{getStageIcon(analytics.conversationStage)}</span>
                    <span className="font-medium capitalize">{analytics.conversationStage}</span>
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-slate-300">Sentiment:</span>
                  <span className={`flex items-center space-x-1 ${getSentimentColor(analytics.customerSentiment)}`}>
                    <span>{getSentimentIcon(analytics.customerSentiment)}</span>
                    <span className="font-medium capitalize">{analytics.customerSentiment}</span>
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-slate-300">Agent:</span>
                  <span className="text-blue-400 font-medium">{Math.round(analytics.talkRatio.agent)}%</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-slate-300">Customer:</span>
                  <span className="text-green-400 font-medium">{Math.round(analytics.talkRatio.customer)}%</span>
                </div>
              </div>

            </div>
          )}

          <div
            ref={scrollRef}
            className="h-[300px] overflow-y-auto bg-slate-800 text-white border-x border-b border-slate-700 rounded-b-lg"
            style={{ scrollBehavior: 'smooth' }}
          >
            {tips.map((tip, index) => (
              <div key={tip.id} className={`${index > 0 ? 'border-t border-slate-600' : ''}`}>
                <div className="flex">

                  {tip.suggestedScript && (
                    <div className="flex-1 p-4 border-r border-slate-600">
                      <div className="text-xs font-semibold text-green-400 mb-2 uppercase tracking-wide flex items-center">
                        <span className="mr-1">{getUrgencyIcon(tip.urgency)}</span>
                        💬 Say This
                      </div>
                      <div className="text-lg font-xs leading-relaxed text-green-100 whitespace-pre-line">
                        "{tip.suggestedScript}"
                      </div>
                    </div>
                  )}

                  <div className={`${tip.suggestedScript ? 'w-80' : 'flex-1'} p-4`}>
                    <div className="text-xs font-semibold text-blue-400 mb-2 uppercase tracking-wide flex items-center">
                      {!tip.suggestedScript && <span className="mr-1">{getUrgencyIcon(tip.urgency)}</span>}
                      💡 Action
                    </div>
                    <div className="text-sm font-xs leading-relaxed text-blue-100 whitespace-pre-line">
                      {tip.tip}
                    </div>
                  </div>

                </div>

                <div className={`h-1 ${getUrgencyColor(tip.urgency)}`}></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          <div className="flex items-center space-x-2">
            <span>❌</span>
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-2 text-white hover:text-gray-200"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  )
}