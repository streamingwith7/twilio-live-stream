# Transcription Rooms - Socket Event Handlers

This document describes the new transcription room socket event handlers that provide better organization and management of real-time transcription events.

## Overview

The transcription room functionality adds dedicated socket rooms for transcription events, separate from general call rooms. This allows for:

- **Better event organization**: Separate transcription events from general call events
- **Targeted listeners**: Only clients interested in transcription receive transcription events
- **Status management**: Query transcription status and active sessions
- **Room-based broadcasting**: Efficient event distribution to interested clients

## Socket Events

### Client → Server Events

#### `joinTranscriptionRoom(callSid)`
Join a transcription room for a specific call.

```javascript
socket.emit('joinTranscriptionRoom', 'CA1234567890abcdef1234567890abcdef')
```

**Response Events:**
- `transcriptionRoomJoined` - Success confirmation
- `transcriptionRoomError` - Error if callSid is missing

#### `leaveTranscriptionRoom(callSid)`
Leave a transcription room for a specific call.

```javascript
socket.emit('leaveTranscriptionRoom', 'CA1234567890abcdef1234567890abcdef')
```

**Response Events:**
- `transcriptionRoomLeft` - Success confirmation
- `transcriptionRoomError` - Error if callSid is missing

#### `requestTranscriptionStatus(callSid)`
Request the current transcription status for a call.

```javascript
socket.emit('requestTranscriptionStatus', 'CA1234567890abcdef1234567890abcdef')
```

**Response Events:**
- `transcriptionStatus` - Current status information
- `transcriptionStatusError` - Error if callSid is missing

#### `getActiveTranscriptions()`
Get a list of all currently active transcription sessions.

```javascript
socket.emit('getActiveTranscriptions')
```

**Response Events:**
- `activeTranscriptions` - List of active sessions

#### `heartbeat(data)`
Send a heartbeat to monitor connection health.

```javascript
socket.emit('heartbeat', { timestamp: Date.now() })
```

**Response Events:**
- `heartbeatAck` - Heartbeat acknowledgment

### Server → Client Events

#### `transcriptionRoomJoined`
Confirmation that the client has joined a transcription room.

```javascript
socket.on('transcriptionRoomJoined', (data) => {
  // data: { callSid, room, timestamp }
  console.log('Joined transcription room:', data.room)
})
```

#### `transcriptionRoomLeft`
Confirmation that the client has left a transcription room.

```javascript
socket.on('transcriptionRoomLeft', (data) => {
  // data: { callSid, room, timestamp }
  console.log('Left transcription room:', data.room)
})
```

#### `transcriptionRoomError`
Error occurred with transcription room operations.

```javascript
socket.on('transcriptionRoomError', (data) => {
  // data: { error }
  console.error('Transcription room error:', data.error)
})
```

#### `transcriptionStatus`
Current transcription status for a call.

```javascript
socket.on('transcriptionStatus', (data) => {
  // data: { callSid, streamSid?, status, startTime?, timestamp }
  console.log('Transcription status:', data.status)
})
```

#### `transcriptionStatusError`
Error retrieving transcription status.

```javascript
socket.on('transcriptionStatusError', (data) => {
  // data: { error }
  console.error('Status error:', data.error)
})
```

#### `activeTranscriptions`
List of all active transcription sessions.

```javascript
socket.on('activeTranscriptions', (data) => {
  // data: { transcriptions, count, timestamp }
  console.log('Active sessions:', data.transcriptions)
})
```

#### `heartbeatAck`
Heartbeat acknowledgment with timing information.

```javascript
socket.on('heartbeatAck', (data) => {
  // data: { clientTimestamp, serverTimestamp }
  const latency = Date.now() - data.clientTimestamp
  console.log('Connection latency:', latency + 'ms')
})
```

#### `roomJoined` / `roomLeft`
General room join/leave confirmations.

```javascript
socket.on('roomJoined', (data) => {
  // data: { room, type }
  console.log('Joined room:', data.room, 'type:', data.type)
})
```

### Transcription Events (Enhanced)

All existing transcription events now broadcast to both call rooms and transcription rooms:

