const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')
const jwt = require('jsonwebtoken')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = 3000

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  // Initialize Socket.IO
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:3000'],
      methods: ['GET', 'POST']
    }
  })

  // Authentication middleware for Socket.IO
  io.use((socket, next) => {
    const token = socket.handshake.auth.token
    if (!token) {
      return next(new Error('Authentication error'))
    }

    try {
      const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET || 'fallback-secret')
      socket.userId = decoded.userId
      next()
    } catch (err) {
      next(new Error('Authentication error'))
    }
  })

  // Socket.IO connection handling
  io.on('connection', (socket) => {
    console.log(`🟢 User ${socket.userId} connected`)

    socket.on('disconnect', () => {
      console.log(`🔴 User ${socket.userId} disconnected`)
    })

    // Handle requesting call transcriptions
    socket.on('requestTranscriptions', async (callSid) => {
      try {
        const { TranscriptionService } = await import('./lib/transcription-service.js')
        const transcriptionService = new TranscriptionService()
        const transcriptions = await transcriptionService.getTranscriptions(callSid)
        socket.emit('transcriptionsData', { callSid, transcriptions })
      } catch (error) {
        console.error('Error fetching transcriptions:', error)
        socket.emit('transcriptionsError', { callSid, error: error.message })
      }
    })
  })

  // Store io instance globally for use in API routes
  global.io = io

  httpServer
    .once('error', (err) => {
      console.error(err)
      process.exit(1)
    })
    .listen(port, () => {
      console.log(`🚀 Ready on http://${hostname}:${port}`)
      console.log('📡 Socket.IO server is running')
      console.log('📞 Real-time Twilio call monitoring active')
    })
}) 