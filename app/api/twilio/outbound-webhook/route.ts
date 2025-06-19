import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.formData()
    
    const callSid = body.get('CallSid') as string
    const from = body.get('From') as string
    const to = body.get('To') as string
    const callStatus = body.get('CallStatus') as string

    console.log('🔄 Outbound call webhook received:', {
      callSid,
      from,
      to,
      callStatus,
      timestamp: new Date().toISOString()
    })

    if (!global.io) {
      console.error('❌ global.io is not available in outbound webhook')
    }

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Dial timeout="30" callerId="${from}" record="record-from-start">
          <Number>${to}</Number>
        </Dial>
        <Say voice="alice">The call could not be completed. Thank you for using Closemydeals.</Say>
      </Response>`

    if (global.io) {
      console.log('✅ Broadcasting outbound call status:', {
        callSid,
        from,
        to,
        status: callStatus,
        direction: 'outbound',
        timestamp: new Date().toISOString()
      });
      global.io.emit('outboundCallStatus', {
        callSid,
        from,
        to,
        status: callStatus,
        direction: 'outbound',
        timestamp: new Date().toISOString()
      })

      global.io.to(`call_${callSid}`).emit('outboundCallConnected', {
        callSid,
        from,
        to,
        timestamp: new Date().toISOString()
      })
    } else {
      console.error('❌ Cannot emit outbound call status - global.io is not available')
    }

    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' }
    })

  } catch (error) {
    console.error('Outbound webhook error:', error)
    
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="alice">We're sorry, but we're experiencing technical difficulties. The call cannot be completed at this time.</Say>
        <Hangup />
      </Response>`
    
    return new NextResponse(errorTwiml, {
      headers: { 'Content-Type': 'text/xml' }
    })
  }
} 