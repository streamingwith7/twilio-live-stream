import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const apiKey = process.env.TWILIO_API_KEY
const apiSecret = process.env.TWILIO_API_SECRET

export async function POST(request: NextRequest) {
  try {
    if (!accountSid || !authToken || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: 'Twilio credentials not configured. Missing TWILIO_API_KEY or TWILIO_API_SECRET' },
        { status: 500 }
      )
    }

    const { userId, identity } = await request.json()

    if (!userId || !identity) {
      return NextResponse.json(
        { error: 'userId and identity are required' },
        { status: 400 }
      )
    }

    const AccessToken = twilio.jwt.AccessToken
    const VoiceGrant = AccessToken.VoiceGrant

    // Create an access token
    const accessToken = new AccessToken(
      accountSid,
      apiKey,
      apiSecret,
      { identity: identity }
    )

    // Create a Voice grant for this user
    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID,
      incomingAllow: true, // Allow incoming calls to this client
    })

    // Add the grant to the token
    accessToken.addGrant(voiceGrant)

    // Generate the token (valid for 1 hour)
    const token = accessToken.toJwt()

    return NextResponse.json({
      success: true,
      token: token,
      identity: identity,
      expiresIn: 3600 // 1 hour
    })

  } catch (error: any) {
    console.error('Voice token generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate voice token', details: error.message },
      { status: 500 }
    )
  }
} 