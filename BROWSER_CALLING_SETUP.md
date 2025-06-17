# Browser Calling Setup Guide

This guide explains how to set up **bidirectional browser calling** where users can make and receive calls directly in their web browser.

## Overview

The system enables:
- **User A (Web Browser)** ↔ **User B (Any Phone)** - bidirectional calling
- **Browser notifications** for incoming calls
- **Web-based audio** (microphone + speakers)
- **Real-time call controls** (mute, volume, hangup)

## Architecture

### Components Created:
1. **API Routes**:
   - `/api/twilio/voice-token` - Generates access tokens for browser calling
   - `/api/twilio/voice-webhook` - Handles incoming calls to browser clients

2. **React Components**:
   - `VoiceClient.tsx` - Twilio Voice SDK integration (needs @twilio/voice-sdk package)
   - `IncomingCallModal.tsx` - Modal for incoming call notifications
   - `ActiveCallControls.tsx` - Call controls (mute, volume, hangup)

3. **Pages**:
   - `/browser-calling` - Main browser calling interface

## Required Setup

### 1. Install Dependencies

```bash
npm install @twilio/voice-sdk
```

### 2. Environment Variables

Add these to your `.env` file:

```env
# Existing Twilio credentials
TWILIO_ACCOUNT_SID="your_twilio_account_sid_here"
TWILIO_AUTH_TOKEN="your_twilio_auth_token_here"

# NEW: Voice SDK credentials
TWILIO_API_KEY="your_twilio_api_key_here"
TWILIO_API_SECRET="your_twilio_api_secret_here"
TWILIO_TWIML_APP_SID="your_twiml_app_sid_here"

# Application URLs
NEXT_PUBLIC_SITE_URL="https://your-domain.com"
WEBSOCKET_PORT="3001"
```

### 3. Twilio Console Setup

#### A. Create API Key & Secret
1. Go to Twilio Console → Account → API Keys
2. Create a new API Key (Standard)
3. Copy the **SID** (API Key) and **Secret**
4. Add to `TWILIO_API_KEY` and `TWILIO_API_SECRET`

#### B. Create TwiML Application
1. Go to Twilio Console → Develop → TwiML Apps
2. Create a new TwiML App with:
   - **Voice Request URL**: `https://your-domain.com/api/twilio/voice-webhook`
   - **Voice Method**: `POST`
   - **Status Callback URL**: `https://your-domain.com/api/twilio/webhook`
   - **Status Callback Method**: `POST`
3. Copy the **Application SID** to `TWILIO_TWIML_APP_SID`

#### C. Configure Phone Numbers for Incoming Calls
1. Go to Twilio Console → Phone Numbers → Manage
2. For each number you want to receive calls:
   - Set **Voice Webhook**: `https://your-domain.com/api/twilio/voice-webhook`
   - Set **Voice Method**: `POST`

### 4. Browser Permissions

The application will automatically request:
- **Microphone access** - for speaking
- **Notification permission** - for incoming call alerts

## How It Works

### Outbound Calls (Browser → Phone)
1. User enters phone number in browser dialer
2. Twilio Voice SDK initiates call using access token
3. TwiML Application routes call to destination phone
4. Audio flows through browser (WebRTC)

### Inbound Calls (Phone → Browser)
1. Caller dials your Twilio phone number
2. Twilio hits your voice webhook (`/api/twilio/voice-webhook`)
3. TwiML responds with `<Client>` dial to browser
4. Browser shows notification and incoming call modal
5. User can accept/reject call in browser

### Browser Notifications
- **Desktop notifications** when calls come in
- **Audio ringing** (handled by Twilio SDK)
- **Modal overlay** for call controls

## Testing

### 1. Test Outbound Calls
1. Go to `/browser-calling`
2. Enter a phone number
3. Click call - you should receive the call on your phone

### 2. Test Inbound Calls
1. Call one of your configured Twilio numbers
2. Browser should show notification and incoming call modal
3. Accept call to start browser audio session

## Troubleshooting

### Common Issues

1. **"Device not ready for calls"**
   - Check API Key/Secret are correct
   - Verify TwiML App SID is valid
   - Check browser console for token errors

2. **No incoming calls**
   - Verify phone number webhook is set correctly
   - Check voice webhook URL is accessible
   - Review Twilio debugger logs

3. **Audio issues**
   - Ensure microphone permission granted
   - Check browser audio settings
   - Verify HTTPS (required for WebRTC)

4. **No notifications**
   - Grant notification permission
   - Check browser notification settings
   - Verify HTTPS (required for notifications)

### Debug Steps

1. **Check browser console** for Voice SDK errors
2. **Monitor Twilio Debugger** for webhook issues
3. **Test webhook endpoints** directly
4. **Verify environment variables** are loaded correctly

## Browser Compatibility

- **Chrome**: Full support
- **Firefox**: Full support  
- **Safari**: Requires iOS 14.3+ / macOS Big Sur+
- **Edge**: Full support

**Requirements**:
- HTTPS (required for microphone access)
- Modern browser with WebRTC support

## Security Notes

- Access tokens expire after 1 hour (automatically refreshed)
- API keys should be kept secure server-side
- All browser calling requires HTTPS
- Webhook URLs should use HTTPS

## Next Steps

1. **Install dependencies**: `npm install @twilio/voice-sdk`
2. **Set up Twilio Console** as described above
3. **Configure environment variables**
4. **Test the `/browser-calling` page**

The system provides a complete browser-based calling solution with notifications and real-time audio! 