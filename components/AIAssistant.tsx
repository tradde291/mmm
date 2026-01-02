
import React, { useMemo } from 'react';
import { Sparkles, Mic, VolumeX, X, Zap, Eye } from 'lucide-react';

interface AIAssistantProps {
  isActive: boolean;
  userAudioLevel: number;
  aiAudioLevel: number;
  aiTranscript: string;
  userTranscript: string;
  onDisconnect: () => void;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ 
  isActive, 
  userAudioLevel, 
  aiAudioLevel, 
  aiTranscript, 
  userTranscript,
  onDisconnect 
}) => {
  if (!isActive) return null;

  const isAiSpeaking = aiAudioLevel > 0.04;
  const isUserSpeaking = userAudioLevel > 0.04;
  const isAmbientNoise = userAudioLevel > 0.005 && userAudioLevel <= 0.04;

  // Calculate dynamic scale for the fluid orb
  const userScale = 1 + userAudioLevel * 2.5;
  const aiScale = 1 + aiAudioLevel * 3;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 pointer-events-none p-4 md:p-8 flex flex-col items-center justify-end">
      
      {/* 1. Advanced Transcription HUD (Glassmorphism) */}
      {(aiTranscript || userTranscript) && (
        <div className="mb-8 w-full max-w-2xl animate-in slide-in-from-bottom-8 fade-in duration-500">
           <div className="bg-slate-900/40 backdrop-blur-2xl p-5 md:p-6 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/10 ring-1 ring-white/20">
              {aiTranscript && (
                <div className="mb-3">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                        <span className="text-rose-300 text-[10px] font-black uppercase tracking-[0.2em]">BanglaGenius AI</span>
                    </div>
                    <p className="text-base md:text-lg text-white font-medium leading-relaxed drop-shadow-sm">
                        {aiTranscript}
                    </p>
                </div>
              )}
              {userTranscript && (
                 <div className="mt-4 text-right border-t border-white/5 pt-4">
                    <span className="text-indigo-300/60 text-[10px] font-bold uppercase tracking-wider mb-2 block">আপনার প্রশ্ন</span>
                    <p className="text-sm md:text-base text-indigo-100 italic font-light">"{userTranscript}"</p>
                 </div>
              )}
           </div>
        </div>
      )}

      {/* 2. The Premium Command Center (The Orb) */}
      <div className="pointer-events-auto flex items-center gap-6 bg-white/90 backdrop-blur-xl px-6 py-4 rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-white/50 animate-in zoom-in-95 duration-500 ring-1 ring-black/5 mb-4">
        
        {/* Fluid Visualizer Orb */}
        <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
            {/* Outer Glow Layer */}
            <div 
                className={`absolute inset-0 rounded-full blur-2xl transition-all duration-700 opacity-40 ${isAiSpeaking ? 'bg-rose-500' : isUserSpeaking ? 'bg-indigo-500' : 'bg-violet-400'}`}
                style={{ transform: `scale(${isAiSpeaking ? aiScale * 1.5 : userScale * 1.2})` }}
            />

            {/* Reactive Pulse Rings */}
            <div 
                className={`absolute inset-0 rounded-full border-2 transition-all duration-150 ${isAiSpeaking ? 'border-rose-400/30' : 'border-indigo-400/30'}`}
                style={{ transform: `scale(${isAiSpeaking ? aiScale * 1.8 : userScale * 1.4})` }}
            />
            
            {/* Core Fluid Sphere */}
            <div 
              className={`relative z-10 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-2xl transition-all duration-500 overflow-hidden
                ${isAiSpeaking ? 'bg-gradient-to-tr from-rose-600 to-orange-500 rotate-12' : 
                  isUserSpeaking ? 'bg-gradient-to-tr from-indigo-600 to-violet-500 -rotate-12' : 
                  'bg-gradient-to-tr from-slate-800 to-slate-900'}`}
            >
                {/* Internal Animation Layers */}
                <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)] animate-pulse" />
                
                {isAiSpeaking ? (
                  <Sparkles size={24} className="animate-bounce" />
                ) : isAmbientNoise ? (
                  <VolumeX size={22} className="opacity-50" />
                ) : (
                  <Mic size={24} className={isUserSpeaking ? 'scale-125 animate-pulse' : ''} />
                )}
            </div>
        </div>

        {/* Dynamic Status & Controls */}
        <div className="flex flex-col min-w-[140px]">
            <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-black uppercase tracking-widest ${isAiSpeaking ? 'text-rose-500' : 'text-indigo-600'}`}>
                    {isAiSpeaking ? 'Speaking' : isUserSpeaking ? 'Listening' : 'Ready'}
                </span>
                <div className="flex gap-0.5">
                    {[1, 2, 3].map(i => (
                        <div key={i} className={`w-1 h-3 rounded-full transition-all duration-150 ${isAiSpeaking ? 'bg-rose-400' : isUserSpeaking ? 'bg-indigo-400' : 'bg-slate-200'}`} 
                             style={{ height: (isAiSpeaking || isUserSpeaking) ? `${4 + Math.random() * 12}px` : '4px' }}
                        />
                    ))}
                </div>
            </div>
            
            <h4 className="text-slate-800 font-bold text-sm md:text-base tracking-tight leading-none">
                {isAiSpeaking ? 'শিক্ষক উত্তর দিচ্ছেন' : isUserSpeaking ? 'আমি শুনছি, বলুন' : 'সব কিছু ঠিক আছে'}
            </h4>
            
            <div className="flex items-center gap-2 mt-2">
                <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                    <Eye size={10} className="text-emerald-500" /> Screen Active
                </span>
                <span className="w-1 h-1 rounded-full bg-slate-300" />
                <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                    <Zap size={10} className="text-amber-500" /> Turbo Mode
                </span>
            </div>
        </div>

        {/* Premium Close Action */}
        <div className="h-10 w-px bg-slate-100 mx-2" />
        
        <button 
            onClick={onDisconnect}
            className="group relative w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all duration-300 border border-slate-100 hover:border-rose-100"
            title="বন্ধ করুন"
        >
            <div className="absolute inset-0 bg-rose-500/10 rounded-2xl scale-0 group-hover:scale-100 transition-transform" />
            <X size={20} className="relative z-10" />
        </button>
      </div>
    </div>
  );
};
