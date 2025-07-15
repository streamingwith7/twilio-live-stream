import { NextRequest, NextResponse } from 'next/server'
import { coachingService } from '@/lib/coaching-service'
import { callStrategyService } from '@/lib/call-strategy-service'

if (!global.callStateTracker) {
  global.callStateTracker = new Map<string, {
    customerData?: any;
    callStartTime: number;
    stage: string;
    isOutboundCall?: boolean;
    from?: string;
  }>();
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
        const existingState = global.callStateTracker?.get(callSid);
        if (existingState) {
          global.callStateTracker?.set(callSid, {
            ...existingState,
            stage: 'started'
          });
        } else {
          global.callStateTracker?.set(callSid, {
            callStartTime: Date.now(),
            stage: 'started'
          });
        }

        coachingService.initializeCall(callSid);

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

          const callStateInfo = global.callStateTracker?.get(callSid);
          const isOutboundCall = callStateInfo?.isOutboundCall || false;
          let speaker: 'agent' | 'customer';
          global.io.to(`transcription_${callSid}`).emit('transcriptionContent', transcriptEvent)
          if (isOutboundCall) {
            speaker = track === 'inbound_track' ? 'agent' : 'customer';
          } else {
            speaker = track === 'outbound_track' ? 'agent' : 'customer';
          }
          if (final === 'true' && transcriptionData && transcriptionData.trim().length > 0) {
            const enhancedTip = await coachingService.processTranscript(
              callSid,
              track,
              transcriptionData,
              timestamp,
              speaker
            );

            if (enhancedTip) {
              global.io.to(`coaching_${callSid}`).emit('enhancedCoachingTip', enhancedTip);
            }

            const conversation = coachingService.getCallAnalytics(callSid);
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
            }

            if (strategyResult.strategy) {
              global.io.to(`strategy_${callSid}`).emit('callStrategyUpdate', {
                callSid,
                strategy: strategyResult.strategy,
                timestamp: new Date().toISOString()
              });
            }

            const analytics = coachingService.getCallAnalytics(callSid);
            if (analytics) {
              global.io.to(`coaching_${callSid}`).emit('analyticsUpdate', {
                callSid,
                analytics,
                timestamp: new Date().toISOString()
              });
            }

            const callState = global.callStateTracker?.get(callSid);
            const callDuration = callState ? Date.now() - callState.callStartTime : 0;

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
        const report = await coachingService.generateReport(callSid);
        const finalSummary = coachingService.generateCallSummary(callSid);
        const feedback = await coachingService.generateCallFeedback(callSid);

        if (report && report.turns) {
          try {
            const { prisma } = require('@/lib/prisma');
            const twilio = require('twilio');
            
            const accountSid = process.env.TWILIO_ACCOUNT_SID;
            const authToken = process.env.TWILIO_AUTH_TOKEN;
            const client = twilio(accountSid, authToken);
            
            let fromNumber = null;
            let toNumber = null;
            let recordingUrl = null;
            let duration = null;
            let direction = "";
            try {
              const call = await client.calls(callSid).fetch();
              const callState = global.callStateTracker?.get(callSid);
              fromNumber = call.from || callState?.from;
              toNumber = call.to || callState?.to;
              direction = callState?.isOutboundCall ? 'outbound' : 'inbound';
              duration = call.duration ? parseInt(call.duration) : null;
              
              if (call.recordings) {
                const recordings = await call.recordings().list();
                if (recordings.length > 0) {
                  recordingUrl = recordings[0].uri;
                }
              }
            } catch (twilioError: any) {
              console.warn('⚠️ Could not fetch call details from Twilio:', twilioError.message);
            }
            
            const totalTurns = report.turns.length;
            const totalTips = report.turns.filter((turn: any) => turn.tip).length;
            const usedTips = report.turns.filter((turn: any) => turn.tip && turn.tip.isUsed).length;
            
            await prisma.callReport.create({
              data: {
                callSid,
                fromNumber,
                toNumber,
                recordingUrl,
                duration,
                reportData: report,
                totalTurns,
                totalTips,
                usedTips,
                direction,
                feedback
              }
            });
            
            console.log('✅ Call report saved to database for call:', callSid);
          } catch (error) {
            console.error('❌ Error saving call report to database:', error);
          }
        }

        if (global.io) {
          global.io.to(`transcription_${callSid}`).emit('transcriptionStopped', {
            callSid,
            transcriptionSid,
            timestamp,
            enhanced: true
          });

          global.io.to(`coaching_${callSid}`).emit('finalCoachingSummary', {
            callSid,
            summary: finalSummary,
            timestamp
          });
        }

        coachingService.endCall(callSid);
        callStrategyService.endCall(callSid);
        global.callStateTracker?.delete(callSid);
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

      case 'incremental-status':
        const status = coachingService.getIncrementalReportStatus(callSid);
        return NextResponse.json({ callSid, status });

      case 'incremental-reports':
        const reports = coachingService.getIncrementalReports(callSid);
        return NextResponse.json({ callSid, reports });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error fetching coaching data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}