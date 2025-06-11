import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN

export async function GET(request: NextRequest) {
  try {
    const client = twilio(accountSid, authToken)

    const { searchParams } = new URL(request.url);
    const phoneNumber = searchParams.get('phone-number');

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    const inProgressCalls = await client.calls.list({
      status: 'in-progress',
      to: phoneNumber,
      limit: 50
    });

    const outboundInProgressCalls = await client.calls.list({
      status: 'in-progress',
      from: phoneNumber,
      limit: 50
    });

    const ringingCalls = await client.calls.list({
      status: 'ringing',
      to: phoneNumber,
      limit: 50
    });

    const outboundRingingCalls = await client.calls.list({
      status: 'ringing',
      from: phoneNumber,
      limit: 50
    });

    const allCalls = [
      ...inProgressCalls,
      ...outboundInProgressCalls,
      ...ringingCalls,
      ...outboundRingingCalls
    ];

    const uniqueCalls = allCalls.filter((call, index, self) =>
      index === self.findIndex(c => c.sid === call.sid)
    );

    const formattedCalls = uniqueCalls.map(call => ({
      sid: call.sid,
      from: call.from,
      to: call.to,
      status: call.status,
      direction: call.direction,
      dateCreated: call.dateCreated,
      duration: call.duration,
      price: call.price,
      priceUnit: call.priceUnit
    }));

    const inProgress = formattedCalls.filter(call => call.status === 'in-progress');
    const ringing = formattedCalls.filter(call => call.status === 'ringing');

    return NextResponse.json({
      phoneNumber,
      activeCalls: {
        inProgress,
        ringing,
        all: formattedCalls
      },
      counts: {
        inProgress: inProgress.length,
        ringing: ringing.length,
        total: formattedCalls.length
      }
    }, {
      status: 200
    });

  } catch (error) {
    console.error('❌ Error in call-logs endpoint:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}