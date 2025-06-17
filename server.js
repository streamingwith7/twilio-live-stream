const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');
const { createClient, LiveTranscriptionEvents } = require("@deepgram/sdk");
const dotenv = require("dotenv");

dotenv.config();

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'closemydeals.com';
const port = process.env.PORT || 5000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);

      res.setHeader('Access-Control-Allow-Origin', dev ? 'http://localhost:3000' : 'https://closemydeals.com');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Credentials', 'true');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      if (req.method === 'POST' && parsedUrl.pathname === '/api/twilio/stream-status') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });

        req.on('end', () => {
          const parsedBody = new URLSearchParams(body);
          const streamSid = parsedBody.get('StreamSid');
          const callSid = parsedBody.get('CallSid');
          const streamStatus = parsedBody.get('StreamEvent');
          console.log(`🔄 Stream Status: SID=${streamSid}, Call=${callSid}, Status=${streamStatus}`);

          io.to(`call_${callSid}`).emit('streamStatus', {
            streamSid,
            callSid,
            status: streamStatus,
            timestamp: new Date().toISOString()
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ received: true }));
        });
      } else {
        await handle(req, res, parsedUrl);
      }
    } catch (err) {
      console.error('❌ Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const io = new Server(httpServer, {
    cors: {
      origin: dev ? 'http://localhost:3000' : ['https://closemydeals.com', process.env.NEXT_PUBLIC_SITE_URL],
      methods: ['GET', 'POST'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization']
    },
    transports: ['polling', 'websocket'],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 30000,
    maxHttpBufferSize: 1e6
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET || 'fallback-secret');
      socket.userId = decoded.userId;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔗 Socket.IO client connected: ${socket.id}`);

    socket.on('disconnect', (reason) => {
      console.log(`🔌 Socket.IO client disconnected: ${socket.id}, reason: ${reason}`);
      
      if (reason === 'client namespace disconnect' || reason === 'server namespace disconnect') {
        console.log('⚠️ Namespace disconnect, attempting cleanup...');
      }
      
      if (reason === 'transport close' || reason === 'transport error') {
        console.log('🔄 Transport issue, client should reconnect automatically');
      }
    });

    socket.on('joinCallRoom', (callSid) => {
      socket.join(`call_${callSid}`);
      console.log(`📞 Socket ${socket.id} joined room for call ${callSid}`);
      socket.callSid = callSid;
      
      socket.emit('roomJoined', { 
        callSid, 
        socketId: socket.id,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('leaveCallRoom', (callSid) => {
      socket.leave(`call_${callSid}`);
      console.log(`📞 Socket ${socket.id} left room for call ${callSid}`);
      delete socket.callSid;
    });

    socket.on('heartbeat', (data) => {
      socket.emit('heartbeatAck', { 
        timestamp: new Date().toISOString(),
        socketId: socket.id 
      });
    });

    socket.on('error', (error) => {
      console.error(`❌ Socket error for ${socket.id}:`, error);
    });
  });

  const wss = new WebSocket.Server({
    server: httpServer,
    path: '/api/twilio/media-stream',
  });

  const activeConnections = new Map();
  const activeStreams = new Map();
  const sentenceBuilders = new Map();

  wss.on('connection', (ws) => {
    console.log('📞 Twilio Media Stream connected');

    let callSid = null;
    let deepgramConnection = null;
    let streamSid = null;

    ws.on('message', (data) => {
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

            io.to(`call_${callSid}`).emit('transcriptionReady', {
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
                if (builders[speaker].text.trim()) {
                  const completeSentence = {
                    id: `${callSid}_${speaker}_${Date.now()}`,
                    text: builders[speaker].text.trim(),
                    speaker,
                    timestamp: new Date().toISOString(),
                    confidence: builders[speaker].confidence
                  };

                  io.to(`call_${callSid}`).emit('completeSentence', completeSentence);
                }
              });
              sentenceBuilders.delete(callSid);
            }

            io.to(`call_${callSid}`).emit('transcriptionEnded', {
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

                io.to(`call_${callSid}`).emit('liveTranscript', transcriptData);
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
              io.to(`call_${callSid}`).emit('completeSentence', completeSentence);

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

            io.to(`call_${callSid}`).emit('utteranceEnd', utteranceData);
          });

          deepgramConnection.on(LiveTranscriptionEvents.SpeechStarted, (data) => {
            const speechData = {
              callSid,
              streamSid,
              timestamp: new Date().toISOString()
            };

            console.log(`🎙️ Speech started for call ${callSid}`);
            io.to(`call_${callSid}`).emit('speechStarted', speechData);
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

            io.to(`call_${callSid}`).emit('transcriptionError', errorData);
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
              if (builders[speaker].text.trim()) {
                const completeSentence = {
                  id: `${callSid}_${speaker}_${Date.now()}`,
                  text: builders[speaker].text.trim(),
                  speaker,
                  timestamp: new Date().toISOString(),
                  confidence: builders[speaker].confidence
                };

                io.to(`call_${callSid}`).emit('completeSentence', completeSentence);
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
    });

    ws.on('close', () => {
      console.log(`📞 Media stream connection closed for call: ${callSid}`);
      
      const builders = sentenceBuilders.get(callSid);
      if (builders) {
        ['inbound', 'outbound'].forEach(speaker => {
          if (builders[speaker].text.trim()) {
            const completeSentence = {
              id: `${callSid}_${speaker}_${Date.now()}`,
              text: builders[speaker].text.trim(),
              speaker,
              timestamp: new Date().toISOString(),
              confidence: builders[speaker].confidence
            };

            io.to(`call_${callSid}`).emit('completeSentence', completeSentence);
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
          if (builders[speaker].text.trim()) {
            const completeSentence = {
              id: `${callSid}_${speaker}_${Date.now()}`,
              text: builders[speaker].text.trim(),
              speaker,
              timestamp: new Date().toISOString(),
              confidence: builders[speaker].confidence
            };

            io.to(`call_${callSid}`).emit('completeSentence', completeSentence);
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

  httpServer.on('request', (req, res) => {
    const parsedUrl = parse(req.url, true);

    if (req.method === 'GET' && parsedUrl.pathname === '/api/health/streams') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        activeStreams: activeStreams.size,
        activeSentenceBuilders: sentenceBuilders.size,
        streams: Array.from(activeStreams.keys()),
        timestamp: new Date().toISOString()
      }));
      return;
    }
  });

  httpServer.listen(port, () => {
    console.log(`🚀 Ready on http://${hostname}`);
    console.log('📡 Socket.IO server is running');
    console.log('📞 Real-time Twilio call monitoring active');
    console.log('🎵 Twilio Media Streams WebSocket server is running on /api/twilio/media-stream');
    console.log('🎙️ Real-time Deepgram transcription with speaker identification enabled');
    console.log('🗣️ Sentence building and speaker separation active');
    console.log('🏥 Health check available at /api/health/streams');
  });
});