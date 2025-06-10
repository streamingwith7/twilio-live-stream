import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { TranscriptionService } from '@/lib/transcription-service'

const transcriptionService = new TranscriptionService()
const activeTranscriptions = new Map<string, any>()

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    
    // Parse WebSocket message from Twilio Media Streams
    const message = JSON.parse(body)
    
    switch (message.event) {
      case 'connected':
        console.log('📡 Media stream connected:', message.protocol)
        break
        
      case 'start':
        console.log('🎙️ Media stream started:', message.start)
        // Create or update call record and start transcription
        await handleCallStart(message.start)
        break
        
      case 'media':
        // Handle real-time audio data
        await handleMediaStream(message.media)
        break
        
      case 'stop':
        console.log('🛑 Media stream stopped')
        await handleCallStop(message.stop)
        break
    }

    return NextResponse.json({ status: 'success' })
  } catch (error) {
    console.error('❌ Media stream webhook error:', error)
    return NextResponse.json(
      { error: 'Media stream processing failed' },
      { status: 500 }
    )
  }
}

async function handleCallStart(startData: any) {
  try {
    const callRecord = await prisma.callRecord.upsert({
      where: { callSid: startData.callSid },
      update: {
        status: 'in-progress',
        startTime: new Date(),
        isActive: true
      },
      create: {
        callSid: startData.callSid,
        phoneNumber: startData.customParameters?.phoneNumber || 'unknown',
        fromNumber: startData.customParameters?.from || 'unknown',
        toNumber: startData.customParameters?.to || 'unknown',
        status: 'in-progress',
        direction: startData.customParameters?.direction || 'inbound',
        startTime: new Date(),
        isActive: true
      }
    })

    // Start Deepgram transcription for this call
    const liveTranscription = await transcriptionService.startTranscription(
      startData.callSid,
      (transcriptData) => {
        // Broadcast transcription to all connected clients
        if (global.io) {
          global.io.emit('newTranscription', transcriptData)
          console.log(`📝 New transcription for ${startData.callSid}: ${transcriptData.speaker} - ${transcriptData.text.substring(0, 50)}...`)
        }
      }
    )

    activeTranscriptions.set(startData.callSid, liveTranscription)

    // Broadcast call start to all connected clients
    if (global.io) {
      global.io.emit('callStarted', {
        callSid: startData.callSid,
        phoneNumber: callRecord.phoneNumber,
        fromNumber: callRecord.fromNumber,
        toNumber: callRecord.toNumber,
        status: 'in-progress',
        timestamp: new Date().toISOString()
      })
    }
  } catch (error) {
    console.error('❌ Error handling call start:', error)
  }
}

async function handleMediaStream(mediaData: any) {
  try {
    // The audio is base64 encoded μ-law (PCMU) format
    const audioBuffer = Buffer.from(mediaData.payload, 'base64')
    
    // Send audio directly to Deepgram for real-time transcription
    transcriptionService.sendAudio(audioBuffer)
    
  } catch (error) {
    console.error('❌ Error handling media stream:', error)
  }
}

async function handleCallStop(stopData: any) {
  try {
    // Stop Deepgram transcription
    const liveTranscription = activeTranscriptions.get(stopData.callSid)
    if (liveTranscription) {
      transcriptionService.stopTranscription()
      activeTranscriptions.delete(stopData.callSid)
    }

    // Update call record
    const callRecord = await prisma.callRecord.updateMany({
      where: { 
        callSid: stopData.callSid,
        isActive: true 
      },
      data: {
        status: 'completed',
        endTime: new Date(),
        isActive: false
      }
    })

    // Broadcast call end to all connected clients
    if (global.io) {
      global.io.emit('callEnded', {
        callSid: stopData.callSid,
        status: 'completed',
        timestamp: new Date().toISOString()
      })
    }
  } catch (error) {
    console.error('❌ Error handling call stop:', error)
  }
} 