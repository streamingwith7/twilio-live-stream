import { useEffect, useState, useRef } from 'react'

interface UseVoiceClientProps {
  user: any
  onIncomingCall?: (call: any) => void
  onCallStatusChange?: (status: string, call: any) => void
  onError?: (error: string) => void
}

export function useVoiceClient({ 
  user, 
  onIncomingCall, 
  onCallStatusChange, 
  onError 
}: UseVoiceClientProps) {
  const [device, setDevice] = useState<any | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [activeCall, setActiveCall] = useState<any | null>(null)
  const [callStatus, setCallStatus] = useState<string>('idle')
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(0.8)
  
  const deviceRef = useRef<any | null>(null)
  const tokenRefreshInterval = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!user) return

    initializeDevice()
    setupTokenRefresh()

    return () => {
      cleanup()
    }
  }, [user])

  const initializeDevice = async () => {
    try {
      // Check if Twilio Voice SDK is available
      if (typeof window === 'undefined') return

      // Import Twilio Voice SDK dynamically
      const { Device } = await import('@twilio/voice-sdk')

      // Get access token from our API
      const token = await getAccessToken()
      
      if (!token) {
        onError?.('Failed to get voice access token')
        return
      }

      // Initialize Twilio Device with minimal config
      const newDevice = new Device(token, {
        logLevel: 'debug'
      })

      // Setup device event listeners
      setupDeviceListeners(newDevice)

      // Register the device
      await newDevice.register()
      
      deviceRef.current = newDevice
      setDevice(newDevice)
      setIsReady(true)

      console.log('Twilio Device initialized and registered')

    } catch (error: any) {
      console.error('Device initialization error:', error)
      onError?.('Failed to initialize voice calling: ' + error.message)
    }
  }

  const setupDeviceListeners = (device: any) => {
    device.on('ready', () => {
      console.log('Twilio Device is ready for connections')
      setIsReady(true)
    })

    device.on('error', (error: any) => {
      console.error('Twilio Device error:', error)
      onError?.('Device error: ' + error.message)
    })

    device.on('incoming', (call: any) => {
      console.log('Incoming call received:', call.parameters)
      
      // Show browser notification
      showCallNotification(call)
      
      // Update state
      setActiveCall(call)
      setCallStatus('ringing')
      
      // Setup call listeners
      setupCallListeners(call)
      
      // Notify parent component
      onIncomingCall?.(call)
    })

    device.on('tokenWillExpire', () => {
      console.log('Access token will expire, refreshing...')
      refreshToken()
    })

    device.on('registrationFailed', (error: any) => {
      console.error('Device registration failed:', error)
      onError?.('Failed to register for incoming calls')
    })
  }

  const setupCallListeners = (call: any) => {
    call.on('accept', () => {
      console.log('Call accepted')
      setCallStatus('connected')
      onCallStatusChange?.('connected', call)
    })

    call.on('disconnect', () => {
      console.log('Call disconnected')
      setCallStatus('idle')
      setActiveCall(null)
      onCallStatusChange?.('disconnected', call)
    })

    call.on('cancel', () => {
      console.log('Call cancelled')
      setCallStatus('idle')
      setActiveCall(null)
      onCallStatusChange?.('cancelled', call)
    })

    call.on('reject', () => {
      console.log('Call rejected')
      setCallStatus('idle')
      setActiveCall(null)
      onCallStatusChange?.('rejected', call)
    })

    call.on('error', (error: any) => {
      console.error('Call error:', error)
      onError?.('Call error: ' + error.message)
      setCallStatus('idle')
      setActiveCall(null)
    })

    call.on('warning', (name: any, data: any) => {
      console.warn('Call warning:', name, data)
    })

    call.on('warningCleared', (name: any) => {
      console.log('Call warning cleared:', name)
    })
  }

  const getAccessToken = async (): Promise<string | null> => {
    try {
      const token = localStorage.getItem('token')
      
      // Use a simple, predictable identity for easier TwiML dialing
      const identity = `user_1` // Default to user_1, could be made dynamic later
      
      const response = await fetch('/api/twilio/voice-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: user.id,
          identity: identity
        })
      })

      const data = await response.json()

      if (response.ok) {
        console.log('🎯 Voice client registered with identity:', identity)
        return data.token
      } else {
        throw new Error(data.error || 'Failed to get access token')
      }
    } catch (error) {
      console.error('Token fetch error:', error)
      return null
    }
  }

  const refreshToken = async () => {
    try {
      const token = await getAccessToken()
      if (token && deviceRef.current) {
        deviceRef.current.updateToken(token)
        console.log('Access token refreshed')
      }
    } catch (error) {
      console.error('Token refresh error:', error)
    }
  }

  const setupTokenRefresh = () => {
    // Refresh token every 50 minutes (tokens are valid for 1 hour)
    tokenRefreshInterval.current = setInterval(() => {
      refreshToken()
    }, 50 * 60 * 1000)
  }

  const showCallNotification = (call: any) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification('Incoming Call', {
        body: `Call from ${call.parameters.From || 'Unknown'}`,
        icon: '/phone-icon.png',
        tag: 'incoming-call',
        requireInteraction: true
      })

      notification.onclick = () => {
        window.focus()
        notification.close()
      }

      // Auto-close notification after 30 seconds
      setTimeout(() => {
        notification.close()
      }, 30000)
    }
  }

  const makeCall = async (phoneNumber: string) => {
    if (!device || !isReady) {
      onError?.('Device not ready for outgoing calls')
      return null
    }

    try {
      const call = await device.connect({
        params: {
          To: phoneNumber
        }
      })

      setActiveCall(call)
      setCallStatus('connecting')
      setupCallListeners(call)

      return call
    } catch (error: any) {
      console.error('Make call error:', error)
      onError?.('Failed to make call: ' + error.message)
      return null
    }
  }

  const answerCall = () => {
    if (activeCall && callStatus === 'ringing') {
      activeCall.accept()
    }
  }

  const rejectCall = () => {
    if (activeCall && callStatus === 'ringing') {
      activeCall.reject()
    }
  }

  const hangupCall = () => {
    if (activeCall) {
      activeCall.disconnect()
    }
  }

  const toggleMute = () => {
    if (activeCall && callStatus === 'connected') {
      if (isMuted) {
        activeCall.mute(false)
        setIsMuted(false)
      } else {
        activeCall.mute(true)
        setIsMuted(true)
      }
    }
  }

  const adjustVolume = (newVolume: number) => {
    setVolume(newVolume)
    if (activeCall && callStatus === 'connected') {
      // Twilio SDK manages volume internally
      console.log('Volume adjusted to:', newVolume)
    }
  }

  const cleanup = () => {
    if (tokenRefreshInterval.current) {
      clearInterval(tokenRefreshInterval.current)
    }

    if (deviceRef.current) {
      deviceRef.current.destroy()
      deviceRef.current = null
    }

    setDevice(null)
    setIsReady(false)
    setActiveCall(null)
    setCallStatus('idle')
  }

  // Request notification permission
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('Notification permission:', permission)
      })
    }
  }, [])

  return {
    device,
    isReady,
    activeCall,
    callStatus,
    isMuted,
    volume,
    makeCall,
    answerCall,
    rejectCall,
    hangupCall,
    toggleMute,
    adjustVolume
  }
} 