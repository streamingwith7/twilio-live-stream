export interface PhoneNumber {
  sid: string
  phoneNumber: string
  friendlyName: string
  voiceUrl?: string
  voiceMethod?: string
  statusCallback?: string
  statusCallbackMethod?: string
  capabilities: {
    voice: boolean
    sms: boolean
    mms: boolean
  }
  isConnectedToPlatform?: boolean
}

export interface CallStatus {
  phoneNumber: string
  status: 'idle' | 'ringing' | 'in-progress' | 'completed' | 'busy' | 'failed'
  callSid?: string
  from?: string
  to?: string
  duration?: number
  timestamp?: string
}

export interface CallLog {
  sid: string
  from: string
  to: string
  status: string
  direction: string
  dateCreated: string
  duration: string
  price: number | null
  priceUnit: string
}

export interface CallLogsResponse {
  phoneNumber: string
  activeCalls: {
    inProgress: CallLog[]
    ringing: CallLog[]
    all: CallLog[]
  }
  counts: {
    inProgress: number
    ringing: number
    total: number
  }
}

export interface User {
  id: string
  email: string
  firstName?: string
  lastName?: string
}

export interface TranscriptMessage {
  callSid: string
  streamSid?: string
  text: string
  type: 'interim' | 'final'
  confidence?: number
  timestamp: string
  words?: TranscriptWord[]
}

export interface TranscriptWord {
  word: string
  start: number
  end: number
  confidence: number
  punctuated_word?: string
}

export interface CallDetails {
  from: string
  to: string
  direction: string
}

export interface StreamResponse {
  success: boolean
  originalCallSid: string
  streamSid: string
  streamName: string
  streamingEnabled: boolean
  audioCapture: {
    bothSides: boolean
    transparent: boolean
    explanation: string
  }
  callDetails: CallDetails
}

export interface StreamStatusEvent {
  streamSid: string
  callSid: string
  status: string
  timestamp: string
}

export interface TranscriptionEvents {
  transcriptionReady: { callSid: string; streamSid: string; timestamp: string; status?: string }
  transcriptionEnded: { callSid: string; streamSid: string; timestamp: string }
  transcriptionError: { callSid: string; streamSid: string; error: string; timestamp: string }
  liveTranscript: TranscriptMessage
  utteranceEnd: { callSid: string; streamSid: string; timestamp: string }
  speechStarted: { callSid: string; streamSid: string; timestamp: string }
  streamStatus: StreamStatusEvent
  transcriptionRoomJoined: { callSid: string; room: string; timestamp: string }
  transcriptionRoomLeft: { callSid: string; room: string; timestamp: string }
  transcriptionRoomError: { error: string }
  transcriptionStatus: { callSid: string; streamSid?: string; status: string; startTime?: string; timestamp: string }
  transcriptionStatusError: { error: string }
  roomJoined: { room: string; type: string }
  roomLeft: { room: string; type: string }
  heartbeatAck: { clientTimestamp: number; serverTimestamp: number }
  activeTranscriptions: { transcriptions: Array<{ callSid: string; streamSid: string; startTime: string; timestamp: string }>; count: number; timestamp: string }
}