import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ClassSelector } from './components/ClassSelector';
import { SmartReader } from './components/SmartReader';
import { AIAssistant } from './components/AIAssistant';
import { AdminPanel } from './components/AdminPanel';
import { LiveService } from './services/liveService';
import { AppState } from './types';
import { Mic, MicOff, AlertCircle } from 'lucide-react';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.HOME);
  const [file, setFile] = useState<File | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Advanced AI State
  const [aiAudioLevel, setAiAudioLevel] = useState(0);
  const [userAudioLevel, setUserAudioLevel] = useState(0);
  const [aiTranscript, setAiTranscript] = useState('');
  const [userTranscript, setUserTranscript] = useState('');

  const liveServiceRef = useRef<LiveService | null>(null);
  const lastPageTextRef = useRef<string>('');

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setState(AppState.CLASSROOM);
  };

  const toggleLiveSession = async () => {
    if (isLive) {
      // Disconnect
      if (liveServiceRef.current) {
        await liveServiceRef.current.disconnect();
        liveServiceRef.current = null;
      }
      setIsLive(false);
      setAiTranscript('');
      setUserTranscript('');
    } else {
      // Connect
      if (!process.env.API_KEY) {
        setError("API Key not found in environment.");
        return;
      }

      setIsConnecting(true);
      setError(null);
      
      try {
        const service = new LiveService({
          apiKey: process.env.API_KEY,
          onAudioLevel: (level, source) => {
             if (source === 'user') setUserAudioLevel(level);
             else setAiAudioLevel(level);
          },
          onTranscription: (text, source, isFinal) => {
             if (source === 'user') setUserTranscript(text);
             else {
                setAiTranscript(text);
             }
          }
        });
        
        await service.connect();
        liveServiceRef.current = service;
        
        // If we already have page text, send it now
        if (lastPageTextRef.current) {
            service.sendPageContext(lastPageTextRef.current);
        }
        
        setIsLive(true);
      } catch (err) {
        console.error(err);
        setError("Failed to connect. Check internet/API key.");
      } finally {
        setIsConnecting(false);
      }
    }
  };

  const handleFrameCapture = useCallback((base64: string) => {
    if (isLive && liveServiceRef.current) {
      liveServiceRef.current.sendImageFrame(base64).catch(e => console.error("Frame send error", e));
    }
  }, [isLive]);

  const handlePageText = useCallback((text: string) => {
    lastPageTextRef.current = text;
    if (isLive && liveServiceRef.current) {
        liveServiceRef.current.sendPageContext(text).catch(e => console.error("Context send error", e));
    }
  }, [isLive]);

  return (
    <div className="h-full flex flex-col">
      {/* Header / Nav */}
      <nav className="bg-indigo-600 text-white p-3 md:p-4 flex justify-between items-center shadow-md z-20 shrink-0">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setState(AppState.HOME)}>
           <span className="font-bold text-lg md:text-xl tracking-tight truncate">BanglaGenius</span>
           <span className="bg-indigo-500 text-[10px] md:text-xs px-1.5 py-0.5 rounded">Beta</span>
        </div>
        
        {state === AppState.CLASSROOM && (
          <div className="flex items-center gap-2 md:gap-4">
             {error && (
                <div className="hidden md:flex items-center gap-2 text-red-200 text-sm animate-pulse">
                    <AlertCircle size={16} />
                    <span className="truncate max-w-[150px]">{error}</span>
                </div>
             )}
             
             {/* Only show connect button if NOT live */}
             {!isLive && (
                <button
                  onClick={toggleLiveSession}
                  disabled={isConnecting}
                  className={`flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full font-semibold transition-all shadow-lg bg-white text-indigo-600 hover:bg-indigo-50 text-sm md:text-base ${isConnecting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isConnecting ? (
                    <span>Connecting...</span>
                  ) : (
                    <>
                      <Mic size={16} className="md:w-[18px] md:h-[18px]" />
                      <span className="hidden sm:inline">Start AI Tutor</span>
                      <span className="sm:hidden">Start</span>
                    </>
                  )}
                </button>
             )}
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        {state === AppState.HOME && (
          <div className="h-full flex items-center justify-center bg-slate-50 overflow-y-auto">
            <ClassSelector 
              onFileSelect={handleFileSelect} 
              onAdminClick={() => setState(AppState.ADMIN)}
            />
          </div>
        )}

        {state === AppState.ADMIN && (
          <div className="h-full overflow-y-auto">
             <AdminPanel onBack={() => setState(AppState.HOME)} />
          </div>
        )}

        {state === AppState.CLASSROOM && file && (
          <SmartReader 
            file={file} 
            onFrameCapture={handleFrameCapture} 
            onPageText={handlePageText}
            isLive={isLive}
          />
        )}
      </main>
      
      {/* Premium AI Overlay */}
      <AIAssistant 
        isActive={isLive}
        userAudioLevel={userAudioLevel}
        aiAudioLevel={aiAudioLevel}
        aiTranscript={aiTranscript}
        userTranscript={userTranscript}
        onDisconnect={toggleLiveSession}
      />
      
      {/* Overlay Instructions for Classroom (Only when inactive) */}
      {state === AppState.CLASSROOM && !isLive && !error && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-slate-900/80 text-white px-4 py-2 md:px-6 md:py-3 rounded-full backdrop-blur-sm pointer-events-none fade-in z-10 text-center w-[90%] md:w-auto">
          <p className="text-sm md:text-base">Click "Start" to talk to your Bengali teacher.</p>
        </div>
      )}
    </div>
  );
};

export default App;