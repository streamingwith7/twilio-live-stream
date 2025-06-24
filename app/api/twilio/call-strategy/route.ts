import { NextRequest, NextResponse } from 'next/server';
import { callStrategyService } from '@/lib/call-strategy-service';
import { coachingService } from '@/lib/coaching-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { callSid, track, transcriptionData, timestamp } = body;

    if (!callSid || !track || !transcriptionData) {
      return NextResponse.json(
        { error: 'Missing required fields: callSid, track, transcriptionData' },
        { status: 400 }
      );
    }

    console.log(`🎯 Processing call strategy for call ${callSid}, track: ${track}`);

    const conversation = coachingService.getCallAnalytics(callSid);
    
    const speaker = track === 'outbound_track' ? 'agent' : 'customer';
    const result = await callStrategyService.processTranscript(
      callSid,
      transcriptionData,
      speaker,
      conversation
    );

    if (global.io && (result.requirements.length > 0 || result.strategy)) {
      const strategyRoom = `strategy_${callSid}`;
      
      if (result.requirements.length > 0) {
        global.io.to(strategyRoom).emit('newClientRequirements', {
          callSid,
          requirements: result.requirements,
          timestamp: new Date().toISOString()
        });
      }

      if (result.strategy) {
        global.io.to(strategyRoom).emit('callStrategyUpdate', {
          callSid,
          strategy: result.strategy,
          timestamp: new Date().toISOString()
        });
      }
    }

    return NextResponse.json({
      success: true,
      requirements: result.requirements,
      strategy: result.strategy,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in call strategy API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const callSid = searchParams.get('callSid');

    if (!callSid) {
      return NextResponse.json(
        { error: 'Missing callSid parameter' },
        { status: 400 }
      );
    }

    const strategy = callStrategyService.getCurrentStrategy(callSid);
    const requirements = callStrategyService.getRequirements(callSid);

    return NextResponse.json({
      success: true,
      strategy,
      requirements,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting call strategy:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 