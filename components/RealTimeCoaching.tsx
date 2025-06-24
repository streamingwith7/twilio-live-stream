'use client'

import { useState, useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

// Actual coaching tip interface that matches what the backend sends
interface CoachingTip {
  id: string;
  tip: string;
  urgency: 'low' | 'medium' | 'high';
  reasoning: string;
  callSid: string;
  timestamp: string;
  conversationStage: string;
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
  const [currentTip, setCurrentTip] = useState<CoachingTip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  
  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

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

    newSocket.on('enhancedCoachingTip', (tip: CoachingTip) => {
      console.log('🤖 Received coaching tip:', tip)
      
      setCurrentTip(tip)
      // Reset position when new tip arrives
      setPosition({ x: 0, y: 0 });
      
      const dismissTime = tip.urgency === 'high' ? 45000 : tip.urgency === 'medium' ? 40000 : 30000;
      setTimeout(() => {
        setCurrentTip(prevCurrent => prevCurrent?.id === tip.id ? null : prevCurrent)
      }, dismissTime)
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

  // Clear state when call ends
  useEffect(() => {
    if (!isCallActive) {
      setCurrentTip(null)
      setError(null)
      setPosition({ x: 0, y: 0 });
    }
  }, [isCallActive])

  // Drag functionality
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
    
    // Constrain to viewport
    const maxX = window.innerWidth - 500; // Approximate modal width
    const maxY = window.innerHeight - 300; // Approximate modal height
    
    setPosition({
      x: Math.max(-250, Math.min(maxX - 250, newX - window.innerWidth / 2)),
      y: Math.max(-150, Math.min(maxY - 150, newY - window.innerHeight / 4))
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Add event listeners for drag
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

  const getUrgencyColor = (urgency: string, isMain = false) => {
    switch (urgency) {
      case 'high': 
        return isMain ? 'bg-red-600 text-white border-red-700' : 'bg-red-50 border-red-200 text-red-800';
      case 'medium': 
        return isMain ? 'bg-orange-500 text-white border-orange-600' : 'bg-orange-50 border-orange-200 text-orange-800';
      case 'low': 
        return isMain ? 'bg-blue-500 text-white border-blue-600' : 'bg-blue-50 border-blue-200 text-blue-800';
      default: 
        return isMain ? 'bg-gray-500 text-white border-gray-600' : 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'high': return 'bg-red-600 text-white border-red-600 animate-pulse';
      case 'medium': return 'bg-orange-500 text-white border-orange-500';
      case 'low': return 'bg-blue-400 text-white border-blue-400';
      default: return 'bg-gray-400 text-white border-gray-400';
    }
  };

  if (!isCallActive && !currentTip) {
    return null;
  }

  return (
    <>
      {/* Main Current Tip - Draggable and Minimal */}
      {currentTip && (
        <div 
          ref={modalRef}
          className="fixed z-50 w-full max-w-md mx-4"
          style={{
            top: `calc(25% + ${position.y}px)`,
            left: `calc(50% + ${position.x}px)`,
            transform: 'translate(-50%, -50%)',
            cursor: isDragging ? 'grabbing' : 'grab'
          }}
        >
          <div className={`${getUrgencyColor(currentTip.urgency, true)} rounded-lg shadow-xl border transition-shadow ${isDragging ? 'shadow-2xl' : ''}`}>
            {/* Minimal Drag Handle */}
            <div 
              className="flex items-center justify-between px-3 py-2 cursor-grab active:cursor-grabbing"
              onMouseDown={handleMouseDown}
            >
              <div className="flex items-center space-x-2">
                <span className="text-lg">{getUrgencyIcon(currentTip.urgency)}</span>
                <span className="text-sm font-medium opacity-90">AI Coach</span>
              </div>
              <button
                onClick={() => setCurrentTip(null)}
                className="text-white hover:text-gray-200 text-lg font-bold opacity-75 hover:opacity-100"
                onMouseDown={(e) => e.stopPropagation()}
              >
                ×
              </button>
            </div>

            {/* Just the tip text */}
            <div className="px-4 pb-4">
              <p className="text-base font-medium leading-relaxed">
                {currentTip.tip}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error display */}
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