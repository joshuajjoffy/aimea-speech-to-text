import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const App = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false); 
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [language, setLanguage] = useState('en'); 
  
  // New state to force a socket reconnection
  const [reconnectKey, setReconnectKey] = useState(0); 
  
  const socketRef = useRef<Socket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    // Reconnect whenever language OR reconnectKey changes
    socketRef.current = io({
  query: { language: language }
});

    socketRef.current.on('transcript-result', (data: any) => {
      const transcriptText = data?.channel?.alternatives[0]?.transcript;
      if (transcriptText) {
        if (data.is_final) {
          setTranscript((prev) => prev + transcriptText + ' ');
          setInterimTranscript('');
        } else {
          setInterimTranscript(transcriptText);
        }
      }
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [language, reconnectKey]); // Added reconnectKey to dependencies

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0 && socketRef.current) {
          socketRef.current.emit('audio-chunk', event.data);
        }
      };

      mediaRecorderRef.current.start(250);
      setIsRecording(true);
      setIsPaused(false); 
    } catch (error) {
      alert('Microphone access denied.');
    }
  };

  const togglePause = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
      const audioTracks = mediaRecorderRef.current.stream.getAudioTracks();
      
      if (isPaused) {
        audioTracks.forEach(track => track.enabled = true);
        setIsPaused(false);
      } else {
        audioTracks.forEach(track => track.enabled = false);
        setIsPaused(true);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    setIsRecording(false);
    setIsPaused(false); 
    setInterimTranscript('');
  };

  const clearTranscript = () => {
    setTranscript('');
    setInterimTranscript('');
    // Incrementing this triggers the useEffect to cleanly disconnect and reconnect
    setReconnectKey((prev) => prev + 1); 
  };

  const exportTranscript = () => {
    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Mea_AI_Transcript.txt';
    link.click();
  };

  return (
    // Inside your return statement:
<div className="container">
  <h1>aimea.ai Transcriber</h1>
  
  <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
    <button className={`btn ${isRecording ? 'btn-secondary' : 'btn-primary'}`} 
            onClick={isRecording ? stopRecording : startRecording}>
      {isRecording ? 'Stop' : 'Start'}
    </button>
    
    {/* Add the 'btn' and 'btn-secondary' class to your other buttons too */}
    <button className="btn btn-secondary" onClick={togglePause} disabled={!isRecording}>
      {isPaused ? 'Resume' : 'Pause'}
    </button>
    
    <select className="btn btn-secondary" value={language} onChange={(e) => setLanguage(e.target.value)} disabled={isRecording}>
      <option value="en">English</option>
      <option value="de">German</option>
    </select>
    
    <button className="btn btn-secondary" onClick={clearTranscript} disabled={isRecording}>Clear</button>
    <button className="btn btn-primary" onClick={exportTranscript} disabled={!transcript}>Export</button>
  </div>

  <div className="transcript-box">
    {transcript} <i>{interimTranscript}</i>
  </div>
</div>
  );
};

export default App;