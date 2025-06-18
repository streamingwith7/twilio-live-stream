import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const apiKey = process.env.TWILIO_API_KEY
const apiSecret = process.env.TWILIO_API_SECRET
const twimlAppSid = process.env.TWILIO_TWIML_APP_SID

export async function GET(request: NextRequest) {
  try {
    const client = twilio(accountSid, authToken)
    
    // Check Twilio configuration
    const configStatus = {
      accountSid: accountSid ? 'configured' : 'missing',
      authToken: authToken ? 'configured' : 'missing',
      apiKey: apiKey ? 'configured' : 'missing',
      apiSecret: apiSecret ? 'configured' : 'missing',
      twimlAppSid: twimlAppSid ? 'configured' : 'missing',
      baseUrl: process.env.NEXT_PUBLIC_SITE_URL || 'not set'
    }

    let accountInfo: any = null
    let twimlAppInfo: any = null
    let phoneNumbers: any[] = []

    try {
      // Verify account access
      if (accountSid) {
        accountInfo = await client.api.v2010.accounts(accountSid).fetch()
      }
    } catch (error: any) {
      console.error('Account fetch error:', error)
    }

    try {
      // Check TwiML App configuration if SID is provided
      if (twimlAppSid) {
        twimlAppInfo = await client.applications(twimlAppSid).fetch()
      }
    } catch (error: any) {
      console.error('TwiML App fetch error:', error)
    }

    try {
      // Get phone numbers
      const phoneNumberList = await client.incomingPhoneNumbers.list()
      phoneNumbers = phoneNumberList.map(number => ({
        sid: number.sid,
        phoneNumber: number.phoneNumber,
        friendlyName: number.friendlyName,
        voiceUrl: number.voiceUrl,
        voiceMethod: number.voiceMethod,
        status: number.status
      }))
    } catch (error: any) {
      console.error('Phone numbers fetch error:', error)
    }

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      configuration: configStatus,
      account: accountInfo ? {
        sid: accountInfo.sid,
        friendlyName: accountInfo.friendlyName,
        status: accountInfo.status,
        type: accountInfo.type
      } : null,
      twimlApp: twimlAppInfo ? {
        sid: twimlAppInfo.sid,
        friendlyName: twimlAppInfo.friendlyName,
        voiceUrl: twimlAppInfo.voiceUrl,
        voiceMethod: twimlAppInfo.voiceMethod,
        statusCallback: twimlAppInfo.statusCallback
      } : null,
      phoneNumbers,
      recommendations: generateRecommendations(configStatus, twimlAppInfo)
    })

  } catch (error: any) {
    console.error('Debug API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch debug information', details: error.message },
      { status: 500 }
    )
  }
}

function generateRecommendations(config: any, twimlApp: any) {
  const recommendations = []

  if (config.twimlAppSid === 'missing') {
    recommendations.push('CRITICAL: TWILIO_TWIML_APP_SID is missing. This is required for browser calling.')
  }

  if (config.apiKey === 'missing' || config.apiSecret === 'missing') {
    recommendations.push('CRITICAL: TWILIO_API_KEY or TWILIO_API_SECRET is missing. These are required for voice tokens.')
  }

  if (twimlApp && !twimlApp.voiceUrl) {
    recommendations.push('WARNING: TwiML App has no voice URL configured. Set it to your voice webhook endpoint.')
  }

  if (config.baseUrl === 'not set') {
    recommendations.push('WARNING: NEXT_PUBLIC_SITE_URL is not set. This may cause WebSocket connection issues.')
  }

  return recommendations
} 