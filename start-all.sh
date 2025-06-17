#!/bin/bash

# Start the dedicated WebSocket transcription server
echo "🎙️ Starting WebSocket Transcription Server on port 3001..."
node websocket-server.js &
WEBSOCKET_PID=$!

# Wait a moment for the WebSocket server to start
sleep 2

# Start the main Next.js server
echo "🚀 Starting Main Next.js Server on port 5000..."
node server.js &
MAIN_PID=$!

# Function to handle cleanup on exit
cleanup() {
    echo "🛑 Shutting down servers..."
    kill $WEBSOCKET_PID 2>/dev/null
    kill $MAIN_PID 2>/dev/null
    exit
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

echo "✅ Both servers are running"
echo "🎙️ WebSocket Server PID: $WEBSOCKET_PID (port 3001)"
echo "🚀 Main Server PID: $MAIN_PID (port 5000)"
echo "🌐 Web App: http://localhost:5000"
echo "🎙️ WebSocket: ws://localhost:3001/api/twilio/media-stream"
echo "Press Ctrl+C to stop both servers"

# Wait for both processes
wait 