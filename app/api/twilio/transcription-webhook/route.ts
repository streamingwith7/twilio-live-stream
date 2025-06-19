import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.formData()
    
    // Extract transcription event data from Twilio webhook
    const accountSid = body.get('AccountSid') as string
    const callSid = body.get('CallSid') as string
    const transcriptionSid = body.get('TranscriptionSid') as string
    const transcriptionEvent = body.get('TranscriptionEvent') as string
    const timestamp = body.get('Timestamp') as string
    const sequenceId = body.get('SequenceId') as string

    console.log('Transcription webhook received:', {
      accountSid,
      callSid,
      transcriptionSid,
      transcriptionEvent,
      timestamp,
      sequenceId
    })

    // Handle different transcription events
    switch (transcriptionEvent) {
      case 'transcription-started':
        console.log('🎙️ Transcription started for call:', callSid)
        
        // Broadcast to connected clients
        if (global.io) {
          global.io.emit('transcriptionStarted', {
            callSid,
            transcriptionSid,
            timestamp
          })

          // Emit to specific call room
          global.io.to(`call_${callSid}`).emit('transcriptionStarted', {
            callSid,
            transcriptionSid,
            timestamp
          })
        }
        break

      case 'transcription-content':
        const languageCode = body.get('LanguageCode') as string
        const track = body.get('Track') as string
        const transcriptionData = body.get('TranscriptionData') as string
        const final = body.get('Final') as string
        const stability = body.get('Stability') as string

        // console.log('📝 Transcription content:', {
        //   callSid,
        //   transcriptionData,
        //   final,
        //   track,
        //   languageCode
        // })

        if (global.io) {
          const transcriptEvent = {
            CallSid: callSid,
            TranscriptionSid: transcriptionSid,
            TranscriptionData: transcriptionData,
            Track: track,
            Final: final,
            Timestamp: timestamp,
            LanguageCode: languageCode,
            Stability: stability,
            SequenceId: sequenceId
          }

          global.io.emit('transcriptionContent', transcriptEvent)

          // Emit to specific call room
          global.io.to(`call_${callSid}`).emit('transcriptionContent', transcriptEvent)
        }
        break

      case 'transcription-stopped':
        console.log('🛑 Transcription stopped for call:', callSid)
        
        // Broadcast to connected clients
        if (global.io) {
          global.io.emit('transcriptionStopped', {
            callSid,
            transcriptionSid,
            timestamp
          })

          // Emit to specific call room
          global.io.to(`call_${callSid}`).emit('transcriptionStopped', {
            callSid,
            transcriptionSid,
            timestamp
          })
        }
        break

      case 'transcription-error':
        const transcriptionError = body.get('TranscriptionError') as string
        const transcriptionErrorCode = body.get('TranscriptionErrorCode') as string

        console.error('❌ Transcription error for call:', callSid, {
          error: transcriptionError,
          errorCode: transcriptionErrorCode
        })

        // Broadcast error to connected clients
        if (global.io) {
          global.io.emit('transcriptionError', {
            callSid,
            transcriptionSid,
            TranscriptionError: transcriptionError,
            TranscriptionErrorCode: transcriptionErrorCode,
            timestamp
          })

          // Emit to specific call room
          global.io.to(`call_${callSid}`).emit('transcriptionError', {
            callSid,
            transcriptionSid,
            TranscriptionError: transcriptionError,
            TranscriptionErrorCode: transcriptionErrorCode,
            timestamp
          })
        }
        break

      default:
        console.log('Unknown transcription event:', transcriptionEvent)
    }

    // Return TwiML response to acknowledge receipt
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: 200,
        headers: {
          'Content-Type': 'text/xml'
        }
      }
    )

  } catch (error: any) {
    console.error('Transcription webhook error:', error)
    
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: 200,
        headers: {
          'Content-Type': 'text/xml'
        }
      }
    )
  }
} 