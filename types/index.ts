export interface PhoneNumber {
  sid: string
  phoneNumber: string
  friendlyName: string
  capabilities: {
    voice: boolean
    sms: boolean
    mms: boolean
  }
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