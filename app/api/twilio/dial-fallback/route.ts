import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('📞 Dial fallback webhook received!')
    
    const body = await request.formData()
    
    const dialCallStatus = body.get('DialCallStatus') as string
    const callSid = body.get('CallSid') as string
    const from = body.get('From') as string
    const to = body.get('To') as string

    console.log('📞 Dial result:', {
      dialCallStatus,
      callSid,
      from,
      to,
      timestamp: new Date().toISOString(),
      allParams: Object.fromEntries(body.entries())
    })

    const isOutboundBrowserCall = from && from.startsWith('client:')

    if (global.io) {
      global.io.emit('dialResult', {
        callSid,
        dialCallStatus,
        callType: isOutboundBrowserCall ? 'outbound-browser' : 'incoming',
        timestamp: new Date().toISOString()
      })
    }

    let twiml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>`

    if (isOutboundBrowserCall) {
      if (dialCallStatus === 'completed') {
        twiml += `<Hangup />`
      } else if (dialCallStatus === 'busy') {
        twiml += `
          <Say voice="alice">The number you called is busy. Please try again later.</Say>`
      } else if (dialCallStatus === 'no-answer') {
        twiml += `
          <Say voice="alice">The call was not answered. Please try again later.</Say>`
      } else if (dialCallStatus === 'failed') {
        twiml += `
          <Say voice="alice">The call could not be completed. Please check the number and try again.</Say>`
      } else {
        twiml += `
          <Say voice="alice">The call could not be completed. Please try again later.</Say>`
      }
    } else {
      // Handle incoming call failures (original logic)
      if (dialCallStatus === 'completed') {
        twiml += `
          <Say voice="alice">Thank you for calling Close My Deals. Have a great day!</Say>`
      } else if (dialCallStatus === 'answered') {
        twiml += `
          <Say voice="alice">Call connected successfully.</Say>`
      } else if (dialCallStatus === 'busy') {
        twiml += `
          <Say voice="alice">All our agents are currently on other calls. Please leave a message after the tone.</Say>
          <Record 
            timeout="30" 
            maxLength="120" 
            action="${process.env.NEXT_PUBLIC_SITE_URL}/api/twilio/recording-status"
            method="POST" />
          <Say voice="alice">Thank you for your message. We will get back to you soon.</Say>`
      } else if (dialCallStatus === 'no-answer' || dialCallStatus === 'failed') {
        twiml += `
          <Say voice="alice">All agents are currently unavailable. Please leave a message after the tone.</Say>
          <Record 
            timeout="30" 
            maxLength="120" 
            action="${process.env.NEXT_PUBLIC_SITE_URL}/api/twilio/recording-status"
            method="POST" />
          <Say voice="alice">Thank you for your message. We will get back to you soon.</Say>`
      } else {
        twiml += `
          <Say voice="alice">We're experiencing technical difficulties. Please try again later.</Say>`
      }
    }

    twiml += `
        <Hangup />
      </Response>`

    console.log('📝 Returning dial fallback TwiML')

    return new NextResponse(twiml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
      },
    })

  } catch (error: any) {
    console.error('❌ Dial fallback error:', error)
    
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="alice">We're sorry, but we're experiencing technical difficulties. Please try again later.</Say>
        <Hangup />
      </Response>`

    return new NextResponse(errorTwiml, {
      status: 500,
      headers: {
        'Content-Type': 'application/xml',
      },
    })
  }
} 