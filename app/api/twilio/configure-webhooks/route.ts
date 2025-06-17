import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN

export async function POST(request: NextRequest) {
  try {
    if (!accountSid || !authToken) {
      return NextResponse.json({
        error: 'Twilio credentials not configured'
      }, { status: 500 })
    }

    const client = twilio(accountSid, authToken)
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://closemydeals.com'

    console.log('🔧 Starting webhook configuration for all phone numbers...')
    console.log('🌐 Base URL:', baseUrl)

    // Get all phone numbers
    const phoneNumbers = await client.incomingPhoneNumbers.list()
    console.log(`📞 Found ${phoneNumbers.length} phone numbers`)

    const results = []

    for (const phoneNumber of phoneNumbers) {
      try {
        console.log(`🔧 Configuring ${phoneNumber.phoneNumber}...`)

        const updateData = {
          voiceUrl: `${baseUrl}/api/twilio/voice-webhook`,
          voiceMethod: 'POST',
          statusCallback: `${baseUrl}/api/twilio/webhook`,
          statusCallbackMethod: 'POST',
          statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed', 'busy', 'failed', 'no-answer']
        }

        const updatedNumber = await client.incomingPhoneNumbers(phoneNumber.sid).update(updateData)

        results.push({
          phoneNumber: phoneNumber.phoneNumber,
          sid: phoneNumber.sid,
          status: 'success',
          voiceUrl: updatedNumber.voiceUrl,
          statusCallback: updatedNumber.statusCallback
        })

        console.log(`✅ Successfully configured ${phoneNumber.phoneNumber}`)
      } catch (error: any) {
        console.error(`❌ Failed to configure ${phoneNumber.phoneNumber}:`, error.message)
        results.push({
          phoneNumber: phoneNumber.phoneNumber,
          sid: phoneNumber.sid,
          status: 'error',
          error: error.message
        })
      }
    }

    const successful = results.filter(r => r.status === 'success')
    const failed = results.filter(r => r.status === 'error')

    console.log(`🎉 Configuration complete: ${successful.length} successful, ${failed.length} failed`)

    return NextResponse.json({
      success: true,
      summary: {
        total: phoneNumbers.length,
        successful: successful.length,
        failed: failed.length
      },
      results,
      webhookUrls: {
        voiceWebhook: `${baseUrl}/api/twilio/voice-webhook`,
        statusWebhook: `${baseUrl}/api/twilio/webhook`,
        mediaStream: `${baseUrl}/api/twilio/media-stream`
      }
    })

  } catch (error: any) {
    console.error('❌ Webhook configuration error:', error)
    return NextResponse.json({
      error: 'Failed to configure webhooks',
      details: error.message
    }, { status: 500 })
  }
} 