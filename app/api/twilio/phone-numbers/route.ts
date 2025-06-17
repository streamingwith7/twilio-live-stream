import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN

export async function GET(request: NextRequest) {
  try {
    if (!accountSid || !authToken) {
      return NextResponse.json(
        { error: 'Twilio credentials not configured. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in your environment variables.' },
        { status: 500 }
      )
    }

    const client = twilio(accountSid, authToken)

    const phoneNumbers = await client.incomingPhoneNumbers.list({ limit: 20 })

    const formattedNumbers = phoneNumbers.map(number => ({
      sid: number.sid,
      phoneNumber: number.phoneNumber,
      friendlyName: number.friendlyName,
      voiceUrl: number.voiceUrl,
      voiceMethod: number.voiceMethod,
      statusCallback: number.statusCallback,
      statusCallbackMethod: number.statusCallbackMethod,
      capabilities: {
        voice: number.capabilities.voice,
        sms: number.capabilities.sms,
        mms: number.capabilities.mms
      },
      isConnectedToPlatform: number.voiceUrl?.includes('/api/twilio/voice-webhook') || false
    }))

    return NextResponse.json({
      phoneNumbers: formattedNumbers
    })

  } catch (error) {
    console.error('Twilio API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch phone numbers from Twilio' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!accountSid || !authToken) {
      return NextResponse.json(
        { error: 'Twilio credentials not configured' },
        { status: 500 }
      )
    }

    const { sid, action } = await request.json()

    if (!sid || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: sid and action' },
        { status: 400 }
      )
    }

    const client = twilio(accountSid, authToken)
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://closemydeals.com'

    let updateData: any = {}

    if (action === 'connect') {
      // Connect phone number to our platform for incoming calls
      updateData = {
        voiceUrl: `${baseUrl}/api/twilio/voice-webhook`,
        voiceMethod: 'POST',
        statusCallback: `${baseUrl}/api/twilio/webhook`,
        statusCallbackMethod: 'POST',
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
      }
    } else if (action === 'disconnect') {
      // Disconnect phone number from our platform
      updateData = {
        voiceUrl: '',
        voiceMethod: 'POST',
        statusCallback: '',
        statusCallbackMethod: 'POST'
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "connect" or "disconnect"' },
        { status: 400 }
      )
    }

    const updatedNumber = await client.incomingPhoneNumbers(sid).update(updateData)

    return NextResponse.json({
      success: true,
      phoneNumber: {
        sid: updatedNumber.sid,
        phoneNumber: updatedNumber.phoneNumber,
        friendlyName: updatedNumber.friendlyName,
        voiceUrl: updatedNumber.voiceUrl,
        voiceMethod: updatedNumber.voiceMethod,
        statusCallback: updatedNumber.statusCallback,
        statusCallbackMethod: updatedNumber.statusCallbackMethod,
        capabilities: {
          voice: updatedNumber.capabilities.voice,
          sms: updatedNumber.capabilities.sms,
          mms: updatedNumber.capabilities.mms
        },
        isConnectedToPlatform: updatedNumber.voiceUrl?.includes('/api/twilio/voice-webhook') || false
      },
      action: action === 'connect' ? 'connected' : 'disconnected'
    })

  } catch (error) {
    console.error('Twilio API error:', error)
    return NextResponse.json(
      { error: 'Failed to update phone number configuration' },
      { status: 500 }
    )
  }
} 