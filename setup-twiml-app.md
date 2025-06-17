# TwiML App Setup Guide

The **ConnectionError (31005)** is occurring because your **TWILIO_TWIML_APP_SID** is not configured. This is required for browser calling to work.

## Steps to Fix:

### 1. Create a TwiML Application

1. Go to [Twilio Console > Voice > TwiML Apps](https://console.twilio.com/us1/develop/voice/twiml-apps)
2. Click "Create new TwiML App"
3. Configure:
   - **App Name**: `Close My Deals Voice App`
   - **Voice Request URL**: `https://www.closemydeals.com/api/twilio/voice-webhook`
   - **Voice Request Method**: `HTTP POST`
   - **Voice Status Callback URL**: `https://www.closemydeals.com/api/twilio/webhook`
   - **Voice Status Callback Method**: `HTTP POST`

### 2. Copy the App SID

After creating the app, copy the **SID** (starts with `AP...`)

### 3. Update Environment Variables

Add to your `.env.local`:

```bash
TWILIO_TWIML_APP_SID="APxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

### 4. Configure Phone Number for Caller ID

Since you want to use the selected phone number as caller ID, add one of your verified Twilio numbers:

```bash
TWILIO_PHONE_NUMBER="+1234567890"  # Your primary Twilio number (fallback)
```

### 5. Test the Configuration

Visit: `http://localhost:5000/api/twilio/debug` to verify all configuration is correct.

## Why This Fixes the Issue:

- **TwiML App** tells Twilio which webhook to call for browser calls
- **Voice webhook** generates the proper TwiML response with caller ID
- **Caller ID** comes from your selected phone number in the dialer

## Expected Flow:

1. User selects phone number in dialer → `selectedFromNumber`
2. Browser calls `voiceClient.makeCall(to, from)` 
3. Twilio calls your **voice webhook** with call details
4. Voice webhook uses selected phone number as caller ID
5. Call connects successfully with proper caller ID

After completing these steps, your outbound browser calls should work without the ConnectionError (31005). 