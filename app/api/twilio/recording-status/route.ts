import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.formData()
    
    const recordingSid = body.get('RecordingSid') as string
    const recordingStatus = body.get('RecordingStatus') as string
    const recordingUrl = body.get('RecordingUrl') as string
    const recordingDuration = body.get('RecordingDuration') as string
    const callSid = body.get('CallSid') as string
    const conferenceSid = body.get('ConferenceSid') as string

    console.log('Recording Status:', {
      recordingSid,
      recordingStatus,
      recordingUrl,
      recordingDuration,
      callSid,
      conferenceSid,
      timestamp: new Date().toISOString()
    })

    // Broadcast recording events to connected clients
    if (global.io && callSid) {
      global.io.to(`call_${callSid}`).emit('recordingStatus', {
        recordingSid,
        status: recordingStatus,
        url: recordingUrl,
        duration: recordingDuration ? parseInt(recordingDuration) : null,
        callSid,
        conferenceSid,
        timestamp: new Date().toISOString()
      })

      // Emit specific recording events
      switch (recordingStatus) {
        case 'in-progress':
          global.io.to(`call_${callSid}`).emit('recordingStarted', {
            recordingSid,
            callSid,
            conferenceSid,
            timestamp: new Date().toISOString()
          })
          break
        case 'completed':
          global.io.to(`call_${callSid}`).emit('recordingCompleted', {
            recordingSid,
            callSid,
            conferenceSid,
            url: recordingUrl,
            duration: recordingDuration ? parseInt(recordingDuration) : null,
            timestamp: new Date().toISOString()
          })
          break
        case 'failed':
          global.io.to(`call_${callSid}`).emit('recordingFailed', {
            recordingSid,
            callSid,
            conferenceSid,
            timestamp: new Date().toISOString()
          })
          break
      }
    }

    // TODO: Store recording information in database
    // You might want to save this to your database for later retrieval
    /*
    if (recordingStatus === 'completed' && recordingUrl) {
      await prisma.callRecording.create({
        data: {
          recordingSid,
          callSid,
          conferenceSid: conferenceSid || null,
          recordingUrl,
          duration: recordingDuration ? parseInt(recordingDuration) : null,
          status: recordingStatus,
          createdAt: new Date()
        }
      })
    }
    */

    return NextResponse.json({ 
      success: true,
      received: recordingStatus,
      recordingSid,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Recording status callback error:', error)
    return NextResponse.json(
      { error: 'Failed to process recording status' },
      { status: 500 }
    )
  }
} 