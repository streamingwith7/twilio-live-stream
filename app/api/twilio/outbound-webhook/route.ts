import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.formData()
    
    const callSid = body.get('CallSid') as string
    const from = body.get('From') as string
    const to = body.get('To') as string
    const callStatus = body.get('CallStatus') as string

    console.log('Outbound call webhook:', {
      callSid,
      from,
      to,
      callStatus,
      timestamp: new Date().toISOString()
    })

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.closemydeals.com'
    const websocketPort = process.env.WEBSOCKET_PORT || 3001

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Start>
          <Stream url="wss://${new URL(baseUrl).host}:${websocketPort}/api/twilio/media-stream">
            <Parameter name="callSid" value="${callSid}" />
            <Parameter name="from" value="${from}" />
            <Parameter name="to" value="${to}" />
            <Parameter name="direction" value="outbound" />
            <Parameter name="platform" value="closemydeals" />
            <Parameter name="callType" value="platform-initiated" />
          </Stream>
        </Start>
        <Dial timeout="30" callerId="${from}" record="record-from-start">
          <Number>${to}</Number>
        </Dial>
        <Say voice="alice">The call could not be completed. Thank you for using Closemydeals.</Say>
      </Response>`

    // Broadcast outbound call status
    if (global.io) {
      global.io.emit('outboundCallStatus', {
        callSid,
        from,
        to,
        status: callStatus,
        direction: 'outbound',
        timestamp: new Date().toISOString()
      })

      // Join call room for streaming
      global.io.to(`call_${callSid}`).emit('outboundCallConnected', {
        callSid,
        from,
        to,
        timestamp: new Date().toISOString()
      })
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