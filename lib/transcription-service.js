require('colors');
const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
const EventEmitter = require('events');

class TranscriptionService extends EventEmitter {
  constructor(language = 'en-US', interruption = 2500, utterance = 500) {
    super();
    
    this.language = language;
    this.interruption = interruption;
    this.utterance = utterance;
    
    // Transcription state
    this.finalResult = '';
    this.is_finals = [];
    this.aiSpeaking = false;
    
    // Deepgram client and connection
    this.deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    this.dgConnection = null;
    
    this.initializeConnection();
  }

  initializeConnection() {
    // Create a live transcription connection
    this.dgConnection = this.deepgram.listen.live({
      model: "nova-2",
      language: this.language,
      smart_format: true,
      encoding: 'linear16',
      sample_rate: 16000,
      channels: 1,
      interim_results: true,
      utterance_end_ms: this.utterance,
      vad_events: true,
      endpointing: this.interruption,
      punctuate: true,
    });

    // Listen for events from the live transcription connection
    this.dgConnection.on(LiveTranscriptionEvents.Open, () => {
      console.log('🟢 STT -> Deepgram connection opened'.green);
      
      this.dgConnection.on(LiveTranscriptionEvents.Close, () => {
        console.log('🔴 STT -> Deepgram connection closed'.yellow);
      });

      this.dgConnection.on(LiveTranscriptionEvents.Transcript, (data) => {
        this.handleTranscript(data);
      });

      this.dgConnection.on(LiveTranscriptionEvents.Metadata, (data) => {
        // Handle metadata if needed
      });

      this.dgConnection.on(LiveTranscriptionEvents.Error, (err) => {
        console.error('❌ STT -> Deepgram error:', err);
      });
    });
  }

  handleTranscript(data) {
    const alternatives = data.channel?.alternatives;
    if (!alternatives || alternatives.length === 0) return;

    const transcript = alternatives[0]?.transcript || '';
    
    if (transcript.trim() === '') return;

    // Check if we should interrupt AI speaking
    this.maybeStopAISpeaking(transcript);

    if (data.is_final) {
      console.log('📝 Final transcript:', transcript);
      this.is_finals.push(transcript);

      if (data.speech_final) {
        this.emitFinalTranscription();
      }
    } else {
      console.log('📝 Interim transcript:', transcript);
      // Emit interim results for real-time display
      this.emit('interimTranscript', transcript);
    }
  }

  emitFinalTranscription() {
    const utterance = this.is_finals.join(' ').trim();
    if (utterance) {
      console.log('🎙️ Complete utterance:', utterance);
      this.is_finals = [];
      this.emit('transcription', utterance);
    }
  }

  maybeStopAISpeaking(transcript) {
    if (this.aiSpeaking && transcript.trim()) {
      const words = transcript.trim().split(/\s+/);
      if (words.length >= 2) {
        console.log('🛑 Interrupting AI speech due to user input');
        this.emit('stopaispeaking');
        this.aiSpeaking = false;
      }
    }
  }

  send(audioBuffer) {
    if (this.dgConnection && this.dgConnection.getReadyState() === 1) {
      this.dgConnection.send(audioBuffer);
    }
  }

  setAISpeaking(aiSpeaking) {
    this.aiSpeaking = aiSpeaking;
    console.log(`🤖 AI speaking status: ${aiSpeaking ? 'ON' : 'OFF'}`);
  }

  cleanup() {
    console.log('🧹 Cleaning up transcription service...');
    
    if (this.dgConnection) {
      this.dgConnection.removeAllListeners();
      this.dgConnection.requestClose();
    }

    // Reset state
    this.is_finals = [];
    this.finalResult = '';
    this.aiSpeaking = false;

    // Remove all event listeners
    this.removeAllListeners();
    
    console.log('✅ Transcription service cleaned up');
  }
}

module.exports = { TranscriptionService };