- `transcriptionReady` - Transcription service is ready
- `transcriptionEnded` - Transcription service has ended
- `liveTranscript` - Real-time transcript data
- `utteranceEnd` - End of speech utterance
- `speechStarted` - Speech detection started
- `transcriptionError` - Transcription errors

## Room Structure

### Call Rooms
- **Format**: `call_{callSid}`
- **Purpose**: General call events including transcription
- **Audience**: All clients monitoring the call

### Transcription Rooms
- **Format**: `transcription_{callSid}`
- **Purpose**: Transcription-specific events only
- **Audience**: Clients specifically interested in transcription

## Usage Examples

### Basic Setup

```javascript
import { io } from 'socket.io-client'

const socket = io({
  auth: { token: userToken },
  transports: ['polling', 'websocket'],
  upgrade: true,
  timeout: 20000,
  reconnection: true
})

// Join transcription room
socket.on('connect', () => {
  socket.emit('joinTranscriptionRoom', callSid)
})

// Handle transcription events
socket.on('liveTranscript', (data) => {
  if (data.type === 'final') {
    console.log('Final transcript:', data.text)
  }
})

// Monitor transcription status
socket.on('transcriptionReady', (data) => {
  console.log('Transcription started for:', data.callSid)
})

socket.on('transcriptionEnded', (data) => {
  console.log('Transcription ended for:', data.callSid)
})

// Cleanup
socket.on('disconnect', () => {
  socket.emit('leaveTranscriptionRoom', callSid)
})
```

### Advanced Monitoring

```javascript
// Monitor connection health
const heartbeatInterval = setInterval(() => {
  if (socket.connected) {
    socket.emit('heartbeat', { timestamp: Date.now() })
  }
}, 30000)

socket.on('heartbeatAck', (data) => {
  const latency = Date.now() - data.clientTimestamp
  updateConnectionStatus(latency)
})

// Get all active transcriptions
socket.emit('getActiveTranscriptions')
socket.on('activeTranscriptions', (data) => {
  displayActiveTranscriptions(data.transcriptions)
})

// Check specific call status
socket.emit('requestTranscriptionStatus', callSid)
socket.on('transcriptionStatus', (data) => {
  updateTranscriptionUI(data.status)
})
```

### Error Handling

```javascript
// Handle room errors
socket.on('transcriptionRoomError', (data) => {
  console.error('Room error:', data.error)
  // Retry logic or user notification
})

socket.on('transcriptionStatusError', (data) => {
  console.error('Status error:', data.error)
  // Fallback to alternative status checking
})

// Handle transcription errors
socket.on('transcriptionError', (data) => {
  console.error('Transcription error:', data.error)
  // Stop UI updates, show error state
})
```

## Migration Guide

### From Call Rooms Only

If you're currently using only call rooms (`call_{callSid}`), you can optionally migrate to transcription rooms for better organization:

**Before:**
```javascript
socket.emit('joinCallRoom', callSid)
socket.on('liveTranscript', handleTranscript)
```

**After:**
```javascript
// Join both rooms for comprehensive coverage
socket.emit('joinCallRoom', callSid)
socket.emit('joinTranscriptionRoom', callSid)

// Or use transcription room only for transcription events
socket.emit('joinTranscriptionRoom', callSid)
socket.on('liveTranscript', handleTranscript)
```

### Benefits of Migration

1. **Reduced event noise**: Only transcription events in transcription rooms
2. **Better performance**: Fewer irrelevant events processed
3. **Cleaner code**: Separate handlers for different event types
4. **Enhanced monitoring**: Dedicated status and health check events

## Best Practices

1. **Always join transcription rooms** when implementing transcription features
2. **Use heartbeat events** to monitor connection health
3. **Handle room errors gracefully** with retry logic
4. **Clean up properly** by leaving rooms on disconnect
5. **Monitor active transcriptions** to avoid resource conflicts
6. **Check transcription status** before starting new sessions

## Component Integration

See `components/TranscriptionRoomExample.tsx` for a complete implementation example showing how to integrate these events into a React component. 