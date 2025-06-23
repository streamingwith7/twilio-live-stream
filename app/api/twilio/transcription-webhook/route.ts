import { NextRequest, NextResponse } from 'next/server'
import { coachingService } from '@/lib/coaching-service'
import { callStrategyService } from '@/lib/call-strategy-service'

const callStateTracker = new Map<string, {
  customerData?: any;
  callStartTime: number;
  stage: string;
}>();

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
        console.log('🎙️ Enhanced transcription started for call:', callSid)
        console.log('body', body);
        callStateTracker.set(callSid, {
          callStartTime: Date.now(),
          stage: 'started'
        });

        if (global.io) {
          global.io.to(`transcription_${callSid}`).emit('transcriptionStarted', {
            callSid,
            transcriptionSid,
            timestamp,
            enhanced: true
          });

          global.io.to(`coaching_${callSid}`).emit('coachingStatus', {
            callSid,
            status: 'active',
            analytics: coachingService.getCallAnalytics(callSid),
            timestamp
          });
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
            SequenceId: sequenceId,
            Enhanced: true
          }

          global.io.to(`transcription_${callSid}`).emit('transcriptionContent', transcriptEvent)

          if (final === 'true' && transcriptionData && transcriptionData.trim().length > 0) {
            console.log(`🤖 Processing enhanced coaching for call ${callSid}`, transcriptionData);
            console.log('callData', {
              transcriptionData,
              track
            });
            
            const enhancedTip = await coachingService.processTranscript(
              callSid, 
              track, 
              transcriptionData,
              timestamp
            );


            if (enhancedTip) {
              global.io.to(`coaching_${callSid}`).emit('enhancedCoachingTip', enhancedTip);
              console.log(`🤖 Enhanced coaching tip for call ${callSid}:`, enhancedTip.message);
            }

            console.log(`🎯 Processing call strategy for call ${callSid}`);
            const conversation = coachingService.getCallAnalytics(callSid);
            const speaker = track === 'inbound_track' ? 'agent' : 'customer';
            
            const strategyResult = await callStrategyService.processTranscript(
              callSid,
              transcriptionData,
              speaker,
              conversation
            );

            if (strategyResult.requirements.length > 0) {
              global.io.to(`strategy_${callSid}`).emit('newClientRequirements', {
                callSid,
                requirements: strategyResult.requirements,
                timestamp: new Date().toISOString()
              });
              console.log(`🎯 New client requirements for call ${callSid}:`, strategyResult.requirements.length);
            }

            if (strategyResult.strategy) {
              global.io.to(`strategy_${callSid}`).emit('callStrategyUpdate', {
                callSid,
                strategy: strategyResult.strategy,
                timestamp: new Date().toISOString()
              });
              console.log(`🎯 Call strategy updated for call ${callSid}, version ${strategyResult.strategy.version}`);
            }

            // Emit updated analytics
            const analytics = coachingService.getCallAnalytics(callSid);
            if (analytics) {
              global.io.to(`coaching_${callSid}`).emit('analyticsUpdate', {
                callSid,
                analytics,
                timestamp: new Date().toISOString()
              });
            }

            // Emit conversation insights periodically
            const callState = callStateTracker.get(callSid);
            const callDuration = callState ? Date.now() - callState.callStartTime : 0;
            
            // Send insights every 2 minutes
            if (callDuration > 0 && callDuration % 120000 < 5000) {
              const summary = coachingService.generateCallSummary(callSid);
              if (summary) {
                global.io.to(`coaching_${callSid}`).emit('callInsights', {
                  callSid,
                  summary,
                  timestamp: new Date().toISOString()
                });
              }
            }
          }
        }
        break

      case 'transcription-stopped':
        console.log('🛑 Enhanced transcription stopped for call:', callSid)
        
        // Generate final call summary
        const finalSummary = coachingService.generateCallSummary(callSid);
        
        if (global.io) {
          global.io.to(`transcription_${callSid}`).emit('transcriptionStopped', {
            callSid,
            transcriptionSid,
            timestamp,
            enhanced: true
          });

          // Emit final coaching summary
          global.io.to(`coaching_${callSid}`).emit('finalCoachingSummary', {
            callSid,
            summary: finalSummary,
            timestamp
          });
        }

        // Clean up
        coachingService.endCall(callSid);
        callStrategyService.endCall(callSid);
        callStateTracker.delete(callSid);
        break

      case 'transcription-error':
        const transcriptionError = body.get('TranscriptionError') as string
        const transcriptionErrorCode = body.get('TranscriptionErrorCode') as string

        console.error('❌ Enhanced transcription error for call:', callSid, {
          error: transcriptionError,
          errorCode: transcriptionErrorCode
        })

        if (global.io) {
          global.io.to(`transcription_${callSid}`).emit('transcriptionError', {
            callSid,
            transcriptionSid,
            TranscriptionError: transcriptionError,
            TranscriptionErrorCode: transcriptionErrorCode,
            timestamp,
            enhanced: true
          });

          // Emit coaching error
          global.io.to(`coaching_${callSid}`).emit('coachingError', {
            callSid,
            error: 'Transcription service error - coaching temporarily unavailable',
            timestamp
          });
        }
        break

      default:
        console.log('Unknown enhanced transcription event:', transcriptionEvent)
    }

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
    console.error('Enhanced transcription webhook error:', error)
    
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

// Additional endpoint for manual coaching requests
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const callSid = searchParams.get('callSid');
  const action = searchParams.get('action');

  if (!callSid) {
    return NextResponse.json({ error: 'CallSid required' }, { status: 400 });
  }

  try {
    switch (action) {
      case 'analytics':
        const analytics = coachingService.getCallAnalytics(callSid);
        return NextResponse.json({ callSid, analytics });

      case 'summary':
        const summary = coachingService.generateCallSummary(callSid);
        return NextResponse.json({ callSid, summary });

      case 'insights':
        const insights = coachingService.generateCallSummary(callSid);
        return NextResponse.json({ 
          callSid, 
          insights: insights?.keyInsights || [] 
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error fetching coaching data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}