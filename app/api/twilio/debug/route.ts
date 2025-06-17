import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN

export async function GET(request: NextRequest) {
  try {
    if (!accountSid || !authToken) {
      return NextResponse.json({
        error: 'Twilio credentials not configured',
        details: {
          hasAccountSid: !!process.env.TWILIO_ACCOUNT_SID,
          hasAuthToken: !!process.env.TWILIO_AUTH_TOKEN,
          hasApiKey: !!process.env.TWILIO_API_KEY,
          hasApiSecret: !!process.env.TWILIO_API_SECRET,
          hasTwimlAppSid: !!process.env.TWILIO_TWIML_APP_SID
        }
      }, { status: 500 })
    }

    const client = twilio(accountSid, authToken)
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://closemydeals.com'

    // Check phone numbers and their webhook configuration
    const phoneNumbers = await client.incomingPhoneNumbers.list({ limit: 20 })
    
    const phoneNumbersInfo = phoneNumbers.map(number => ({
      sid: number.sid,
      phoneNumber: number.phoneNumber,
      friendlyName: number.friendlyName,
      voiceUrl: number.voiceUrl,
      voiceMethod: number.voiceMethod,
      statusCallback: number.statusCallback,
      statusCallbackMethod: number.statusCallbackMethod,
      capabilities: number.capabilities,
      isConnectedToPlatform: number.voiceUrl?.includes('/api/twilio'),
      webhookConfigured: !!number.voiceUrl,
      expectedVoiceUrl: `${baseUrl}/api/twilio/voice-webhook`,
      actualVoiceUrl: number.voiceUrl
    }))

    // Check recent calls for debugging
    const recentCalls = await client.calls.list({
      limit: 10,
      startTimeAfter: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
    })

    const callsInfo = recentCalls.map(call => ({
      sid: call.sid,
      from: call.from,
      to: call.to,
      status: call.status,
      direction: call.direction,
      startTime: call.startTime,
      endTime: call.endTime,
      duration: call.duration
    }))

    // Check if global.io is available
    const socketIOStatus = {
      available: !!global.io,
      connectedClients: global.io ? global.io.engine.clientsCount : 0
    }

    return NextResponse.json({
      success: true,
      debug: {
        environment: {
          nodeEnv: process.env.NODE_ENV,
          baseUrl,
          accountSid: accountSid?.substring(0, 10) + '...',
          hasWebSocketServer: !!global.io
        },
        phoneNumbers: phoneNumbersInfo,
        recentCalls: callsInfo,
        socketIO: socketIOStatus,
        webhookUrls: {
          voiceWebhook: `${baseUrl}/api/twilio/voice-webhook`,
          statusWebhook: `${baseUrl}/api/twilio/webhook`,
          mediaStream: `${baseUrl}/api/twilio/media-stream`
        },
        recommendations: generateRecommendations(phoneNumbersInfo, baseUrl)
      }
    })

  } catch (error: any) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json({
      error: 'Debug failed',
      details: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}

function generateRecommendations(phoneNumbers: any[], baseUrl: string) {
  const recommendations = []

  if (phoneNumbers.length === 0) {
    recommendations.push({
      type: 'error',
      message: 'No phone numbers found in your Twilio account'
    })
  }

  phoneNumbers.forEach(phone => {
    if (!phone.voiceUrl) {
      recommendations.push({
        type: 'warning',
        phoneNumber: phone.phoneNumber,
        message: 'No voice webhook configured',
        action: `Configure voice webhook to: ${baseUrl}/api/twilio/voice-webhook`
      })
    } else if (!phone.voiceUrl.includes('/api/twilio/voice-webhook')) {
      recommendations.push({
        type: 'warning',
        phoneNumber: phone.phoneNumber,
        message: 'Voice webhook points to different URL',
        current: phone.voiceUrl,
        expected: `${baseUrl}/api/twilio/voice-webhook`
      })
    }

    if (!phone.statusCallback) {
      recommendations.push({
        type: 'info',
        phoneNumber: phone.phoneNumber,
        message: 'No status callback configured',
        action: `Configure status callback to: ${baseUrl}/api/twilio/webhook`
      })
    }
  })

  return recommendations
} 