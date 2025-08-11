import { NextRequest, NextResponse } from 'next/server';
import { openaiService } from '@/lib/openai-service';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  openaiService.initializePrompts().then(() => {
    console.log('✅ Prompts preloaded');
  }).catch((error) => {
    console.error('❌ Failed to preload prompts for call:', error);
  });

  const body = await request.json();
  const { transcript, agent, seller, recordingUrl } = body;

  const feedback = await openaiService.generateCallFeedbackFromTranscript(transcript, agent, seller);

  const userId = request.headers.get('x-user-id');
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await prisma.offlineCallFeedback.create({
    data: {
      agent,
      seller,
      feedback,
      transcript,
      recordingUrl: recordingUrl || null,
      userId: userId
    }
  });

  return NextResponse.json({ feedback });
}