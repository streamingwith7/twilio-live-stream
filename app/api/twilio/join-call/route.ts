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

    const { callSid, agentPhoneNumber } = await request.json()

    if (!callSid || !agentPhoneNumber) {
      return NextResponse.json(
        { error: 'CallSid and agentPhoneNumber are required' },
        { status: 400 }
      )
    }

    // Check if TWILIO_PHONE_NUMBER is configured
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER
    if (!twilioPhoneNumber) {
      return NextResponse.json(
        { error: 'TWILIO_PHONE_NUMBER not configured' },
        { status: 500 }
      )
    }

    const client = twilio(accountSid, authToken)
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.closemydeals.com'

    // Create TwiML to join the conference
    const joinTwiml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="alice">Connecting you to the call...</Say>
        <Dial>
          <Conference 
            statusCallback="${baseUrl}/api/twilio/conference-status"
            statusCallbackMethod="POST"
            statusCallbackEvent="start end join leave mute hold"
            startConferenceOnEnter="false"
            endConferenceOnExit="true"
          >
            closemydeals-${callSid}
          </Conference>
        </Dial>
      </Response>`

    // Call the agent to join the conference
    const agentCall = await client.calls.create({
      from: twilioPhoneNumber,
      to: agentPhoneNumber,
      twiml: joinTwiml,
      statusCallback: `${baseUrl}/api/twilio/webhook`,
      statusCallbackMethod: 'POST',
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
    })

    // Broadcast that an agent is joining
    if (global.io) {
      global.io.to(`call_${callSid}`).emit('agentJoining', {
        callSid,
        agentCallSid: agentCall.sid,
        agentPhoneNumber,
        timestamp: new Date().toISOString()
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Agent call initiated',
      agentCallSid: agentCall.sid,
      conferenceRoom: `closemydeals-${callSid}`,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Join call error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return NextResponse.json(
      { error: 'Failed to join call', details: errorMessage },
      { status: 500 }
    )
  }
} 