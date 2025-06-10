# AI Deal Assistant - Real-time Call Monitoring & Transcription

A comprehensive Next.js application with real-time Twilio call monitoring, bidirectional audio streaming, and live transcription capabilities for sales teams.

## 🚀 Features

### Core Functionality
- **Real-time Call Monitoring**: Track Twilio phone number statuses without polling
- **Bidirectional Audio Streaming**: Capture both caller and agent audio in real-time
- **Live Transcription**: Real-time speech-to-text using Google Cloud Speech API
- **WebSocket Integration**: Instant updates for call status and transcriptions
- **Database Persistence**: Store call records and transcriptions with Prisma

### Advanced Features
- **Media Streams**: Twilio Media Streams integration for real-time audio capture
- **μ-law to PCM Conversion**: Process Twilio's audio format for transcription
- **Intelligent Call Management**: Automatic call lifecycle tracking
- **Real-time UI Updates**: Live transcription display with speaker identification
- **Professional Dashboard**: Beautiful glass morphism UI with mobile responsiveness

## 🏗️ Architecture

### Backend Components
- **Next.js API Routes**: RESTful endpoints for call management
- **WebSocket Server**: Real-time bidirectional communication
- **Twilio Integration**: Phone numbers, webhooks, and media streams
- **Deepgram Speech-to-Text**: Real-time transcription with speaker diarization
- **PostgreSQL Database**: Persistent storage with Prisma ORM

### Frontend Components
- **Enhanced Dashboard**: Real-time call monitoring interface
- **Transcription Panel**: Live conversation display with speaker identification
- **Call Management**: Click-to-view active call details
- **Status Indicators**: Visual call status with animations

## 📋 Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- Twilio account with phone numbers
- Deepgram account with API access

## 🛠️ Installation

1. **Clone and install dependencies:**
```bash
git clone <repository-url>
cd twilio-live-stream
npm install
```

2. **Environment setup:**
Create `.env` file:
```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/twilio_db"

# Authentication
NEXTAUTH_SECRET="your-secret-key"

# Twilio (required for real functionality)
TWILIO_ACCOUNT_SID="your_twilio_account_sid"
TWILIO_AUTH_TOKEN="your_twilio_auth_token"

# Deepgram (required for real-time transcription)
DEEPGRAM_API_KEY="your_deepgram_api_key"
```

3. **Database setup:**
```bash
npx prisma generate
npx prisma db push
```

4. **Start the application:**
```bash
npm run dev
```

## 📱 Usage

### Real-time Call Monitoring

1. **Dashboard Access**: Navigate to `/dashboard` after authentication
2. **Phone Numbers**: View all Twilio phone numbers with capabilities
3. **Call Status**: Real-time status updates (idle, ringing, in-progress, completed)
4. **Active Calls**: See all ongoing calls per phone number

### Live Transcription

1. **Select Call**: Click on any active call from the phone number cards
2. **Real-time Transcription**: View live conversation as it happens
3. **Speaker Identification**: Distinguish between caller and agent messages
4. **Confidence Scores**: See transcription accuracy percentages

### System Integration

1. **Twilio Webhooks**: Configure webhooks to point to your domain
2. **Media Streams**: Automatic setup for bidirectional audio capture
3. **Database Storage**: All calls and transcriptions are persisted
4. **WebSocket Updates**: Real-time UI updates without page refresh

## 🔧 API Endpoints

### Call Management
- `GET /api/calls` - Get active calls (with optional phone number filter)
- `GET /api/calls?phoneNumber=+1234567890` - Get calls for specific number

### Twilio Integration
- `POST /api/twilio/webhook` - Receive call status updates + start media streams
- `POST /api/twilio/media-stream` - Handle real-time audio data
- `GET /api/twilio/phone-numbers` - List available phone numbers

### WebSocket Events
- `callStatusUpdate` - Real-time call status changes
- `newTranscription` - Live transcription messages
- `callStarted` - New call initiated
- `callCompleted` - Call ended

## 🎯 Real-time Features

### No More Polling!
Instead of checking call status every 5 seconds, the system uses:
- **Twilio Webhooks**: Instant call status updates
- **WebSocket Broadcasting**: Real-time UI updates
- **Media Stream Events**: Live audio processing
- **Database Triggers**: Automatic transcription storage

### Audio Processing Pipeline
1. **Twilio Media Streams**: Capture μ-law encoded audio (8kHz, 8-bit)
2. **Real-time Processing**: Direct μ-law audio streaming to Deepgram
3. **Live Transcription**: Instant speech-to-text with speaker diarization
4. **Deepgram API**: Advanced AI transcription with confidence scores
5. **WebSocket Broadcast**: Send transcriptions to all connected clients
6. **Database Storage**: Persist transcriptions with speaker identification

## 🎨 UI Components

### Enhanced Dashboard Features
- **Glass Morphism Design**: Modern transparent card layouts
- **Real-time Indicators**: Animated status badges and connection status
- **Responsive Grid**: Adaptive layout for all screen sizes
- **Call Management**: Click-to-select active calls
- **Live Transcription Panel**: Real-time conversation display

### Mobile Responsiveness
- **Responsive Grid**: Adapts from 3 columns to single column
- **Touch-friendly**: Large click targets for mobile interaction
- **Optimized Text**: Readable font sizes across devices

## 🔒 Security

- **JWT Authentication**: Secure WebSocket connections
- **Environment Variables**: Sensitive credentials protection
- **API Route Protection**: Authenticated endpoints
- **CORS Configuration**: Proper cross-origin settings

## 🚀 Production Deployment

### Twilio Configuration
1. **Configure Webhooks**: Set webhook URLs to your production domain
2. **Media Stream URL**: Update TwiML to use your WebSocket endpoint
3. **Phone Number Setup**: Ensure phone numbers have voice capabilities

### Deepgram Setup
1. **Account Setup**: Create account at deepgram.com
2. **API Key**: Generate API key in your Deepgram console
3. **Environment**: Set `DEEPGRAM_API_KEY` environment variable

### Performance Optimization
- **Database Indexing**: Optimize queries for call records
- **WebSocket Scaling**: Consider Redis for multi-server deployments
- **Audio Processing**: Monitor memory usage for large-scale deployments

## 🛠️ Development Mode

The application includes simulation features for development:
- **Simulated Calls**: Automatic call status changes every 8 seconds
- **Mock Transcriptions**: Realistic conversation samples
- **Demo Data**: Sample phone numbers and call scenarios

## 📊 Database Schema

### CallRecord
- Call metadata (SID, phone numbers, status, direction)
- Timing information (start, end, duration)
- Active status tracking

### CallTranscription
- Speaker identification (caller/agent)
- Transcribed text with confidence scores
- Precise timestamps for conversation flow

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section
2. Review Twilio webhook logs
3. Monitor WebSocket connection status
4. Verify environment variables

---

**Built with ❤️ for sales teams who want to win more deals faster.** 