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
  const [isLoadingToken, setIsLoadingToken] = useState(false)
  
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
      if (typeof window === 'undefined') return

      const { Device } = await import('@twilio/voice-sdk')

      const tokenData = await getAccessToken()
      
      if (!tokenData) {
        onError?.('Failed to get voice access token')
        return
      }

      const newDevice = new Device(tokenData.token, {
        logLevel: 'debug',
        edge: ['sydney', 'dublin', 'tokyo'],
        maxAverageBitrate: 16000,
        allowIncomingWhileBusy: false
      })

      setupDeviceListeners(newDevice)

      try {
        await newDevice.register()
        
        deviceRef.current = newDevice
        setDevice(newDevice)
        setIsReady(true)

        console.log('Twilio Device initialized and registered successfully with identity:', tokenData.identity)
      } catch (registerError: any) {
        console.error('Device registration failed:', {
          error: registerError,
          code: registerError.code,
          message: registerError.message,
          identity: tokenData.identity
        })
        
        // More specific error handling for registration failures
        if (registerError.code === 31005) {
          onError?.('WebSocket connection failed. Please check your internet connection and try again.')
        } else if (registerError.code === 31204) {
          onError?.('Invalid access token. Please refresh the page and try again.')
        } else if (registerError.code === 31301) {
          onError?.('TwiML Application SID is invalid. Please check your Twilio configuration.')
        } else {
          onError?.(`Device registration failed: ${registerError.message} (Code: ${registerError.code})`)
        }
        return
      }

    } catch (error: any) {
      console.error('Device initialization error:', error)
      
      // Enhanced error handling with specific 31005 guidance
      if (error.code === 31005) {
        onError?.('WebSocket connection to Twilio failed. This may be due to network issues, firewall restrictions, or proxy settings. Please check your internet connection and try again.')
      } else if (error.message?.includes('WebSocket')) {
        onError?.('WebSocket connection failed. Please ensure your browser supports WebSockets and try again.')
      } else {
        onError?.('Failed to initialize voice calling: ' + error.message)
      }
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

  const getAccessToken = async (): Promise<{token: string, identity: string} | null> => {
    try {
      setIsLoadingToken(true)
      const token = localStorage.getItem('token')
      
      // Use a consistent identity based on user ID for easier TwiML dialing
      const identity = `user_${user.id}` || `user_1`
      
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
        return { token: data.token, identity }
      } else {
        throw new Error(data.error || 'Failed to get access token')
      }
    } catch (error) {
      console.error('Token fetch error:', error)
      return null
    } finally {
      setIsLoadingToken(false)
    }
  }

  const refreshToken = async () => {
    try {
      const tokenData = await getAccessToken()
      if (tokenData && deviceRef.current) {
        deviceRef.current.updateToken(tokenData.token)
        console.log('Access token refreshed for identity:', tokenData.identity)
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

      setTimeout(() => {
        notification.close()
      }, 30000)
    }
  }

  const makeCall = async (phoneNumber: string, fromNumber?: string) => {
    if (!device || !isReady) {
      onError?.('Device not ready for outgoing calls. Please wait for the device to connect.')
      return null
    }

    try {
      console.log('Making call to:', phoneNumber, 'from:', fromNumber)
      
      const params: any = {
        To: phoneNumber,
        CallerId: fromNumber || process.env.TWILIO_PHONE_NUMBER
      }

      const call = await device.connect({
        params
      })

      setActiveCall(call)
      setCallStatus('connecting')
      setupCallListeners(call)

      console.log('Call initiated successfully:', call.sid)
      return call
    } catch (error: any) {
      console.error('Make call error:', error)
      
      // Enhanced error handling for specific error codes
      if (error.code === 31005) {
        onError?.('WebSocket connection lost during call setup. Please check your internet connection and try again.')
      } else if (error.code === 31003) {
        onError?.('Connection timeout. Please check your internet connection and try again.')
      } else if (error.code === 31009) {
        onError?.('No transport available. Please refresh the page and try again.')
      } else if (error.code === 31204) {
        onError?.('Invalid access token. Please refresh the page and try again.')
      } else if (error.message?.includes('WebSocket')) {
        onError?.('WebSocket connection failed. Please check your internet connection and firewall settings.')
      } else {
        onError?.(`Failed to make call: ${error.message}`)
      }
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
    isLoadingToken,
    makeCall,
    answerCall,
    rejectCall,
    hangupCall,
    toggleMute,
    adjustVolume
  }
} 