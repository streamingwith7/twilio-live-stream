import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  return NextResponse.json({
    streamingEnabled: true,
    websocketUrl: '/api/twilio/media-stream',
    capabilities: [
      'real-time-audio-streaming',
      'live-transcription', 
      'call-monitoring',
      'audio-recording'
    ],
    supportedFormats: [
      'mulaw',
      'linear16'
    ]
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { callSid, action } = body

    if (!callSid) {
      return NextResponse.json(
        { error: 'CallSid is required' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'start-stream':
        if (global.io) {
          global.io.to(`call_${callSid}`).emit('streamStarted', {
            callSid,
            timestamp: new Date().toISOString(),
            status: 'streaming'
          })
        }
        
        return NextResponse.json({
          success: true,
          callSid,
          action: 'stream-started',
          timestamp: new Date().toISOString()
        })

      case 'stop-stream':
        if (global.io) {
          global.io.to(`call_${callSid}`).emit('streamStopped', {
            callSid,
            timestamp: new Date().toISOString(),
            status: 'stopped'
          })
        }
        
        return NextResponse.json({
          success: true,
          callSid,
          action: 'stream-stopped',
          timestamp: new Date().toISOString()
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Media stream API error:', error)
    return NextResponse.json(
      { error: 'Failed to process media stream request' },
      { status: 500 }
    )
  }
} 