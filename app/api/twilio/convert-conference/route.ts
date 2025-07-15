import { NextRequest, NextResponse } from 'next/server';
import twilio, { Twilio } from 'twilio';

const accountSid: string = process.env.TWILIO_ACCOUNT_SID || '';
const authToken: string = process.env.TWILIO_AUTH_TOKEN || '';
const baseURL: string = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.closemydeals.com';

if (!accountSid || !authToken || !baseURL) {
  throw new Error('Environment variables for Twilio are not properly set.');
}

const client: Twilio = twilio(accountSid, authToken);

interface CallDetails {
  from: string;
  to: string;
  direction: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const { callSid } = await req.json();

    if (!callSid) {
      return NextResponse.json({ error: 'Call SID is required' }, { status: 400 });
    }

    const call = await client.calls(callSid).fetch();

    if (call.status !== 'in-progress') {
      return NextResponse.json({
        error: `Call is not active. Status: ${call.status}`,
      }, { status: 400 });
    }

    await client.calls(callSid).transcriptions.create({
      name: `transcription_${callSid}`,
      track: 'both_tracks',
      statusCallbackUrl: `${baseURL}/api/twilio/transcription-webhook`,
      statusCallbackMethod: 'POST'
    });

    const callDetails: CallDetails = {
      from: call.from!,
      to: call.to!,
      direction: call.direction!,
    };

    return NextResponse.json({
      success: true,
      originalCallSid: callSid,
      callDetails,
    }, { status: 200 });

  } catch (error) {
    console.error('Error starting enhanced stream on call:', error);
    return NextResponse.json({
      error: 'Failed to start enhanced stream on call',
      details: (error as Error).message,
    }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const { callSid, streamSid } = await req.json();

    if (!callSid || !streamSid) {
      return NextResponse.json({ 
        error: 'Call SID and Stream SID are required' 
      }, { status: 400 });
    }

    const stream = await client.calls(callSid).streams(streamSid).update({
      status: 'stopped'
    });

    return NextResponse.json({
      success: true,
      streamSid: stream.sid,
      status: stream.status,
      message: 'Enhanced media stream stopped successfully',
      cleanup: {
        sentenceBuilders: 'cleared',
        speakerData: 'finalized'
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error stopping enhanced stream:', error);
    return NextResponse.json({
      error: 'Failed to stop enhanced stream',
      details: (error as Error).message,
    }, { status: 500 });
  }
}