# AI Coaching Real-Time Platform

I've successfully implemented an AI-powered real-time coaching system for your sales team. Here's what has been created:

## 🤖 What's Implemented

### 1. OpenAI Service (`lib/openai-service.ts`)
- Complete OpenAI integration for generating sales coaching tips
- Real-time conversation analysis
- Sentiment analysis for customer responses
- Conversation summarization
- Configurable tip types: suggestions, warnings, opportunities, next steps

### 2. Enhanced Transcription Webhook (`app/api/twilio/transcription-webhook/route.ts`)
- Added AI coaching analysis to the existing transcription webhook
- Automatically analyzes conversations in real-time
- Generates coaching tips when both agent and customer speech is detected
- Prevents tip spam with 10-second intervals between tips
- Broadcasts tips via WebSocket to all connected clients

### 3. Coaching API Endpoint (`app/api/ai/coaching/route.ts`)
- RESTful API for generating coaching tips
- Accepts agent and customer text input
- Returns structured coaching tips with priority levels
- Broadcasts tips via WebSocket for real-time delivery

### 4. Real-Time Coaching Component (`components/RealTimeCoaching.tsx`)
- Beautiful React component for displaying coaching tips
- Fixed positioning in top-right corner
- Auto-removes tips after 30 seconds
- Color-coded by tip type (suggestion, warning, opportunity, next_step)
- Priority badges (high, medium, low)
- Collapsible interface

## 🚀 How It Works

1. **During a Call**: When transcription data comes in via Twilio's webhook, the system:
   - Analyzes the conversation context
   - Identifies if speech is from agent (sales person) or customer
   - Generates contextual coaching tips using OpenAI GPT-4
   - Broadcasts tips in real-time to the frontend

2. **Frontend Display**: The coaching component:
   - Listens for real-time coaching tips via WebSocket
   - Displays tips with appropriate styling and icons
   - Shows tips only during active calls
   - Provides collapsible interface to avoid distraction

3. **Tip Generation**: AI analyzes conversations for:
   - Sales opportunities (🎯)
   - Objection handling suggestions (💡)
   - Warning signs to avoid (⚠️)
   - Next steps to take (👉)

## 📋 Configuration Required

### Environment Variables
Add to your `.env` file:
```env
OPENAI_API_KEY="your_openai_api_key_here"
```

### Fix Make-Call Page Integration
The `app/make-call/page.tsx` file needs a small fix due to editing issues. Add this import:
```typescript
import RealTimeCoaching from '@/components/RealTimeCoaching'
```

And add this component before the closing `</div>` of the main container:
```jsx
{/* Real-Time AI Coaching Tips */}
<RealTimeCoaching 
  socket={socket}
  isCallActive={isCallActive || isVoiceCallActive}
/>
```

## 🧪 Testing the System

### 1. Start the Server
```bash
npm run dev
```

### 2. Test Coaching API Directly
```bash
# Test with sample conversation
curl -X POST http://localhost:5000/api/ai/coaching \
  -H "Content-Type: application/json" \
  -d '{
    "agentText": "Hi, I wanted to discuss our premium software solution that could help your business.",
    "customerText": "I am not really interested, we are pretty busy right now.",
    "callSid": "test_call_123"
  }'
```

### 3. Test During Real Calls
1. Make a call using the platform
2. Start transcription
3. Have a conversation
4. Watch for coaching tips in the top-right corner

## 🎯 Sales Coaching Features

The AI coach provides:

### Suggestions (💡)
- "Ask about their current process"
- "Acknowledge their concern first"
- "Mention specific benefits"

### Opportunities (🎯)
- "They're showing interest - ask for demo"
- "Price objection - discuss ROI"
- "Ready to close - suggest trial"

### Warnings (⚠️)
- "Customer sounds frustrated"
- "Avoid pushing too hard"
- "Listen more, talk less"

### Next Steps (👉)
- "Schedule follow-up call"
- "Send pricing information"
- "Set up demo appointment"

## 🔧 Customization

### Adjust Coaching Prompts
Edit the `SALES_COACHING_PROMPT` in `lib/openai-service.ts` to customize:
- Coaching style and tone
- Types of tips generated
- Industry-specific guidance
- Company-specific sales methodology

### Modify Tip Display
Customize the `RealTimeCoaching` component to:
- Change positioning and styling
- Adjust auto-removal timing
- Add audio notifications
- Integrate with CRM systems

## 🚀 Next Steps

1. **Set up OpenAI API key** in environment variables
2. **Fix the make-call page integration** (small JSX structure issue)
3. **Test with real calls** to see coaching tips in action
4. **Customize prompts** for your specific sales methodology
5. **Train your team** on using the AI coaching insights

The system is designed to be humanistic and helpful, providing actionable tips that help sales teams close more deals and set more appointments during live customer calls. 