const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", 
  }
});

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

io.on('connection', (socket) => {
  const requestedLanguage = socket.handshake.query.language || 'en';
  console.log(`Frontend connected. Language: ${requestedLanguage}`);

  // Create live connection
  const deepgramLive = deepgram.listen.live({
    model: 'nova-2',
    language: requestedLanguage,
    interim_results: true,
    smart_format: true
  });

  // 1. Listen for audio immediately
  socket.on('audio-chunk', (data) => {
    if (deepgramLive.getReadyState() === 1) { 
      deepgramLive.send(data);
    }
  });

  // 2. Handle transcript results
  deepgramLive.on(LiveTranscriptionEvents.Transcript, (data) => {
    socket.emit('transcript-result', data);
  });

  // 3. Handle errors
  deepgramLive.on(LiveTranscriptionEvents.Error, (err) => {
    console.error('Deepgram Error:', err);
  });

  // 4. Cleanup
  socket.on('disconnect', () => {
    deepgramLive.finish();
    console.log('Frontend disconnected.');
  });
});

const PORT = process.env.PORT || 3001;
const path = require('path');
// Serve the built frontend files
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Send all other requests to the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
});
server.listen(PORT, () => {
  console.log(`Backend is running on http://localhost:${PORT}`);
});