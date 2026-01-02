
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ClassSelector } from './components/ClassSelector';
import { SmartReader } from './components/SmartReader';
import { AIAssistant } from './components/AIAssistant';
import { AdminPanel } from './components/AdminPanel';
import { LiveService } from './services/liveService';
import { AppState } from './types';
import { Mic, MicOff, AlertCircle, Key, X, Check, ExternalLink } from 'lucide-react';

// Declare process to avoid TypeScript errors in some environments
declare const process: { env: { API_KEY?: string } };

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.HOME);
  const [file, setFile] = useState<File | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // API Key Management
  const [apiKey, setApiKey] = useState<string>(() => {
    return process.env.API_KEY || localStorage.getItem('gemini_api_key') || '';
  });
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tempKey, setTempKey] = useState('');

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

  const handleSaveKey = () => {
    if (tempKey.trim().length > 10) {
      const key = tempKey.trim();
      localStorage.setItem('gemini_api_key', key);
      setApiKey(key);
      setShowKeyModal(false);
      setError(null);
    } else {
      setError("Invalid API Key format");
    }
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
      if (!apiKey) {
        setShowKeyModal(true);
        return;
      }

      setIsConnecting(true);
      setError(null);
      
      try {
        const service = new LiveService({
          apiKey: apiKey,
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
      } catch (err: any) {
        console.error(err);
        if (err.message && err.message.includes('401')) {
            setError("Invalid API Key. Please update it.");
            localStorage.removeItem('gemini_api_key');
            setApiKey('');
        } else {
            setError("Connection failed. Please try again.");
        }
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
                    <span className="truncate max-w-[200px]">{error}</span>
                </div>
             )}
             
             {/* Key Button (Visible if key is set but not live, to allow changing it) */}
             {!isLive && apiKey && (
               <button 
                 onClick={() => setShowKeyModal(true)}
                 className="p-2 text-indigo-200 hover:text-white hover:bg-indigo-500 rounded-full transition-colors"
                 title="Update API Key"
               >
                 <Key size={18} />
               </button>
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
      {state === AppState.CLASSROOM && !isLive && !error && !showKeyModal && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-slate-900/80 text-white px-4 py-2 md:px-6 md:py-3 rounded-full backdrop-blur-sm pointer-events-none fade-in z-10 text-center w-[90%] md:w-auto">
          <p className="text-sm md:text-base">Click "Start" to talk to your Bengali teacher.</p>
        </div>
      )}
      
      {/* Mobile Error Toast */}
      {error && state === AppState.CLASSROOM && !showKeyModal && (
         <div className="md:hidden absolute top-4 left-4 right-4 bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-xl z-50 text-sm shadow-lg flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <p>{error}</p>
         </div>
      )}

      {/* API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md relative">
              <button 
                onClick={() => setShowKeyModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
              
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full">
                  <Key size={24} />
                </div>
                <h3 className="text-xl font-bold text-slate-800">Setup AI Access</h3>
              </div>
              
              <p className="text-slate-500 mb-6 text-sm">
                To activate the AI Tutor, you need a Google Gemini API Key. 
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline ml-1 inline-flex items-center gap-1">
                  Get one here <ExternalLink size={12} />
                </a>
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">API Key</label>
                  <input 
                    type="password" 
                    value={tempKey}
                    onChange={(e) => setTempKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
                  />
                </div>
                
                <button 
                  onClick={handleSaveKey}
                  className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex justify-center items-center gap-2"
                >
                  <Check size={18} />
                  Save & Connect
                </button>
                
                <p className="text-xs text-center text-slate-400">
                  Your key is stored locally in your browser.
                </p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
