import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.formData()
    
    const callSid = body.get('CallSid') as string
    const callStatus = body.get('CallStatus') as string
    const to = body.get('To') as string
    const from = body.get('From') as string
    const duration = body.get('CallDuration') as string
    const direction = body.get('Direction') as string

    const mapStatus = (twilioStatus: string) => {
      switch (twilioStatus) {
        case 'ringing': return 'ringing'
        case 'in-progress': return 'in-progress'
        case 'completed': return 'completed'
        case 'busy': return 'busy'
        case 'failed': return 'failed'
        case 'no-answer': return 'failed'
        default: return 'idle'
      }
    }

    const callRecord = await prisma.callRecord.upsert({
      where: { callSid },
      update: {
        status: mapStatus(callStatus),
        endTime: callStatus === 'completed' ? new Date() : undefined,
        duration: duration ? parseInt(duration) : undefined,
        isActive: !['completed', 'failed', 'busy', 'no-answer'].includes(callStatus)
      },
      create: {
        callSid,
        phoneNumber: direction === 'inbound' ? to : from,
        fromNumber: from,
        toNumber: to,
        status: mapStatus(callStatus),
        direction: direction || 'inbound',
        startTime: callStatus === 'ringing' ? new Date() : undefined,
        duration: duration ? parseInt(duration) : undefined,
        isActive: !['completed', 'failed', 'busy', 'no-answer'].includes(callStatus)
      }
    })

    const callUpdate = {
      callSid,
      phoneNumber: callRecord.phoneNumber,
      status: mapStatus(callStatus),
      from,
      to,
      direction,
      duration: duration ? parseInt(duration) : undefined,
      timestamp: new Date().toISOString()
    }

    // Broadcast the update to all connected clients via Socket.IO
    if (global.io) {
      global.io.emit('callStatusUpdate', callUpdate)
      
      // Also emit specific events for real-time UI updates
      if (callStatus === 'ringing') {
        global.io.emit('incomingCall', callUpdate)
      } else if (callStatus === 'completed') {
        global.io.emit('callCompleted', callUpdate)
      }
    }

    console.log('Real-time call status update:', callUpdate)

          // For calls that are answered, start streaming for real-time transcription
      if (callStatus === 'in-progress') {
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.closemydeals.com'
        
        // Fix WebSocket URL for media streaming
        const wsUrl = baseUrl.replace('https://', 'wss://').replace('http://', 'ws://')
        
        // Check if this is an inbound call to a connected number
        // For now, we'll create a conference room for the call
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
          <Response>
            <Say voice="alice">Welcome to Closemydeals. Please hold while we connect you to an agent.</Say>
            <Start>
              <Stream url="${wsUrl}/api/twilio/media-stream">
              <Parameter name="callSid" value="${callSid}" />
              <Parameter name="phoneNumber" value="${callRecord.phoneNumber}" />
              <Parameter name="from" value="${from}" />
              <Parameter name="to" value="${to}" />
              <Parameter name="direction" value="${direction}" />
              <Parameter name="platform" value="closemydeals" />
            </Stream>
          </Start>
          <Dial>
            <Conference 
              statusCallback="${baseUrl}/api/twilio/conference-status"
              statusCallbackMethod="POST"
              statusCallbackEvent="start end join leave mute hold"
              record="record-from-start"
              recordingStatusCallback="${baseUrl}/api/twilio/recording-status"
              recordingStatusCallbackMethod="POST"
              waitUrl=""
              waitMethod="GET"
              maxParticipants="10"
              startConferenceOnEnter="true"
              endConferenceOnExit="false"
            >
              closemydeals-${callSid}
            </Conference>
          </Dial>
          <Say voice="alice">Thank you for calling Closemydeals. Have a great day!</Say>
        </Response>`
      
      return new NextResponse(twiml, {
        headers: { 'Content-Type': 'text/xml' }
      })
    }

    // For other statuses, return empty TwiML
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
      </Response>`
    
    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' }
    })

  } catch (error) {
    console.error('Webhook error:', error)
    
    // Return error TwiML
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="alice">We're sorry, but we're experiencing technical difficulties. Please try again later.</Say>
        <Hangup />
      </Response>`
    
    return new NextResponse(errorTwiml, {
      headers: { 'Content-Type': 'text/xml' }
    })
  }
} 