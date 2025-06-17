const WebSocket = require('ws');
const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
const { createServer } = require('http');
const { parse } = require('url');

require('dotenv').config();

const port = process.env.WEBSOCKET_PORT || 3001;
const hostname = process.env.WEBSOCKET_HOST || 'localhost';

const server = createServer();

const wss = new WebSocket.Server({
  server: server,
  path: '/api/twilio/media-stream',
});

const activeConnections = new Map();
const activeStreams = new Map();
const sentenceBuilders = new Map();

const io = require('socket.io-client');
const socketClient = io(`http://localhost:5000`, {
  auth: {
    service: 'transcription-server'
  }
});

socketClient.on('connect', () => {
  console.log('🔗 Connected to main Socket.IO server');
});

socketClient.on('disconnect', () => {
  console.log('❌ Disconnected from main Socket.IO server');
});

wss.on('connection', (ws, request) => {
  console.log('📞 Twilio Media Stream connected');

  let callSid = null;
  let deepgramConnection = null;
  let streamSid = null;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.event) {
        case 'start':
          callSid = message.start.callSid;
          streamSid = message.start.streamSid;
          console.log(`🔗 Media stream started for call: ${callSid}, stream: ${streamSid}`);

          sentenceBuilders.set(callSid, {
            inbound: { 
              text: '', 
              confidence: 0, 
              words: [], 
              lastUpdateTime: Date.now(),
              pendingText: ''
            }
          });

          const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

          deepgramConnection = deepgram.listen.live({
            model: "nova-3",
            language: "en-US",
            smart_format: true,
            encoding: "mulaw",
            channels: 1,
            sample_rate: 8000,
            interim_results: true,
            utterance_end_ms: "3000",
            vad_events: true,
            endpointing: 1000,
            punctuate: true,
            profanity_filter: false,
            redact: false,
            diarize: false,
            multichannel: false,
            alternatives: 1,
            numerals: true,
            filler_words: false,
            no_delay: false
          });

          activeConnections.set(ws, deepgramConnection);
          activeStreams.set(callSid, {
            ws,
            deepgramConnection,
            streamSid,
            startTime: new Date().toISOString()
          });

          deepgramConnection.on(LiveTranscriptionEvents.Open, () => {
            console.log(`🎙️ Deepgram connection opened for call ${callSid}`);

            socketClient.emit('transcriptionReady', {
              callSid,
              streamSid,
              timestamp: new Date().toISOString()
            });
          });

          deepgramConnection.on(LiveTranscriptionEvents.Close, () => {
            console.log(`🎙️ Deepgram connection closed for call ${callSid}`);

            const builders = sentenceBuilders.get(callSid);
            if (builders) {
              ['inbound', 'outbound'].forEach(speaker => {
                if (builders[speaker] && builders[speaker].text.trim()) {
                  const completeSentence = {
                    id: `${callSid}_${speaker}_${Date.now()}`,
                    text: builders[speaker].text.trim(),
                    speaker,
                    timestamp: new Date().toISOString(),
                    confidence: builders[speaker].confidence
                  };

                  socketClient.emit('completeSentence', { callSid, sentence: completeSentence });
                }
              });
              sentenceBuilders.delete(callSid);
            }

            socketClient.emit('transcriptionEnded', {
              callSid,
              streamSid,
              timestamp: new Date().toISOString()
            });
          });

          deepgramConnection.on(LiveTranscriptionEvents.Transcript, (data) => {
            if (!data.channel || !data.channel.alternatives || !data.channel.alternatives[0]) {
              return;
            }

            const transcript = data.channel.alternatives[0].transcript;
            const isInterim = data.is_final === false;
            const confidence = data.channel.alternatives[0].confidence || 0;
            
            const track = 'inbound_track';
            const speaker = 'inbound';

            if (transcript && transcript.trim().length > 0) {
              const builders = sentenceBuilders.get(callSid);
              if (!builders) return;

              if (isInterim) {
                builders[speaker].pendingText = transcript;
                builders[speaker].lastUpdateTime = Date.now();

                const transcriptData = {
                  callSid,
                  streamSid,
                  text: transcript,
                  type: 'interim',
                  confidence: confidence,
                  timestamp: new Date().toISOString(),
                  speaker,
                  track,
                  words: data.channel.alternatives[0].words || []
                };

                socketClient.emit('liveTranscript', { callSid, transcript: transcriptData });
              } else {
                if (builders[speaker].text.trim()) {
                  builders[speaker].text += ' ' + transcript;
                } else {
                  builders[speaker].text = transcript;
                }
                builders[speaker].confidence = Math.max(builders[speaker].confidence, confidence);
                builders[speaker].pendingText = '';

                console.log(`🎙️ Final Transcript Added [${callSid}]:`, transcript);
                console.log(`🎙️ Current Accumulated Text:`, builders[speaker].text);
              }
            }
          });

          deepgramConnection.on(LiveTranscriptionEvents.UtteranceEnd, (data) => {
            console.log(`🎙️ Utterance end for call ${callSid}`);
            
            const builders = sentenceBuilders.get(callSid);
            if (builders && builders.inbound.text.trim()) {
              const completeSentence = {
                id: `${callSid}_inbound_${Date.now()}_${Math.random()}`,
                text: builders.inbound.text.trim(),
                speaker: 'inbound',
                timestamp: new Date().toISOString(),
                confidence: builders.inbound.confidence
              };

              console.log(`🎙️ Complete Sentence Emitted [${callSid}]:`, completeSentence.text);
              socketClient.emit('completeSentence', { callSid, sentence: completeSentence });

              builders.inbound = { 
                text: '', 
                confidence: 0, 
                words: [], 
                lastUpdateTime: Date.now(),
                pendingText: ''
              };
            }
            
            const utteranceData = {
              callSid,
              streamSid,
              speaker: 'inbound',
              timestamp: new Date().toISOString()
            };

            socketClient.emit('utteranceEnd', { callSid, data: utteranceData });
          });

          deepgramConnection.on(LiveTranscriptionEvents.SpeechStarted, (data) => {
            const speechData = {
              callSid,
              streamSid,
              timestamp: new Date().toISOString()
            };

            console.log(`🎙️ Speech started for call ${callSid}`);
            socketClient.emit('speechStarted', { callSid, data: speechData });
          });

          deepgramConnection.on(LiveTranscriptionEvents.Metadata, (data) => {
            console.log(`🎙️ Deepgram metadata for call ${callSid}:`, data);
          });

          deepgramConnection.on(LiveTranscriptionEvents.Error, (err) => {
            console.error(`❌ Deepgram error for call ${callSid}:`, err);

            const errorData = {
              callSid,
              streamSid,
              error: err.message,
              timestamp: new Date().toISOString()
            };

            socketClient.emit('transcriptionError', { callSid, error: errorData });
          });

          break;

        case 'media':
          if (deepgramConnection && deepgramConnection.getReadyState() === 1) {
            try {
              const { track, payload } = message.media;
              const audioBuffer = Buffer.from(payload, 'base64');
              deepgramConnection.send(audioBuffer);
            } catch (error) {
              console.error(`❌ Error sending audio to Deepgram for call ${callSid}:`, error);
            }
          }
          break;

        case 'stop':
          console.log(`🛑 Media stream stopped for call: ${callSid}`);
          
          const builders = sentenceBuilders.get(callSid);
          if (builders) {
            ['inbound', 'outbound'].forEach(speaker => {
              if (builders[speaker] && builders[speaker].text.trim()) {
                const completeSentence = {
                  id: `${callSid}_${speaker}_${Date.now()}`,
                  text: builders[speaker].text.trim(),
                  speaker,
                  timestamp: new Date().toISOString(),
                  confidence: builders[speaker].confidence
                };

                socketClient.emit('completeSentence', { callSid, sentence: completeSentence });
              }
            });
            sentenceBuilders.delete(callSid);
          }
          
          if (deepgramConnection) {
            try {
              deepgramConnection.finish();
            } catch (error) {
              console.error(`❌ Error finishing Deepgram connection for call ${callSid}:`, error);
            }
            activeConnections.delete(ws);
            activeStreams.delete(callSid);
            deepgramConnection = null;
          }
          break;

        default:
          console.log('Unknown message event:', message.event);
          break;
      }
    } catch (error) {
      console.error('❌ Error processing WebSocket message:', error);
    }
  });

  ws.on('close', () => {
    console.log(`📞 Media stream connection closed for call: ${callSid}`);
    
    const builders = sentenceBuilders.get(callSid);
    if (builders) {
      ['inbound', 'outbound'].forEach(speaker => {
        if (builders[speaker] && builders[speaker].text.trim()) {
          const completeSentence = {
            id: `${callSid}_${speaker}_${Date.now()}`,
            text: builders[speaker].text.trim(),
            speaker,
            timestamp: new Date().toISOString(),
            confidence: builders[speaker].confidence
          };

          socketClient.emit('completeSentence', { callSid, sentence: completeSentence });
        }
      });
      sentenceBuilders.delete(callSid);
    }
    
    if (deepgramConnection) {
      try {
        deepgramConnection.finish();
      } catch (error) {
        console.error(`❌ Error closing Deepgram connection for call ${callSid}:`, error);
      }
      activeConnections.delete(ws);
      if (callSid) {
        activeStreams.delete(callSid);
      }
      deepgramConnection = null;
    }
  });

  ws.on('error', (error) => {
    console.error(`❌ Media stream WebSocket error for call ${callSid}:`, error);
    
    const builders = sentenceBuilders.get(callSid);
    if (builders) {
      ['inbound', 'outbound'].forEach(speaker => {
        if (builders[speaker] && builders[speaker].text.trim()) {
          const completeSentence = {
            id: `${callSid}_${speaker}_${Date.now()}`,
            text: builders[speaker].text.trim(),
            speaker,
            timestamp: new Date().toISOString(),
            confidence: builders[speaker].confidence
          };

          socketClient.emit('completeSentence', { callSid, sentence: completeSentence });
        }
      });
      sentenceBuilders.delete(callSid);
    }
    
    if (deepgramConnection) {
      try {
        deepgramConnection.finish();
      } catch (error) {
        console.error(`❌ Error closing Deepgram connection on error for call ${callSid}:`, error);
      }
      activeConnections.delete(ws);
      if (callSid) {
        activeStreams.delete(callSid);
      }
      deepgramConnection = null;
    }
  });
});

