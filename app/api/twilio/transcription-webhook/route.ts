import { NextRequest, NextResponse } from 'next/server'
import { openaiService } from '@/lib/openai-service'

// Track conversation state for AI coaching
const conversationTracker = new Map<string, {
  lastAgentText: string;
  lastCustomerText: string;
  lastTipTime: number;
}>();

async function handleCoachingAnalysis(callSid: string, track: string, transcriptionData: string, timestamp: string) {
  try {
    let conversation = conversationTracker.get(callSid);
    if (!conversation) {
      conversation = {
        lastAgentText: '',
        lastCustomerText: '',
        lastTipTime: 0
      };
      conversationTracker.set(callSid, conversation);
    }

    const isAgent = track === 'inbound_track';
    const isCustomer = track === 'outbound_track';

    let actualTranscript = transcriptionData;
    try {
      const parsed = JSON.parse(transcriptionData);
      actualTranscript = parsed.transcript || transcriptionData;
    } catch (e) {
      actualTranscript = transcriptionData;
    }

    console.log(`🎤 Track: ${track}, isAgent: ${isAgent}, isCustomer: ${isCustomer}, transcript: "${actualTranscript}"`);

    if (isAgent) {
      conversation.lastAgentText = actualTranscript;
    } else if (isCustomer) {
      conversation.lastCustomerText = actualTranscript;
    }

    const now = Date.now();
    const timeSinceLastTip = now - conversation.lastTipTime;
    const minTimeBetweenTips = 10000; // 10 seconds
    console.log('conversation', conversation);
    if (conversation.lastAgentText && conversation.lastCustomerText && 
        timeSinceLastTip >= minTimeBetweenTips) {
      
      const tip = await openaiService.generateCoachingTip({
        agentText: conversation.lastAgentText,
        customerText: conversation.lastCustomerText,
        conversationHistory: [],
        callSid,
        timestamp
      });

      if (tip && global.io) {
        global.io.emit('coachingTip', {
          ...tip,
          callSid
        });

        global.io.to(`call_${callSid}`).emit('coachingTip', {
          ...tip,
          callSid
        });

        console.log(`🤖 AI Coaching tip for call ${callSid}:`, tip.message);
        conversation.lastTipTime = now;
      }
    }

  } catch (error) {
    console.error('Error in AI coaching analysis:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.formData()
    
    const accountSid = body.get('AccountSid') as string
    const callSid = body.get('CallSid') as string
    const transcriptionSid = body.get('TranscriptionSid') as string
    const transcriptionEvent = body.get('TranscriptionEvent') as string
    const timestamp = body.get('Timestamp') as string
    const sequenceId = body.get('SequenceId') as string

    switch (transcriptionEvent) {
      case 'transcription-started':
        console.log('🎙️ Transcription started for call:', callSid)
        
        if (global.io) {
          global.io.emit('transcriptionStarted', {
            callSid,
            transcriptionSid,
            timestamp
          })

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

          // global.io.emit('transcriptionContent', transcriptEvent)

          // Emit to specific call room
          global.io.to(`call_${callSid}`).emit('transcriptionContent', transcriptEvent)

          // AI Coaching: Generate tips when we have final transcription
          if (final === 'true' && transcriptionData && transcriptionData.trim().length > 0) {
            await handleCoachingAnalysis(callSid, track, transcriptionData, timestamp);
          }
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