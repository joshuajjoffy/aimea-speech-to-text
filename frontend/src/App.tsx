import { useState, useRef, useEffect } from 'react';
import { io } from 'socket.io-client';
import './App.css';

export default function App() {
  const [transcript, setTranscript] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [language, setLanguage] = useState<string>('en');
  const [statusMessage, setStatusMessage] = useState<string>('Ready to transcribe');

  const socketRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Auto scroll down as text aggregates
  const windowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (windowRef.current) {
      windowRef.current.scrollTop = windowRef.current.scrollHeight;
    }
  }, [transcript, interimTranscript]);

  const startRecording = async () => {
    try {
      setStatusMessage('Requesting mic permissions...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // FIX: Connecting relatively ensures socket works on both laptop and mobile
      socketRef.current = io({
        query: { language: language }
      });

      socketRef.current.on('connect', () => {
        setStatusMessage('Connected to live transcription server');
      });

      socketRef.current.on('transcript-data', (data: any) => {
        if (data.isFinal) {
          setTranscript((prev) => prev + ' ' + data.text);
          setInterimTranscript('');
        } else {
          setInterimTranscript(data.text);
        }
      });

      socketRef.current.on('disconnect', () => {
        setStatusMessage('Disconnected from server');
      });

      const options = { mimeType: 'audio/webm' };
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && socketRef.current?.connected && !isPaused) {
          socketRef.current.emit('audio-stream', event.data);
        }
      };

      // Stream data packets every 250ms to keep live latency tight
      mediaRecorder.start(250);
      setIsRecording(true);
      setIsPaused(false);
      setStatusMessage('Transcribing live...');
    } catch (err) {
      console.error('Error starting streams:', err);
      setStatusMessage('Failed to access microphone or connect');
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
    setStatusMessage('Session ended');
  };

  const togglePause = () => {
    if (!isRecording) return;
    if (isPaused) {
      setIsPaused(false);
      setStatusMessage('Transcribing live...');
    } else {
      setIsPaused(true);
      setInterimTranscript('');
      setStatusMessage('Transcription paused');
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
    setTimeout(() => setStatusMessage(isRecording ? 'Transcribing live...' : 'Session ended'), 2000);
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
        </header>

        <div className="status-bar">
          Status: {statusMessage}
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
              <p style={{ fontSize: '0.85rem' }}>Select your language and tap <b>Start Recording</b>.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}