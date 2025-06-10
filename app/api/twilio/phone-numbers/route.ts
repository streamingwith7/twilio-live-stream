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
      capabilities: {
        voice: number.capabilities.voice,
        sms: number.capabilities.sms,
        mms: number.capabilities.mms
      }
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