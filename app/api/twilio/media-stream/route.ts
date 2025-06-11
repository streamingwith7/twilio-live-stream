import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { TranscriptionService } from '@/lib/transcription-service'

const transcriptionService = new TranscriptionService()
const activeTranscriptions = new Map<string, any>()

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    
    const message = JSON.parse(body)
    
    switch (message.event) {
      case 'connected':
        console.log('📡 Media stream connected:', message.protocol)
        break
        
      case 'start':
        console.log('🎙️ Media stream started:', message.start)
        await handleCallStart(message.start)
        break
        
      case 'media':
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

    const liveTranscription = await transcriptionService.startTranscription(
      startData.callSid,
      (transcriptData) => {
        if (global.io) {
          global.io.emit('newTranscription', transcriptData)
          console.log(`📝 New transcription for ${startData.callSid}: ${transcriptData.speaker} - ${transcriptData.text.substring(0, 50)}...`)
        }
      }
    )

    activeTranscriptions.set(startData.callSid, liveTranscription)

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
    const audioBuffer = Buffer.from(mediaData.payload, 'base64')
    
    transcriptionService.sendAudio(audioBuffer)
    
  } catch (error) {
    console.error('❌ Error handling media stream:', error)
  }
}

async function handleCallStop(stopData: any) {
  try {
    const liveTranscription = activeTranscriptions.get(stopData.callSid)
    if (liveTranscription) {
      transcriptionService.stopTranscription()
      activeTranscriptions.delete(stopData.callSid)
    }

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