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

    const { callSid } = await request.json()

    if (!callSid) {
      return NextResponse.json(
        { error: 'Call SID is required' },
        { status: 400 }
      )
    }

    const client = twilio(accountSid, authToken)

    // Check if call is active
    const call = await client.calls(callSid).fetch()
    if (call.status !== 'in-progress') {
      return NextResponse.json(
        { error: `Call is not active. Status: ${call.status}` },
        { status: 400 }
      )
    }

    // Stop transcription using TwiML
    const updatedCall = await client.calls(callSid).update({
      twiml: `<Response>
        <Stop>
          <Transcription />
        </Stop>
        <Pause length="3600"/>
      </Response>`
    })

    console.log('Stopped transcription for call:', callSid)

    // Broadcast to connected clients
    if (global.io) {
      global.io.emit('transcriptionStopped', {
        callSid,
        timestamp: new Date().toISOString()
      })

      // Emit to specific call room
      global.io.to(`call_${callSid}`).emit('transcriptionStopped', {
        callSid,
        timestamp: new Date().toISOString()
      })
    }

    return NextResponse.json({
      success: true,
      callSid,
      status: 'stopped',
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Stop transcription error:', error)
    
    let errorMessage = 'Failed to stop transcription'
    if (error.code === 20404) {
      errorMessage = 'Call not found'
    } else if (error.message) {
      errorMessage = error.message
    }

    return NextResponse.json(
      { error: errorMessage, code: error.code },
      { status: 500 }
    )
  }
} 