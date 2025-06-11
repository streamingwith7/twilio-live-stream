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

    if (callStatus === 'in-progress') {
      const twiml = `
        <Response>
          <Start>
            <Stream url="wss://yourdomain.com/api/twilio/media-stream">
              <Parameter name="callSid" value="${callSid}" />
              <Parameter name="phoneNumber" value="${callRecord.phoneNumber}" />
              <Parameter name="from" value="${from}" />
              <Parameter name="to" value="${to}" />
              <Parameter name="direction" value="${direction}" />
            </Stream>
          </Start>
        </Response>
      `
      return new NextResponse(twiml, {
        headers: { 'Content-Type': 'text/xml' }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
} 