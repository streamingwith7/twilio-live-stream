import { prisma } from './prisma'

export class TranscriptionService {
  private deepgram: any;
  private liveTranscription: any;

  constructor() {
    // Import Deepgram dynamically to avoid build-time issues
    this.initializeDeepgram();
  }

  private async initializeDeepgram() {
    try {
      if (!process.env.DEEPGRAM_API_KEY) {
        console.warn('⚠️  DEEPGRAM_API_KEY not found in environment variables. Transcription will not work.');
        return;
      }
      
      const { createClient } = await import('@deepgram/sdk');
      this.deepgram = createClient(process.env.DEEPGRAM_API_KEY!);
      console.log('✅ Deepgram initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Deepgram:', error);
      console.log('💡 Make sure to install @deepgram/sdk: npm install @deepgram/sdk');
    }
  }

  async startTranscription(callSid: string, onTranscript: (transcript: any) => void) {
    try {
      if (!this.deepgram) {
        await this.initializeDeepgram();
        if (!this.deepgram) {
          console.error('❌ Cannot start transcription: Deepgram not initialized');
          return null;
        }
      }

      const { LiveTranscriptionEvents } = await import('@deepgram/sdk');
      
      this.liveTranscription = this.deepgram.listen.live({
        model: 'nova-2',
        language: 'en-US',
        smart_format: true,
        diarize: true,
        punctuate: true,
        interim_results: false,
        endpointing: 300,
        channels: 1,
        sample_rate: 8000,
        encoding: 'mulaw'
      });

      this.liveTranscription.addListener(LiveTranscriptionEvents.Open, () => {
        console.log(`🎙️ Deepgram connection opened for call ${callSid}`);
      });

      this.liveTranscription.addListener(LiveTranscriptionEvents.Transcript, async (data: any) => {
        const { channel } = data;
        const transcript = channel?.alternatives?.[0];
        
        if (transcript && transcript.transcript && transcript.transcript.trim() !== '') {
          const speaker = channel.speaker || 0;
          const transcriptData = {
            callSid,
            speaker: speaker === 0 ? 'caller' : 'agent',
            text: transcript.transcript,
            confidence: transcript.confidence || 0.8,
            timestamp: new Date().toISOString()
          };

          // Save to database
          try {
            // Find the call record first
            const callRecord = await prisma.callRecord.findUnique({
              where: { callSid }
            });

            if (callRecord) {
              await prisma.callTranscription.create({
                data: {
                  callRecordId: callRecord.id,
                  speaker: transcriptData.speaker,
                  text: transcriptData.text,
                  confidence: transcriptData.confidence,
                  timestamp: new Date(transcriptData.timestamp)
                }
              });
            }
          } catch (dbError) {
            console.error('Error saving transcription to database:', dbError);
          }

          onTranscript(transcriptData);
        }
      });

      this.liveTranscription.addListener(LiveTranscriptionEvents.Error, (error: any) => {
        console.error(`❌ Deepgram error for call ${callSid}:`, error);
      });

      this.liveTranscription.addListener(LiveTranscriptionEvents.Close, () => {
        console.log(`🔒 Deepgram connection closed for call ${callSid}`);
      });

      return this.liveTranscription;
    } catch (error) {
      console.error('Error starting Deepgram transcription:', error);
      throw error;
    }
  }

  sendAudio(audioData: Buffer) {
    if (this.liveTranscription && this.liveTranscription.getReadyState() === 1) {
      this.liveTranscription.send(audioData);
    }
  }

  stopTranscription() {
    if (this.liveTranscription) {
      this.liveTranscription.finish();
      this.liveTranscription = null;
    }
  }

  async processAudioChunk(callSid: string, sequenceNumber: string, audioData: string): Promise<void> {
    try {
      // Convert base64 audio to buffer
      const audioBuffer = Buffer.from(audioData, 'base64');
      
      // Send directly to Deepgram for real-time processing
      this.sendAudio(audioBuffer);
      
    } catch (error) {
      console.error(`Error processing audio chunk for call ${callSid}:`, error);
    }
  }

  async getTranscriptions(callSid: string) {
    try {
      return await prisma.callTranscription.findMany({
        where: { 
          callRecord: {
            callSid: callSid
          }
        },
        orderBy: { timestamp: 'asc' }
      });
    } catch (error) {
      console.error(`Error fetching transcriptions for call ${callSid}:`, error);
      return [];
    }
  }
}

// Singleton instance
export const transcriptionService = new TranscriptionService() 