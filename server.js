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
const hostname = 'localhost';
const port = 5000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

global.io = null;

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      const { pathname, query } = parsedUrl;

      if (pathname === '/a') {
        await app.render(req, res, '/a', query);
      } else if (pathname === '/b') {
        await app.render(req, res, '/b', query);
      } else {
        await handle(req, res, parsedUrl);
      }
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });

  const io = new Server(httpServer, {
    cors: {
      origin: dev ? 'http://localhost:3000' : ['https://closemydeals.com', 'https://www.closemydeals.com', process.env.NEXT_PUBLIC_SITE_URL],
      methods: ['GET', 'POST'],
      credentials: true
    },
    allowEIO3: true,
    transports: ['polling', 'websocket'],
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 30000,
    maxHttpBufferSize: 1e8,
    serveClient: false,
    cookie: false
  });

  global.io = io;

  let connectedClients = 0;

  io.on('connection', (socket) => {
    connectedClients++;
    console.log(`✅ User connected: ${socket.id} (Total: ${connectedClients})`);

    socket.on('joinCallRoom', (callSid) => {
      if (callSid) {
        socket.join(`call_${callSid}`);
        console.log(`📞 Socket ${socket.id} joined call room: call_${callSid}`);
        
        socket.emit('joinedCallRoom', { 
          callSid, 
          room: `call_${callSid}`,
          timestamp: new Date().toISOString()
        });
      }
    });

    socket.on('leaveCallRoom', (callSid) => {
      if (callSid) {
        socket.leave(`call_${callSid}`);
        console.log(`📞 Socket ${socket.id} left call room: call_${callSid}`);
      }
    });

    socket.on('heartbeat', (data) => {
      socket.emit('heartbeat_response', { 
        ...data, 
        serverTime: Date.now() 
      });
    });

    // Handle transcription events from the dedicated WebSocket server
    socket.on('transcriptionReady', (data) => {
      console.log(`🎙️ Transcription ready for call ${data.callSid}`);
      io.to(`call_${data.callSid}`).emit('transcriptionReady', data);
    });

    socket.on('liveTranscript', (data) => {
      console.log(`🎙️ Live transcript for call ${data.callSid}: ${data.transcript.text}`);
      io.to(`call_${data.callSid}`).emit('liveTranscript', data.transcript);
    });

    socket.on('completeSentence', (data) => {
      console.log(`🎙️ Complete sentence for call ${data.callSid}: ${data.sentence.text}`);
      io.to(`call_${data.callSid}`).emit('completeSentence', data.sentence);
    });

    socket.on('utteranceEnd', (data) => {
      console.log(`🎙️ Utterance end for call ${data.callSid}`);
      io.to(`call_${data.callSid}`).emit('utteranceEnd', data.data);
    });

    socket.on('speechStarted', (data) => {
      console.log(`🎙️ Speech started for call ${data.callSid}`);
      io.to(`call_${data.callSid}`).emit('speechStarted', data.data);
    });

    socket.on('transcriptionError', (data) => {
      console.error(`❌ Transcription error for call ${data.callSid}:`, data.error);
      io.to(`call_${data.callSid}`).emit('transcriptionError', data.error);
    });

    socket.on('transcriptionEnded', (data) => {
      console.log(`🎙️ Transcription ended for call ${data.callSid}`);
      io.to(`call_${data.callSid}`).emit('transcriptionEnded', data);
    });

    socket.on('disconnect', (reason) => {
      connectedClients--;
      console.log(`❌ User disconnected: ${socket.id} (Total: ${connectedClients}), Reason: ${reason}`);
    });

    socket.on('connect_error', (error) => {
      console.error(`❌ Connection error for ${socket.id}:`, error);
    });

    socket.on('error', (error) => {
      console.error(`❌ Socket error for ${socket.id}:`, error);
    });
  });

  // Health check endpoint
  httpServer.on('request', (req, res) => {
    const parsedUrl = parse(req.url, true);

    if (req.method === 'GET' && parsedUrl.pathname === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        service: 'main-server',
        status: 'healthy',
        connectedClients: connectedClients,
        timestamp: new Date().toISOString()
      }));
      return;
    }
  });

  httpServer.listen(port, () => {
    console.log(`🚀 Ready on http://${hostname}:${port}`);
    console.log('📡 Socket.IO server is running');
    console.log('📞 Real-time Twilio call monitoring active');
    console.log('🏥 Health check available at /api/health');
    console.log('🎙️ Transcription handled by dedicated WebSocket server');
  });
});