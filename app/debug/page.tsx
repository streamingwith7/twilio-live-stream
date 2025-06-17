'use client'

import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'

export default function DebugPage() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [events, setEvents] = useState<any[]>([])
  const [clientsCount, setClientsCount] = useState(0)

  useEffect(() => {
    const token = localStorage.getItem('token')
    
    if (!token) {
      console.error('No token found')
      return
    }

    console.log('🔌 Connecting to Socket.IO server...')
    
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
      console.log('✅ Connected to Socket.IO server:', newSocket.id)
      setIsConnected(true)
      addEvent('Connected', { socketId: newSocket.id, transport: newSocket.io.engine.transport.name })
    })

    newSocket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from Socket.IO server:', reason)
      setIsConnected(false)
      addEvent('Disconnected', { reason })
    })

    newSocket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error)
      addEvent('Connection Error', { error: error.message })
    })

    // Listen for all possible events
    newSocket.on('incomingCall', (data) => {
      console.log('🔔 Incoming call event received:', data)
      addEvent('Incoming Call', data)
    })

    newSocket.on('callInitiated', (data) => {
      console.log('📞 Call initiated event:', data)
      addEvent('Call Initiated', data)
    })

    newSocket.on('callStatusUpdate', (data) => {
      console.log('📊 Call status update:', data)
      addEvent('Call Status Update', data)
    })

    newSocket.on('outboundCallStatus', (data) => {
      console.log('📤 Outbound call status:', data)
      addEvent('Outbound Call Status', data)
    })

    // Test heartbeat
    const heartbeatInterval = setInterval(() => {
      if (newSocket.connected) {
        newSocket.emit('heartbeat', { timestamp: Date.now() })
      }
    }, 30000)

    newSocket.on('heartbeat_response', (data) => {
      console.log('💓 Heartbeat response:', data)
      addEvent('Heartbeat Response', data)
    })

    setSocket(newSocket)

    return () => {
      clearInterval(heartbeatInterval)
      newSocket.disconnect()
    }
  }, [])

  const addEvent = (type: string, data: any) => {
    setEvents(prev => [{
      id: Date.now(),
      type,
      data,
      timestamp: new Date().toISOString()
    }, ...prev.slice(0, 49)]) // Keep last 50 events
  }

  const testIncomingCall = () => {
    if (socket) {
      console.log('🧪 Testing incoming call simulation...')
      // Simulate an incoming call event
      const mockCallData = {
        callSid: 'TEST_' + Date.now(),
        from: '+1234567890',
        to: '+0987654321',
        timestamp: new Date().toISOString(),
        type: 'browser-call',
        status: 'ringing'
      }
      
      // This would normally come from the server, but we can test locally
      addEvent('TEST: Simulated Incoming Call', mockCallData)
    }
  }

  const clearEvents = () => {
    setEvents([])
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Socket.IO Debug Console</h1>
          <p className="text-gray-600 mt-2">Real-time debugging for incoming calls and Socket.IO events</p>
        </div>

        {/* Connection Status */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-3 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="font-medium">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Socket ID: </span>
              <span className="font-mono text-sm">{socket?.id || 'N/A'}</span>
            </div>
            <div>
              <span className="text-gray-600">Transport: </span>
              <span className="font-mono text-sm">{socket?.io?.engine?.transport?.name || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Controls</h2>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={testIncomingCall}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              🧪 Test Incoming Call
            </button>
            <button
              onClick={clearEvents}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              🗑️ Clear Events
            </button>
            <div className="flex items-center">
              <span className="text-gray-600 mr-2">Events: </span>
              <span className="font-mono text-sm">{events.length}</span>
            </div>
          </div>
        </div>

        {/* Events Log */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold">Live Events Log</h2>
            <p className="text-gray-600 text-sm mt-1">Real-time Socket.IO events will appear here</p>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {events.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No events yet. Make a call to your Twilio number to see incoming call events.
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {events.map(event => (
                  <div key={event.id} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">{event.type}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                      {JSON.stringify(event.data, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 