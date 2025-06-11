const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'closemydeals.com';
const port = process.env.PORT || 5000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);

      if (req.method === 'POST' && parsedUrl.pathname === '/twilio-stream') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });

        req.on('end', () => {
          const parsedBody = new URLSearchParams(body);
          const callSid = parsedBody.get('CallSid');
          const callStatus = parsedBody.get('CallStatus');
          const from = parsedBody.get('From');
          const to = parsedBody.get('To');

          console.log(`Received call event: SID=${callSid}, Status=${callStatus}, From=${from}, To=${to}`);

          io.emit('callEvent', { callSid, callStatus, from, to });

          res.writeHead(200, { 'Content-Type': 'text/xml' });
          res.end('<Response></Response>');
        });
      } else {
        await handle(req, res, parsedUrl);
      }
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? process.env.NEXT_PUBLIC_SITE_URL
        : ['http://localhost:3000'],
      methods: ['GET', 'POST'],
      credentials: true
    }
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
    console.log(`🟢 User ${socket.userId} connected`);

    socket.on('disconnect', () => {
      console.log(`🔴 User ${socket.userId} disconnected`);
    });

    socket.on('requestTranscriptions', async (callSid) => {
      try {
        const { TranscriptionService } = await import('./lib/transcription-service.js');
        const transcriptionService = new TranscriptionService();
        const transcriptions = await transcriptionService.getTranscriptions(callSid);
        socket.emit('transcriptionsData', { callSid, transcriptions });
      } catch (error) {
        console.error('Error fetching transcriptions:', error);
        socket.emit('transcriptionsError', { callSid, error: error.message });
      }
    });
  });

  global.io = io;

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`🚀 Ready on http://${hostname}:${port}`);
      console.log('📡 Socket.IO server is running');
      console.log('📞 Real-time Twilio call monitoring active');
    });
});