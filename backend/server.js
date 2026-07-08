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

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

io.on('connection', (socket) => {
  console.log(`[Socket] User connected: ${socket.id}`);
  const userLang = socket.handshake.query.language || 'en';

  const deepgramLive = deepgram.listen.live({
    model: 'nova-2',
    language: userLang,
    smart_format: true,
  });

  const keepAlive = setInterval(() => {
    if (deepgramLive.getReadyState() === 1) {
      deepgramLive.keepAlive();
    }
  }, 3000);

  deepgramLive.addListener(LiveTranscriptionEvents.Open, () => {
    console.log(`[Deepgram] Connection OPEN for user ${socket.id}`);
    
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

  // THE TRACKER: See the audio arriving!
  let chunkCount = 0;
  socket.on('audio-chunk', (chunk) => {
    chunkCount++;
    if (chunkCount % 10 === 0) {
      console.log(`[Audio Pulse] Received 10 audio chunks from ${socket.id}`);
    }
    
    if (deepgramLive.getReadyState() === 1) {
      deepgramLive.send(chunk); // Now guaranteed to be pure binary
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] User disconnected: ${socket.id}`);
    clearInterval(keepAlive);
    if (deepgramLive.getReadyState() === 1) {
      deepgramLive.finish();
    }
  });
});

app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[Server] Live on port ${PORT}`);
});