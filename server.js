const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');
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
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('❌ Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });
  const io = new Server(httpServer, {
    cors: {
      origin: dev ? 'http://localhost:5000' : process.env.NEXT_PUBLIC_SITE_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  global.io = io;
  io.use((socket, next) => {
    console.log(socket.handshake.auth);
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
      console.log(err);
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
      socket.emit('roomJoined', { room: `call_${callSid}`, type: 'call' });
    });

    socket.on('leaveCallRoom', (callSid) => {
      socket.leave(`call_${callSid}`);
      socket.emit('roomLeft', { room: `call_${callSid}`, type: 'call' });
    });

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

    socket.on('joinTranscriptionRoom', (callSid) => {
      if (!callSid) {
        socket.emit('transcriptionRoomError', { error: 'CallSid is required' });
        return;
      }

      const transcriptionRoom = `transcription_${callSid}`;
      socket.join(transcriptionRoom);
      console.log(`🎙️ Socket ${socket.id} joined transcription room for call ${callSid}`);
      socket.emit('transcriptionRoomJoined', {
        callSid,
        room: transcriptionRoom,
        timestamp: new Date().toISOString()
      });

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

    socket.on('joinStrategyRoom', (callSid) => {
      if (!callSid) {
        socket.emit('strategyRoomError', { error: 'CallSid is required' });
        return;
      }

      const strategyRoom = `strategy_${callSid}`;
      socket.join(strategyRoom);
      console.log(`🎯 Socket ${socket.id} joined strategy room for call ${callSid}`);

      socket.emit('strategyRoomJoined', {
        callSid,
        room: strategyRoom,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('leaveStrategyRoom', (callSid) => {
      if (!callSid) {
        socket.emit('strategyRoomError', { error: 'CallSid is required' });
        return;
      }

      const strategyRoom = `strategy_${callSid}`;
      socket.leave(strategyRoom);
      console.log(`🎯 Socket ${socket.id} left strategy room for call ${callSid}`);
      socket.emit('strategyRoomLeft', {
        callSid,
        room: strategyRoom,
        timestamp: new Date().toISOString()
      });
    });

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

    socket.on('heartbeat', (data) => {
      socket.emit('heartbeatAck', {
        clientTimestamp: data.timestamp,
        serverTimestamp: Date.now()
      });
    });

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
  const activeStreams = new Map();

  wss.on('connection', (ws) => {
    console.log('📞 Twilio Media Stream connected');
  });

  httpServer.listen(port, () => {
    console.log(`🚀 Ready on https://${hostname}`);
    console.log('📡 Socket.IO server is running');
    console.log('📞 Real-time Twilio call monitoring active');
    console.log('🎵 Twilio Media Streams WebSocket server is running on /api/twilio/media-stream');
  });
});