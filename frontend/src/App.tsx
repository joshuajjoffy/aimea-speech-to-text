import { useState, useRef, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import './App.css';

export default function App() {
  const [transcript, setTranscript] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [language, setLanguage] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('Select language to start');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

  const socketRef = useRef<Socket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const windowRef = useRef<HTMLDivElement>(null);

  // Apply Dark Mode
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Auto-scroll logic
  useEffect(() => {
    if (windowRef.current) {
      windowRef.current.scrollTop = windowRef.current.scrollHeight;
    }
  }, [transcript, interimTranscript]);

  const startRecording = async () => {
    if (!language) {
      setStatusMessage('Please select a language first!');
      return;
    }

    try {
      setStatusMessage('Requesting microphone...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Smart URL connection
      const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const serverUrl = isLocalHost ? 'http://localhost:3001' : window.location.origin;

      socketRef.current = io(serverUrl, {
        query: { language: language },
        transports: ['websocket']
      });

      socketRef.current.on('connect', () => {
        setStatusMessage('Connected. Listening...');
      });

      // Robust Transcript Parsing
      socketRef.current.on('transcript-result', (data: any) => {
        if (data?.type !== 'Results') return;

        const transcriptText = data?.channel?.alternatives?.[0]?.transcript;
        if (!transcriptText || transcriptText.trim() === '') return;

        if (data.is_final) {
          setTranscript((prev) => prev + transcriptText + ' ');
          setInterimTranscript('');
        } else {
          setInterimTranscript(transcriptText);
        }
      });

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && socketRef.current?.connected) {
          const arrayBuffer = await event.data.arrayBuffer();
          socketRef.current.emit('audio-chunk', arrayBuffer);
        }
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setStatusMessage('Recording...');
    } catch (err) {
      console.error(err);
      setStatusMessage('Microphone access denied.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
    if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
    if (socketRef.current) socketRef.current.disconnect();
    
    setIsRecording(false);
    setLanguage('');
    setStatusMessage('Session ended.');
  };

  return (
    <div className="app-wrapper">
      <div className="aimea-container">
        <header className="aimea-header">
          <div className="aimea-logo-area">
            {isRecording && <div className="pulse-dot"></div>}
            <h1 className="aimea-title">aimea.ai <span>Transcriber</span></h1>
          </div>
          <button className="theme-toggle" onClick={() => setIsDarkMode(!isDarkMode)}>
            {isDarkMode ? '☀️' : '🌙'}
          </button>
        </header>

        <div className="status-bar">{statusMessage}</div>

        <div className="control-panel">
          <button 
            className={`aimea-btn ${isRecording ? 'btn-secondary' : 'btn-primary'}`}
            onClick={isRecording ? stopRecording : startRecording}
          >
            {isRecording ? 'Stop' : 'Start Recording'}
          </button>

          <select className="aimea-select" value={language} onChange={(e) => setLanguage(e.target.value)} disabled={isRecording}>
            <option value="" disabled>-- Select Language --</option>
            <option value="en">English</option>
            <option value="de">German</option>
          </select>
        </div>

        <div className="transcript-window" ref={windowRef}>
          {transcript}
          <span className="interim-text">{interimTranscript}</span>
        </div>
      </div>
    </div>
  );
}