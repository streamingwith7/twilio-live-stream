const WebSocket = require('ws');

// Start a WebSocket server on port 3000
const wss = new WebSocket.Server({ port: 3000 });

wss.on('connection', function connection(ws) {
  console.log('🔌 New Twilio stream connected');

  ws.on('message', function incoming(message) {
    const data = JSON.parse(message);

    if (data.event === 'start') {
      console.log('🟢 Stream started');
    } else if (data.event === 'media') {
      console.log('🎧 Received audio chunk');
    } else if (data.event === 'stop') {
      console.log('🔴 Stream stopped');
    }
  });
});
