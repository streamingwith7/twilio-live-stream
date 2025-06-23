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
          
          // Only emit stream status to specific call room, not broadcast
          if (callSid) {
            io.to(`call_${callSid}`).emit('streamStatus', { 
              streamSid, 
              callSid, 
              status: streamStatus,
              timestamp: new Date().toISOString()
            });
          }
          
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
  // Socket.IO Server Setup with Room Management
  // Supports both call rooms and transcription rooms for organized event handling
  const io = new Server(httpServer, {
    cors: {
      origin: dev ? 'http://localhost:5000' : process.env.NEXT_PUBLIC_SITE_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Make io available globally for webhook routes
  global.io = io;
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }
    try {
      const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET || 'fallback-secret');
      socket.userId = decoded.userId;
      socket.handshake.auth.identity = decoded.userId;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });
  io.on('connection', (socket) => {
    console.log(`🔗 Socket.IO client connected: ${socket.id}`);
    socket.on('disconnect', () => {
      console.log(`🔌 Socket.IO client disconnected: ${socket.id}`);
    });
    
    socket.on('joinCallRoom', (callSid) => {
      socket.join(`call_${callSid}`);
      console.log(`📞 Socket ${socket.id} joined room for call ${callSid}`);
      socket.emit('roomJoined', { room: `call_${callSid}`, type: 'call' });
    });
    
    socket.on('leaveCallRoom', (callSid) => {
      socket.leave(`call_${callSid}`);
      console.log(`📞 Socket ${socket.id} left room for call ${callSid}`);
      socket.emit('roomLeft', { room: `call_${callSid}`, type: 'call' });
    });

    // Coaching room handlers
    socket.on('joinCoachingRoom', (callSid) => {
      if (!callSid) {
        socket.emit('coachingRoomError', { error: 'CallSid is required' });
        return;
      }
      
      const coachingRoom = `coaching_${callSid}`;
      socket.join(coachingRoom);
      console.log(`🤖 Socket ${socket.id} joined coaching room for call ${callSid}`);
      
      socket.emit('coachingRoomJoined', { 
        callSid, 
        room: coachingRoom,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('leaveCoachingRoom', (callSid) => {
      if (!callSid) {
        socket.emit('coachingRoomError', { error: 'CallSid is required' });
        return;
      }
      
      const coachingRoom = `coaching_${callSid}`;
      socket.leave(coachingRoom);
      console.log(`🤖 Socket ${socket.id} left coaching room for call ${callSid}`);
      
      socket.emit('coachingRoomLeft', { 
        callSid, 
        room: coachingRoom,
        timestamp: new Date().toISOString()
      });
    });

    // Transcription room handlers
    socket.on('joinTranscriptionRoom', (callSid) => {
      if (!callSid) {
        socket.emit('transcriptionRoomError', { error: 'CallSid is required' });
        return;
      }
      
      const transcriptionRoom = `transcription_${callSid}`;
      socket.join(transcriptionRoom);
      console.log(`🎙️ Socket ${socket.id} joined transcription room for call ${callSid}`);
      
      // Notify the client they've joined the transcription room
      socket.emit('transcriptionRoomJoined', { 
        callSid, 
        room: transcriptionRoom,
        timestamp: new Date().toISOString()
      });

      // If there's an active transcription stream for this call, notify the client
      const activeStream = activeStreams.get(callSid);
      if (activeStream) {
        socket.emit('transcriptionReady', {
          callSid,
          streamSid: activeStream.streamSid,
          timestamp: new Date().toISOString(),
          status: 'active'
        });
      }
    });

    socket.on('leaveTranscriptionRoom', (callSid) => {
      if (!callSid) {
        socket.emit('transcriptionRoomError', { error: 'CallSid is required' });
        return;
      }
      
      const transcriptionRoom = `transcription_${callSid}`;
      socket.leave(transcriptionRoom);
      console.log(`🎙️ Socket ${socket.id} left transcription room for call ${callSid}`);
      
      socket.emit('transcriptionRoomLeft', { 
        callSid, 
        room: transcriptionRoom,
        timestamp: new Date().toISOString()
      });
    });

    // Request transcription status for a specific call
    socket.on('requestTranscriptionStatus', (callSid) => {
      if (!callSid) {
        socket.emit('transcriptionStatusError', { error: 'CallSid is required' });
        return;
      }

      const activeStream = activeStreams.get(callSid);
      if (activeStream) {
        socket.emit('transcriptionStatus', {
          callSid,
          streamSid: activeStream.streamSid,
          status: 'active',
          startTime: activeStream.startTime,
          timestamp: new Date().toISOString()
        });
      } else {
        socket.emit('transcriptionStatus', {
          callSid,
          status: 'inactive',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Heartbeat handler for connection monitoring
    socket.on('heartbeat', (data) => {
      socket.emit('heartbeatAck', { 
        clientTimestamp: data.timestamp,
        serverTimestamp: Date.now()
      });
    });

    // Get list of active transcription sessions
    socket.on('getActiveTranscriptions', () => {
      const activeTranscriptions = Array.from(activeStreams.entries()).map(([callSid, stream]) => ({
        callSid,
        streamSid: stream.streamSid,
        startTime: stream.startTime,
        timestamp: new Date().toISOString()
      }));

      socket.emit('activeTranscriptions', {
        transcriptions: activeTranscriptions,
        count: activeTranscriptions.length,
        timestamp: new Date().toISOString()
      });
    });
  });
  const wss = new WebSocket.Server({
    server: httpServer,
    path: '/api/twilio/media-stream',
  });
  const activeConnections = new Map();
  const activeStreams = new Map(); // Track active streams by callSid
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
          
          const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
          
          deepgramConnection = deepgram.listen.live({
            model: "nova-2",
            language: "en-US",
            smart_format: true,
            encoding: "mulaw",
            channels: 1,
            sample_rate: 8000,
            interim_results: true,
            utterance_end_ms: "1000",
            vad_events: true,
            endpointing: 300,
            punctuate: true,
            profanity_filter: false,
            redact: false,
            diarize: false,
            multichannel: false,
            alternatives: 1,
            numerals: true
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
            
            // Only notify specific call room and transcription room, not broadcast
            io.to(`call_${callSid}`).emit('transcriptionReady', { 
              callSid, 
              streamSid,
              timestamp: new Date().toISOString()
            });
            
            io.to(`transcription_${callSid}`).emit('transcriptionReady', { 
              callSid, 
              streamSid,
              timestamp: new Date().toISOString()
            });
          });
          deepgramConnection.on(LiveTranscriptionEvents.Close, () => {
            console.log(`🎙️ Deepgram connection closed for call ${callSid}`);
            
            // Only notify specific call room and transcription room, not broadcast
            io.to(`call_${callSid}`).emit('transcriptionEnded', { 
              callSid, 
              streamSid,
              timestamp: new Date().toISOString()
            });
            
            io.to(`transcription_${callSid}`).emit('transcriptionEnded', { 
              callSid, 
              streamSid,
              timestamp: new Date().toISOString()
            });
          });
          deepgramConnection.on(LiveTranscriptionEvents.Transcript, (data) => {
            const transcript = data.channel.alternatives[0].transcript;
            const isInterim = data.is_final === false;
            const confidence = data.channel.alternatives[0].confidence;
            
            if (transcript && transcript.trim().length > 0) {
              const transcriptData = { 
                callSid, 
                streamSid,
                text: transcript,
                type: isInterim ? 'interim' : 'final',
                confidence: confidence || 0,
                timestamp: new Date().toISOString(),
                words: data.channel.alternatives[0].words || []
              };
              if (!isInterim) {
                console.log(`🎙️ Final Transcript [${callSid}]:`, transcript);
              }
              
              // Only emit to specific call room and transcription room, not broadcast
              io.to(`call_${callSid}`).emit('liveTranscript', transcriptData);
              io.to(`transcription_${callSid}`).emit('liveTranscript', transcriptData);
            }
          });
          deepgramConnection.on(LiveTranscriptionEvents.UtteranceEnd, (data) => {
            const utteranceData = { 
              callSid, 
              streamSid,
              timestamp: new Date().toISOString()
            };
            
            console.log(`🎙️ Utterance end for call ${callSid}`);
            // Only emit to specific call room and transcription room, not broadcast
            io.to(`call_${callSid}`).emit('utteranceEnd', utteranceData);
            io.to(`transcription_${callSid}`).emit('utteranceEnd', utteranceData);
          });
          deepgramConnection.on(LiveTranscriptionEvents.SpeechStarted, (data) => {
            const speechData = { 
              callSid, 
              streamSid,
              timestamp: new Date().toISOString()
            };
            
            console.log(`🎙️ Speech started for call ${callSid}`);
            // Only emit to specific call room and transcription room, not broadcast
            io.to(`call_${callSid}`).emit('speechStarted', speechData);
            io.to(`transcription_${callSid}`).emit('speechStarted', speechData);
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
            
            // Only emit to specific call room and transcription room, not broadcast
            io.to(`call_${callSid}`).emit('transcriptionError', errorData);
            io.to(`transcription_${callSid}`).emit('transcriptionError', errorData);
          });
          break;
        case 'media':
          if (deepgramConnection && deepgramConnection.getReadyState() === 1) {
            try {
              const audioBuffer = Buffer.from(message.media.payload, 'base64');
              deepgramConnection.send(audioBuffer);
            } catch (error) {
              console.error(`❌ Error sending audio to Deepgram for call ${callSid}:`, error);
            }
          }
          break;
        case 'stop':
          console.log(`🛑 Media stream stopped for call: ${callSid}`);
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
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('🛑 Shutting down gracefully...');
    
    // Close all active Deepgram connections
    for (const [ws, deepgramConnection] of activeConnections) {
      try {
        deepgramConnection.finish();
      } catch (error) {
        console.error('❌ Error closing Deepgram connection during shutdown:', error);
      }
    }
    
    activeConnections.clear();
    activeStreams.clear();
    
    httpServer.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });
  // Health check endpoint for active streams
  httpServer.on('request', (req, res) => {
    const parsedUrl = parse(req.url, true);
    
    if (req.method === 'GET' && parsedUrl.pathname === '/api/health/streams') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        activeStreams: activeStreams.size,
        streams: Array.from(activeStreams.keys()),
        timestamp: new Date().toISOString()
      }));
      return;
    }
  });
  httpServer.listen(port, () => {
    console.log(`🚀 Ready on https://${hostname}`);
    console.log('📡 Socket.IO server is running');
    console.log('📞 Real-time Twilio call monitoring active');
    console.log('🎵 Twilio Media Streams WebSocket server is running on /api/twilio/media-stream');
    console.log('🎙️ Real-time Deepgram transcription enabled');
    console.log('🏥 Health check available at /api/health/streams');
  });
});