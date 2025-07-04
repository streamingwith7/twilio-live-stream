import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('🔔 Voice webhook received!')

    const body = await request.formData()

    const from = body.get('From') as string
    const to = body.get('To') as string
    const callSid = body.get('CallSid') as string
    const callStatus = body.get('CallStatus') as string || 'initiated'
    const caller = body.get('Caller') as string

    console.log('📞 Call details:', {
      from,
      to,
      callSid,
      callStatus,
      callerId: body.get('CallerId'),
      timestamp: new Date().toISOString(),
      allParams: Object.fromEntries(body.entries())
    })


    const isOutboundBrowserCall = from && from.startsWith('client:')

    console.log('📞 Call type:', isOutboundBrowserCall ? 'Outbound Browser Call' : 'Incoming Call')

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://closemydeals.com'

    let twiml = ''

    if (isOutboundBrowserCall) {
      const callerId = (body.get('CallerId') as string) || process.env.TWILIO_PHONE_NUMBER

      if (!callerId) {
        console.error('❌ No caller ID available for outbound call')
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
          <Response>
            <Say voice="alice">Sorry, the calling service is not properly configured. Please contact support.</Say>
            <Hangup />
          </Response>`
      } else {
        const languageCode = 'en-US';
        const track = 'both_tracks';
        
        if (global.callStateTracker) {
          global.callStateTracker.set(callSid, {
            callStartTime: Date.now(),
            stage: 'initiated', 
            isOutboundCall: true,
            from,
            to
          });
        console.log('callStateTracker', global.callStateTracker.get(callSid));
        }
        
        if (global.io) {
        global.io.emit('callInitiated', {
          from,
          to,
          callSid,
          callStatus,
          caller,
          callerId: body.get('CallerId'),
            timestamp: new Date().toISOString(),
            allParams: Object.fromEntries(body.entries())
          })
        };
        
        twiml = `
        <Response>
          <Start>
            <Transcription 
              statusCallbackUrl="https://closemydeals.com/api/twilio/transcription-webhook"
              languageCode="${languageCode}"
              track="${track}"
              partialResults="true"
              enableAutomaticPunctuation="true"
              profanityFilter="false"
            />
          </Start>
          <Dial callerId="${callerId}" 
                  timeout="30" 
                  record="record-from-start"
                  recordingStatusCallback="${baseUrl}/api/twilio/recording-status"
                  recordingStatusCallbackMethod="POST"
                  action="${baseUrl}/api/twilio/dial-fallback"
                  method="POST">
              <Number>${to}</Number>
            </Dial>
            <Say voice="alice">The call could not be completed. Please try again later.</Say>
            <Hangup />
        </Response>`
      }
      
      console.log('📝 Returning outbound browser call TwiML for', to)
      
    } else {
      console.log('📞 Handling incoming call - notifying web clients')
      
      let connectedClients = 0
      let availableClientIds: string[] = []
      
      if (global.io) {
        console.log('📡 Broadcasting incoming call to web clients')
        connectedClients = global.io.engine.clientsCount
        
        const sockets = await global.io.fetchSockets()
        availableClientIds = sockets.map((socket, index) => `user_${socket.handshake.auth.identity} `).slice(0, 5)
        
        const callData = {
          callSid,
          from,
          to,
          timestamp: new Date().toISOString(),
          type: 'browser-call',
          status: 'ringing',
          connectedClients
        }
        
        global.io.emit('incomingCall', callData)
        console.log('📡 Incoming call broadcasted to', connectedClients, 'clients:', callData)
      } else {
        console.error('❌ Socket.IO not available! Cannot notify web clients')
      }
      if (global.callStateTracker) {
        global.callStateTracker.set(callSid, {
          callStartTime: Date.now(),
          stage: 'initiated',
          isOutboundCall: false
        });
      }

      let clientDialXML = ''
      if (connectedClients > 0) {
        for (const clientId of availableClientIds) {
          clientDialXML += `          <Client>${clientId}</Client>\n`
        }
      } else {
        clientDialXML = `          <Client>user_1</Client>
          <Client>user_2</Client>
          <Client>user_3</Client>`
      }

    twiml = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Start>
            <Transcription 
              statusCallbackUrl="https://closemydeals.com/api/twilio/transcription-webhook"
              languageCode="en-US"
              track="both_tracks"
              partialResults="true"
              enableAutomaticPunctuation="true"
              profanityFilter="false"
            />
          </Start>
          <Say voice="alice">You have reached Close My Deals. Connecting you to an agent now.</Say>
          <Dial timeout="20" 
                record="record-from-answer" 
                recordingStatusCallback="${baseUrl}/api/twilio/recording-status"
                recordingStatusCallbackMethod="POST"
                action="${baseUrl}/api/twilio/dial-fallback"
                method="POST">
${clientDialXML}
          </Dial>
          <Say voice="alice">All agents are currently busy. Please leave a message after the tone.</Say>
          <Record 
            timeout="30" 
            maxLength="120" 
            action="${baseUrl}/api/twilio/recording-status"
            method="POST"
            recordingStatusCallback="${baseUrl}/api/twilio/recording-status"
            recordingStatusCallbackMethod="POST" />
          <Say voice="alice">Thank you for your message. We will get back to you soon. Goodbye.</Say>
          <Hangup />
        </Response>`

    console.log('📝 Returning incoming call TwiML')
  }

    return new NextResponse(twiml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
    },
  })

} catch (error: any) {
  console.error('❌ Voice webhook error:', error)
  console.error('Error stack:', error.stack)

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