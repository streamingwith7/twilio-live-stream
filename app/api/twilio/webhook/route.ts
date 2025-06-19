import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import twilio from 'twilio'


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

    if (global.io) {
      global.io.emit('callStatusUpdate', callUpdate)
      
      if (callStatus === 'ringing') {
        global.io.emit('incomingCall', callUpdate)
      } else if (callStatus === 'completed') {
        global.io.emit('callCompleted', callUpdate)
      }
    }
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
      </Response>`
    
    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' }
    })

  } catch (error) {
    console.error('Webhook error:', error)
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