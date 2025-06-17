import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.formData()
    
    const conferenceSid = body.get('ConferenceSid') as string
    const statusCallbackEvent = body.get('StatusCallbackEvent') as string
    const callSid = body.get('CallSid') as string
    const participantLabel = body.get('ParticipantLabel') as string

    console.log('Conference Status:', {
      conferenceSid,
      statusCallbackEvent,
      callSid,
      participantLabel,
      timestamp: new Date().toISOString()
    })

    if (global.io && callSid) {
      global.io.to(`call_${callSid}`).emit('conferenceStatus', {
        conferenceSid,
        event: statusCallbackEvent,
        callSid,
        participantLabel,
        timestamp: new Date().toISOString()
      })

      switch (statusCallbackEvent) {
        case 'conference-start':
          global.io.to(`call_${callSid}`).emit('conferenceStarted', {
            conferenceSid,
            callSid,
            timestamp: new Date().toISOString()
          })
          break
        case 'conference-end':
          global.io.to(`call_${callSid}`).emit('conferenceEnded', {
            conferenceSid,
            callSid,
            timestamp: new Date().toISOString()
          })
          break
        case 'participant-join':
          global.io.to(`call_${callSid}`).emit('participantJoined', {
            conferenceSid,
            callSid,
            participantLabel,
            timestamp: new Date().toISOString()
          })
          break
        case 'participant-leave':
          global.io.to(`call_${callSid}`).emit('participantLeft', {
            conferenceSid,
            callSid,
            participantLabel,
            timestamp: new Date().toISOString()
          })
          break
      }
    }

    return NextResponse.json({ 
      success: true,
      received: statusCallbackEvent,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Conference status callback error:', error)
    return NextResponse.json(
      { error: 'Failed to process conference status' },
      { status: 500 }
    )
  }
} 