const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Initialize Deepgram Client
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

io.on('connection', (socket) => {
  console.log(`[Socket] User connected: ${socket.id}`);
  
  // 1. Get the language the user selected (defaults to English)
  const userLang = socket.handshake.query.language || 'en';

  // 2. Create a FRESH Deepgram connection for this specific user
  const deepgramLive = deepgram.listen.live({
    model: 'nova-2',
    language: userLang,
    smart_format: true,
    // We intentionally leave out 'encoding' so Deepgram auto-detects what the browser sends
  });

  // 3. KeepAlive Heartbeat (Prevents the 10-second silent disconnect)
  const keepAlive = setInterval(() => {
    if (deepgramLive.getReadyState() === 1) {
      deepgramLive.keepAlive();
    }
  }, 3000);

  // 4. Handle Deepgram Events
  deepgramLive.addListener(LiveTranscriptionEvents.Open, () => {
    console.log(`[Deepgram] Connection OPEN for user ${socket.id}`);
    
    // When Deepgram hears words, send them back to the React frontend
    deepgramLive.addListener(LiveTranscriptionEvents.Transcript, (data) => {
      socket.emit('transcript-result', data);
    });

    deepgramLive.addListener(LiveTranscriptionEvents.Error, (err) => {
      console.error('[Deepgram] Error:', err);
    });

    deepgramLive.addListener(LiveTranscriptionEvents.Close, () => {
      console.log(`[Deepgram] Connection CLOSED for user ${socket.id}`);
      clearInterval(keepAlive);
    });
  });

  // 5. When the React frontend sends audio, pass it to Deepgram
  socket.on('audio-chunk', (chunk) => {
    if (deepgramLive.getReadyState() === 1) {
      deepgramLive.send(chunk);
    }
  });

  // 6. Cleanup when user clicks "Stop" or closes the browser
  socket.on('disconnect', () => {
    console.log(`[Socket] User disconnected: ${socket.id}`);
    clearInterval(keepAlive);
    if (deepgramLive.getReadyState() === 1) {
      deepgramLive.finish();
    }
  });
});

// Serve the React frontend production files
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[Server] Live on port ${PORT}`);
});