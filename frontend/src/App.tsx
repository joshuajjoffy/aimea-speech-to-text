import { useState, useRef, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import './App.css';

export default function App() {
  const [transcript, setTranscript] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  
  const [language, setLanguage] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('Please select your language');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

  const socketRef = useRef<Socket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  
  // Theme management
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);
  
  // Auto-scroll to latest text
  useEffect(() => {
    if (windowRef.current) {
      windowRef.current.scrollTop = windowRef.current.scrollHeight;
    }
  }, [transcript, interimTranscript]);

  const startRecording = async () => {
    if (!language) {
      setStatusMessage('⚠️ Warning: You must pick a language first!');
      return;
    }

    try {
      setStatusMessage('Requesting mic permissions...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // ---------------------------------------------------------
      // THE FIX: Smart URL Detection for Mobile vs Laptop
      // ---------------------------------------------------------
      const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      
      // If local, use the local backend port. If on Render, use the secure window origin.
      const serverUrl = isLocalHost ? 'http://localhost:3001' : window.location.origin;

      socketRef.current = io(serverUrl, {
        query: { language: language },
        transports: ['websocket', 'polling'] // Ensures compatibility on strict mobile networks
      });

      socketRef.current.on('connect', () => {
        setStatusMessage(`Connected securely | Mode: ${language.toUpperCase()}`);
      });

      // Handle the text coming back from the backend
      socketRef.current.on('transcript-result', (data: any) => {
        if (data?.type !== 'Results') return;

        const transcriptText = data?.channel?.alternatives?.[0]?.transcript;
        if (!transcriptText || transcriptText.trim() === '') return;

        console.log(`🎙️ Heard: "${transcriptText}"`);

        if (data.is_final) {
          setTranscript((prev) => prev + transcriptText + ' ');
          setInterimTranscript('');
        } else {
          setInterimTranscript(transcriptText);
        }
      });

      socketRef.current.on('disconnect', () => {
        setStatusMessage('Disconnected from cloud server');
      });

      // Let the browser pick its native format (Fixes iPhone/Safari blocking WebM)
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && socketRef.current?.connected) {
          socketRef.current.emit('audio-chunk', event.data);
        }
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setIsPaused(false);
      setStatusMessage('Transcribing live...');
    } catch (err) {
      console.error('Error starting streams:', err);
      setStatusMessage('Failed to access microphone. Ensure you are on HTTPS.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    
    setIsRecording(false);
    setIsPaused(false);
    setInterimTranscript('');
    setLanguage(''); 
    setStatusMessage('Session stopped. Resetting language selection...');
  };

  const togglePause = () => {
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      if (isPaused) {
        audioTracks.forEach(track => track.enabled = true);
        setIsPaused(false);
        setStatusMessage('Transcribing live...');
      } else {
        audioTracks.forEach(track => track.enabled = false);
        setIsPaused(true);
        setStatusMessage('Transcription paused');
      }
    }
  };

  const clearTranscript = () => {
    setTranscript('');
    setInterimTranscript('');
    setStatusMessage('Cleared transcript');
  };

  const copyToClipboard = () => {
    if (!transcript) return;
    navigator.clipboard.writeText(transcript.trim());
    setStatusMessage('Copied to clipboard!');
    setTimeout(() => setStatusMessage(isRecording ? 'Transcribing live...' : 'Ready'), 2000);
  };

  const exportTranscript = () => {
    if (!transcript) return;
    const element = document.createElement("a");
    const file = new Blob([transcript.trim()], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `aimea-transcript-${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    setStatusMessage('Exported transcript file');
  };

  return (
    <div className="app-wrapper">
      <div className="aimea-container">
        
        <header className="aimea-header">
          <div className="aimea-logo-area">
            {isRecording && !isPaused && <div className="pulse-dot"></div>}
            <h1 className="aimea-title">aimea.ai <span>Transcriber</span></h1>
          </div>
          
          <button 
            className="theme-toggle" 
            onClick={() => setIsDarkMode(!isDarkMode)}
            title={`Switch to ${isDarkMode ? 'Light' : 'Dark'} Mode`}
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
        </header>

        <div className="status-bar">
          {statusMessage}
        </div>

        <div className="control-panel">
          <button 
            className={`aimea-btn ${isRecording ? 'btn-secondary' : 'btn-primary'}`}
            onClick={isRecording ? stopRecording : startRecording}
          >
            {isRecording ? 'Stop Session' : 'Start Recording'}
          </button>

          <button 
            className="aimea-btn btn-secondary" 
            onClick={togglePause} 
            disabled={!isRecording}
          >
            {isPaused ? 'Resume' : 'Pause'}
          </button>

          <select 
            className="aimea-select"
            value={language} 
            onChange={(e) => setLanguage(e.target.value)} 
            disabled={isRecording}
          >
            <option value="" disabled>-- Choose Language --</option>
            <option value="en">English (US/UK)</option>
            <option value="de">German (Deutsch)</option>
          </select>

          <button 
            className="aimea-btn btn-danger" 
            onClick={clearTranscript} 
            disabled={isRecording || !transcript}
          >
            Clear
          </button>

          <button 
            className="aimea-btn btn-secondary" 
            onClick={copyToClipboard} 
            disabled={!transcript}
          >
            Copy Text
          </button>

          <button 
            className="aimea-btn btn-primary" 
            onClick={exportTranscript} 
            disabled={!transcript}
          >
            Export TXT
          </button>
        </div>

        <div className="transcript-window" ref={windowRef}>
          {transcript || interimTranscript ? (
            <>
              {transcript}
              {interimTranscript && <span className="interim-text"> {interimTranscript}</span>}
            </>
          ) : (
            <div className="empty-state">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
              </svg>
              <p>No audio transcription detected yet.</p>
              <p style={{ fontSize: '0.85rem' }}>You must select your language to unlock recording.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}