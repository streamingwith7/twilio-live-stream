'use client'

import { useState, useEffect } from 'react'
import { PhoneNumber } from '@/types'

interface DialerProps {
  phoneNumbers: PhoneNumber[]
  onCallInitiated?: (callData: any) => void
  onError?: (error: string) => void
  voiceClient?: any
  activeCall?: any
  callStatus?: string
}

export default function Dialer({ 
  phoneNumbers, 
  onCallInitiated, 
  onError,
  voiceClient,
  activeCall,
  callStatus = 'idle'
}: DialerProps) {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [selectedFromNumber, setSelectedFromNumber] = useState('')
  const [isDialing, setIsDialing] = useState(false)
  const [recentNumbers, setRecentNumbers] = useState<string[]>([])

  const connectedNumbers = phoneNumbers.filter(phone => phone.isConnectedToPlatform && phone.capabilities.voice)

  useEffect(() => {
    const saved = localStorage.getItem('recentNumbers')
    if (saved) {
      setRecentNumbers(JSON.parse(saved))
    }

    if (connectedNumbers.length > 0 && !selectedFromNumber) {
      setSelectedFromNumber(connectedNumbers[0].phoneNumber)
    }
  }, [phoneNumbers, selectedFromNumber])

  useEffect(() => {
    if (callStatus === 'connecting' || callStatus === 'ringing') {
      setIsDialing(true)
    } else {
      setIsDialing(false)
    }
  }, [callStatus])

  const formatPhoneNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '')
    
    if (cleaned.length >= 10) {
      const formatted = cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')
      return formatted
    }
    
    return cleaned
  }

  const handleNumberInput = (digit: string) => {
    if (phoneNumber.replace(/\D/g, '').length < 10) {
      const newNumber = phoneNumber + digit
      setPhoneNumber(formatPhoneNumber(newNumber))
    }
  }

  const handleBackspace = () => {
    setPhoneNumber(prev => {
      const cleaned = prev.replace(/\D/g, '')
      const newCleaned = cleaned.slice(0, -1)
      return formatPhoneNumber(newCleaned)
    })
  }

  const handleClear = () => {
    setPhoneNumber('')
  }

  const handleDirectInput = (value: string) => {
    setPhoneNumber(formatPhoneNumber(value))
  }

  const saveToRecent = (number: string) => {
    const updated = [number, ...recentNumbers.filter(n => n !== number)].slice(0, 5)
    setRecentNumbers(updated)
    localStorage.setItem('recentNumbers', JSON.stringify(updated))
  }

  const handleCall = async () => {
    if (!phoneNumber || !selectedFromNumber) return

    const cleanedNumber = phoneNumber.replace(/\D/g, '')
    if (cleanedNumber.length < 10) {
      onError?.('Please enter a valid 10-digit phone number')
      return
    }

    const formattedToNumber = `+1${cleanedNumber}`

    try {
      if (voiceClient && voiceClient.isReady) {
        console.log('Making browser call via voice client from', selectedFromNumber, 'to', formattedToNumber)
        await voiceClient.makeCall(formattedToNumber, selectedFromNumber)
        saveToRecent(phoneNumber)
        onCallInitiated?.({ type: 'browser-call', to: formattedToNumber, from: selectedFromNumber })
        setPhoneNumber('')
        return
      }

      console.log('Making server-side call')
    setIsDialing(true)

      const token = localStorage.getItem('token')
      const userData = localStorage.getItem('user')
      const user = userData ? JSON.parse(userData) : null

      const response = await fetch('/api/twilio/make-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          fromNumber: selectedFromNumber,
          toNumber: formattedToNumber,
          userId: user?.id
        })
      })

      const data = await response.json()

      if (response.ok) {
        saveToRecent(phoneNumber)
        onCallInitiated?.(data)
        setPhoneNumber('')
      } else {
        onError?.(data.error || 'Failed to initiate call')
      }
    } catch (error) {
      onError?.('Failed to initiate call')
    } finally {
      setIsDialing(false)
    }
  }

  const handleDisconnect = () => {
    if (voiceClient && activeCall) {
      voiceClient.hangupCall()
    }
  }

  const dialerButtons = [
    { digit: '1', letters: '' },
    { digit: '2', letters: 'ABC' },
    { digit: '3', letters: 'DEF' },
    { digit: '4', letters: 'GHI' },
    { digit: '5', letters: 'JKL' },
    { digit: '6', letters: 'MNO' },
    { digit: '7', letters: 'PQRS' },
    { digit: '8', letters: 'TUV' },
    { digit: '9', letters: 'WXYZ' },
    { digit: '*', letters: '' },
    { digit: '0', letters: '+' },
    { digit: '#', letters: '' }
  ]

  const isCallActive = activeCall && (callStatus === 'connecting' || callStatus === 'ringing' || callStatus === 'connected')

  if (connectedNumbers.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No connected phone numbers</h3>
          <p className="mt-1 text-sm text-gray-500">
            You need to connect at least one phone number to make calls from the platform.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Make a Call</h3>
          <p className="text-sm text-gray-500">
            {voiceClient?.isReady 
              ? 'Browser calling enabled - You\'ll hear audio directly in your browser' 
              : 'Use your connected phone numbers to make outbound calls'
            }
          </p>
        </div>

        {isCallActive && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse mr-2"></div>
                <span className="text-sm font-medium text-blue-800">
                  {callStatus === 'connecting' && 'Connecting...'}
                  {callStatus === 'ringing' && 'Ringing...'}
                  {callStatus === 'connected' && 'Connected'}
                </span>
              </div>
              {activeCall?.remoteNumber && (
                <span className="text-sm text-blue-600">{activeCall.remoteNumber}</span>
              )}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Call From:
          </label>
          <select
            style={{ color: 'black' }}
            value={selectedFromNumber}
            onChange={(e) => setSelectedFromNumber(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isCallActive}
          >
            {connectedNumbers.map((phone) => (
              <option key={phone.sid} value={phone.phoneNumber}>
                {phone.phoneNumber} {phone.friendlyName && `(${phone.friendlyName})`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Call To:
          </label>
          <div className="relative">
            <input
              type="text"
              style={{ color: 'black' }}
              value={phoneNumber}
              onChange={(e) => handleDirectInput(e.target.value)}
              placeholder="Enter phone number"
              className="w-full px-3 py-3 text-xl text-center border border-gray-300 rounded-lg focus:border-blue-500"
              disabled={isCallActive}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {dialerButtons.map((button) => (
            <button
              key={button.digit}
              onClick={() => handleNumberInput(button.digit)}
              disabled={isDialing || isCallActive}
              className="flex flex-col items-center justify-center h-16 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="text-2xl font-semibold text-gray-900">{button.digit}</span>
              {button.letters && (
                <span className="text-xs text-gray-500 mt-1">{button.letters}</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex space-x-3">
          <button
            onClick={handleBackspace}
            disabled={!phoneNumber || isDialing || isCallActive}
            className="flex-1 flex items-center justify-center py-3 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
            </svg>
          </button>
          
          {isCallActive ? (
            <button
              onClick={handleDisconnect}
              className="flex-1 flex items-center justify-center py-3 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Disconnect
            </button>
          ) : (
          <button
            onClick={handleCall}
            disabled={!phoneNumber || !selectedFromNumber || isDialing}
            className="flex-1 flex items-center justify-center py-3 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDialing ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                  {callStatus === 'connecting' ? 'Connecting...' : callStatus === 'ringing' ? 'Ringing...' : 'Calling...'}
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Call
              </>
            )}
          </button>
          )}
          
          <button
            onClick={handleClear}
            disabled={!phoneNumber || isDialing || isCallActive}
            className="flex-1 flex items-center justify-center py-3 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear
          </button>
        </div>

        {recentNumbers.length > 0 && !isCallActive && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Numbers:</h4>
            <div className="flex flex-wrap gap-2">
              {recentNumbers.map((number, index) => (
                <button
                  key={index}
                  onClick={() => setPhoneNumber(number)}
                  disabled={isDialing}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-full hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {number}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 