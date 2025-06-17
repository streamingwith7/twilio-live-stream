import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN

export async function POST(request: NextRequest) {
  try {
    if (!accountSid || !authToken) {
      return NextResponse.json(
        { error: 'Twilio credentials not configured' },
        { status: 500 }
      )
    }

    const { fromNumber, toNumber, userId } = await request.json()

    if (!fromNumber || !toNumber) {
      return NextResponse.json(
        { error: 'Both fromNumber and toNumber are required' },
        { status: 400 }
      )
    }

    // Validate phone number format
    const phoneRegex = /^\+?[1-9]\d{1,14}$/
    if (!phoneRegex.test(toNumber.replace(/[\s()-]/g, ''))) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      )
    }

    const client = twilio(accountSid, authToken)
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://closemydeals.com'

    const call = await client.calls.create({
      from: fromNumber,
      to: toNumber,
      url: `${baseUrl}/api/twilio/outbound-webhook`,
      method: 'POST',
      statusCallback: `${baseUrl}/api/twilio/webhook`,
      statusCallbackMethod: 'POST',
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed', 'busy', 'failed', 'no-answer'],
      record: true,
      recordingStatusCallback: `${baseUrl}/api/twilio/recording-status`,
      recordingStatusCallbackMethod: 'POST'
    })

    // Broadcast call initiation to connected clients
    if (global.io) {
      global.io.emit('callInitiated', {
        callSid: call.sid,
        from: fromNumber,
        to: toNumber,
        status: call.status,
        direction: 'outbound',
        userId: userId,
        timestamp: new Date().toISOString()
      })
    }

    return NextResponse.json({
      success: true,
      callSid: call.sid,
      status: call.status,
      from: fromNumber,
      to: toNumber,
      direction: 'outbound',
      dateCreated: call.dateCreated,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Make call error:', error)
    
    let errorMessage = 'Failed to initiate call'
    if (error.code === 21212) {
      errorMessage = 'The "To" phone number is not a valid phone number'
    } else if (error.code === 21213) {
      errorMessage = 'The "From" phone number is not a valid, SMS-capable inbound phone number'
    } else if (error.code === 21214) {
      errorMessage = 'The "To" phone number is not currently reachable'
    } else if (error.message) {
      errorMessage = error.message
    }

    return NextResponse.json(
      { error: errorMessage, code: error.code },
      { status: 500 }
    )
  }
} 