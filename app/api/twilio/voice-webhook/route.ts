import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('🔔 Voice webhook received!')
    
    const body = await request.formData()
    
    const from = body.get('From') as string
    const to = body.get('To') as string
    const callSid = body.get('CallSid') as string
    const callStatus = body.get('CallStatus') as string || 'initiated'

    console.log('📞 Incoming call details:', {
      from,
      to,
      callSid,
      callStatus,
      timestamp: new Date().toISOString(),
      allParams: Object.fromEntries(body.entries())
    })

    // Notify web clients about incoming call immediately
    let connectedClients = 0
    let availableClientIds: string[] = []
    
    if (global.io) {
      console.log('📡 Broadcasting incoming call to web clients')
      connectedClients = global.io.engine.clientsCount
      
      // Get list of connected clients that might be able to receive calls
      const sockets = await global.io.fetchSockets()
      availableClientIds = sockets.map((socket, index) => `user_${index + 1}`).slice(0, 5)
      
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

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://closemydeals.com'

    // Generate TwiML with dynamic client list based on connected clients
    let clientDialXML = ''
    if (connectedClients > 0) {
      // Try to dial the first few available clients
      for (let i = 1; i <= Math.min(5, connectedClients); i++) {
        clientDialXML += `          <Client>user_${i}</Client>\n`
      }
    } else {
      // Fallback to default clients if no Socket.IO info available
      clientDialXML = `          <Client>user_1</Client>
          <Client>user_2</Client>
          <Client>user_3</Client>`
    }

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
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

    console.log('📝 Returning TwiML response for call', callSid)
    console.log('🎯 Trying to dial clients:', availableClientIds.length > 0 ? availableClientIds : 'default list')

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