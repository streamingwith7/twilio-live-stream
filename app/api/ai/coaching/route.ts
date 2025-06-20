import { NextRequest, NextResponse } from 'next/server';
import { openaiService, ConversationContext } from '@/lib/openai-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentText, customerText, callSid, timestamp } = body;

    // Validate required fields
    if (!callSid) {
      return NextResponse.json(
        { error: 'CallSid is required' },
        { status: 400 }
      );
    }

    // Create conversation context
    const context: ConversationContext = {
      agentText: agentText || '',
      customerText: customerText || '',
      conversationHistory: [],
      callSid,
      timestamp: timestamp || new Date().toISOString()
    };

    // Generate coaching tip
    const tip = await openaiService.generateCoachingTip(context);

    if (!tip) {
      return NextResponse.json(
        { message: 'No tip generated for this conversation segment' },
        { status: 200 }
      );
    }

    // Broadcast the tip to all connected clients
    if (global.io) {
      // Broadcast to all clients (since callSid might not be set correctly on frontend)
      global.io.emit('coachingTip', {
        ...tip,
        callSid
      });

      // Also emit to specific call room if clients are connected
      global.io.to(`call_${callSid}`).emit('coachingTip', {
        ...tip,
        callSid
      });

      console.log(`🤖 Coaching tip sent for call ${callSid}:`, tip.message);
    }

    return NextResponse.json({
      success: true,
      tip
    });

  } catch (error: any) {
    console.error('Error in coaching API:', error);
    return NextResponse.json(
      { error: 'Failed to generate coaching tip', details: error.message },
      { status: 500 }
    );
  }
}

// GET endpoint for testing
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'AI Coaching API is running',
    timestamp: new Date().toISOString()
  });
} 