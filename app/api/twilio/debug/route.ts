import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN

export async function GET(request: NextRequest) {
  try {
    const config = {
      accountSid: process.env.TWILIO_ACCOUNT_SID ? '✓ Set' : '❌ Missing',
      authToken: process.env.TWILIO_AUTH_TOKEN ? '✓ Set' : '❌ Missing',
      apiKey: process.env.TWILIO_API_KEY ? '✓ Set' : '❌ Missing',
      apiSecret: process.env.TWILIO_API_SECRET ? '✓ Set' : '❌ Missing',
      twimlAppSid: process.env.TWILIO_TWIML_APP_SID ? '✓ Set' : '❌ Missing',
      phoneNumber: process.env.TWILIO_PHONE_NUMBER ? process.env.TWILIO_PHONE_NUMBER : '❌ Missing',
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL ? process.env.NEXT_PUBLIC_SITE_URL : '❌ Missing',
      websocketPort: process.env.WEBSOCKET_PORT || '3001',
    }

    const webhookUrls = {
      voiceWebhook: `${process.env.NEXT_PUBLIC_SITE_URL}/api/twilio/voice-webhook`,
      outboundWebhook: `${process.env.NEXT_PUBLIC_SITE_URL}/api/twilio/outbound-webhook`,
      dialFallback: `${process.env.NEXT_PUBLIC_SITE_URL}/api/twilio/dial-fallback`,
      recordingStatus: `${process.env.NEXT_PUBLIC_SITE_URL}/api/twilio/recording-status`,
    }

    const criticalIssues = []
    
    if (!process.env.TWILIO_PHONE_NUMBER) {
      criticalIssues.push('TWILIO_PHONE_NUMBER is required for outbound calls as caller ID')
    }
    
    if (!process.env.TWILIO_API_KEY || !process.env.TWILIO_API_SECRET) {
      criticalIssues.push('TWILIO_API_KEY and TWILIO_API_SECRET are required for browser calling')
    }
    
    if (!process.env.TWILIO_TWIML_APP_SID) {
      criticalIssues.push('TWILIO_TWIML_APP_SID is required for browser calling')
    }

    let twimlAppInfo: any = null
    let phoneNumbersInfo: any[] = []

    // Check TwiML App configuration if credentials are available
    if (accountSid && authToken && process.env.TWILIO_TWIML_APP_SID) {
      try {
        const client = twilio(accountSid, authToken)
        
        // Get TwiML App details
        const twimlApp = await client.applications(process.env.TWILIO_TWIML_APP_SID).fetch()
        twimlAppInfo = {
          sid: twimlApp.sid,
          friendlyName: twimlApp.friendlyName,
          voiceUrl: twimlApp.voiceUrl,
          voiceMethod: twimlApp.voiceMethod,
          statusCallback: twimlApp.statusCallback,
          expectedVoiceUrl: webhookUrls.voiceWebhook,
          isConfiguredCorrectly: twimlApp.voiceUrl === webhookUrls.voiceWebhook
        }

        // Get phone numbers
        const phoneNumbers = await client.incomingPhoneNumbers.list({ limit: 10 })
        phoneNumbersInfo = phoneNumbers.map(number => ({
          phoneNumber: number.phoneNumber,
          friendlyName: number.friendlyName,
          voiceUrl: number.voiceUrl,
          isConnectedToPlatform: number.voiceUrl?.includes('/api/twilio/voice-webhook')
        }))

      } catch (error: any) {
        criticalIssues.push(`Failed to fetch Twilio configuration: ${error.message}`)
      }
    }

    // Test webhook accessibility
    const webhookTests = []
    for (const [name, url] of Object.entries(webhookUrls)) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'test=true'
        })
        webhookTests.push({
          name,
          url,
          status: response.status,
          accessible: response.status < 500
        })
      } catch (error: any) {
        webhookTests.push({
          name,
          url,
          status: 'ERROR',
          accessible: false,
          error: error.message
        })
      }
    }

    return NextResponse.json({
      status: 'Debug Information',
      timestamp: new Date().toISOString(),
      configuration: config,
      webhookUrls,
      webhookTests,
      twimlAppInfo,
      phoneNumbers: phoneNumbersInfo,
      criticalIssues: criticalIssues.length > 0 ? criticalIssues : ['✓ No critical issues detected'],
      troubleshooting: {
        connectionError31005: [
          '1. Verify TwiML App voice URL is set to: ' + webhookUrls.voiceWebhook,
          '2. Ensure TWILIO_PHONE_NUMBER is a verified Twilio number',
          '3. Check that webhook URLs are publicly accessible',
          '4. Verify HTTPS is working for your domain',
          '5. Test webhook manually with: curl -X POST ' + webhookUrls.voiceWebhook
        ]
      },
      recommendations: [
        'Ensure TWILIO_PHONE_NUMBER is set to a verified Twilio phone number',
        'Verify that your TwiML App is configured with the correct voice webhook URL',
        'Check that all webhook URLs are accessible from the internet',
        'Make sure your domain supports HTTPS for webhook calls'
      ]
    })

  } catch (error: any) {
    return NextResponse.json({
      error: 'Debug check failed',
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