server.on('request', (req, res) => {
  const parsedUrl = parse(req.url, true);

  if (req.method === 'GET' && parsedUrl.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      service: 'transcription-websocket-server',
      status: 'healthy',
      activeStreams: activeStreams.size,
      activeSentenceBuilders: sentenceBuilders.size,
      streams: Array.from(activeStreams.keys()),
      timestamp: new Date().toISOString(),
      deepgramApiKey: process.env.DEEPGRAM_API_KEY ? 'configured' : 'missing'
    }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(port, hostname, () => {
  console.log(`🎙️ Transcription WebSocket Server running on ws://${hostname}:${port}`);
  console.log('📞 Twilio Media Streams WebSocket endpoint: /api/twilio/media-stream');
  console.log('🎵 Real-time Deepgram transcription with speaker identification enabled');
  console.log('🗣️ Sentence building and speaker separation active');
  console.log('🏥 Health check available at /health');
  console.log('🔗 Connecting to main Socket.IO server...');
});

process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  
  activeConnections.forEach((deepgramConnection, ws) => {
    try {
      if (deepgramConnection) {
        deepgramConnection.finish();
      }
      ws.close();
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  });
  
  server.close(() => {
    console.log('✅ Transcription WebSocket Server shut down complete');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  
  activeConnections.forEach((deepgramConnection, ws) => {
    try {
      if (deepgramConnection) {
        deepgramConnection.finish();
      }
      ws.close();
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  });
  
  
  server.close(() => {
    console.log('✅ Transcription WebSocket Server shut down complete');
    process.exit(0);
  });
}); 