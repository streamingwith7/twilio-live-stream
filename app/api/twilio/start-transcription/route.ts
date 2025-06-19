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

    const { callSid, languageCode = 'en-US', track = 'both_tracks' } = await request.json()

    if (!callSid) {
      return NextResponse.json(
        { error: 'Call SID is required' },
        { status: 400 }
      )
    }

    const client = twilio(accountSid, authToken)
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://closemydeals.com'

    // Check if call is active
    const call = await client.calls(callSid).fetch()
    if (call.status !== 'in-progress') {
      return NextResponse.json(
        { error: `Call is not active. Status: ${call.status}` },
        { status: 400 }
      )
    }

    // Start real-time transcription using Twilio's native <Transcription> TwiML
    const transcription = await client.calls(callSid).update({
      twiml: `<Response>
        <Start>
          <Transcription 
            statusCallbackUrl="${baseUrl}/api/twilio/transcription-webhook"
            languageCode="${languageCode}"
            track="${track}"
            partialResults="true"
            enableAutomaticPunctuation="true"
            profanityFilter="false"
          />
        </Start>
        <Pause length="3600"/>
      </Response>`
    })

    console.log('Started transcription for call:', callSid)

    // Broadcast to connected clients
    if (global.io) {
      global.io.emit('transcriptionStarted', {
        callSid,
        transcriptionSid: transcription.sid,
        timestamp: new Date().toISOString()
      })

      // Emit to specific call room
      global.io.to(`call_${callSid}`).emit('transcriptionStarted', {
        callSid,
        transcriptionSid: transcription.sid,
        timestamp: new Date().toISOString()
      })
    }

    return NextResponse.json({
      success: true,
      callSid,
      transcriptionSid: transcription.sid,
      status: 'started',
      languageCode,
      track,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Start transcription error:', error)
    
    let errorMessage = 'Failed to start transcription'
    if (error.code === 20404) {
      errorMessage = 'Call not found'
    } else if (error.code === 32650) {
      errorMessage = 'Transcription not supported for this call'
    } else if (error.message) {
      errorMessage = error.message
    }

    return NextResponse.json(
      { error: errorMessage, code: error.code },
      { status: 500 }
    )
  }
} 