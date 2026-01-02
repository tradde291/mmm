
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from "@google/genai";

interface LiveServiceConfig {
  apiKey: string;
  onAudioLevel: (level: number, source: 'user' | 'ai') => void;
  onTranscription: (text: string, source: 'user' | 'ai', isFinal: boolean) => void;
}

export class LiveService {
  private client: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private nextStartTime = 0;
  private config: LiveServiceConfig;
  private sources = new Set<AudioBufferSourceNode>();
  
  // Context Management
  private currentPageText: string = "";
  
  // Noise Gate Settings - Premium Sensitivity
  private noiseThreshold = 0.0025; // More sensitive for whisper support
  private isUserSpeakingActive = false;

  // Audio Analysis
  private inputAnalyser: AnalyserNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private analysisInterval: number | null = null;

  constructor(config: LiveServiceConfig) {
    this.config = config;
    this.client = new GoogleGenAI({ apiKey: config.apiKey });
  }

  async connect() {
    this.inputAudioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    this.outputAudioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });

    const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        } 
    });

    this.setupAudioAnalysis();

    const getPageTextTool: FunctionDeclaration = {
      name: "getPageText",
      description: "Get the text content of the currently visible PDF page. Use this for precise reading and referencing.",
      parameters: {
        type: Type.OBJECT,
        properties: {},
      },
    };

    this.sessionPromise = this.client.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks: {
        onopen: () => {
          this.startAudioStreaming(stream);
          this.sessionPromise?.then(session => {
            session.send({ 
              parts: [{ text: "হ্যালো! আমি আপনার প্রিমিয়াম টিউটর হিসেবে প্রস্তুত। সরাসরি কথা বলুন, আমি আপনাকে সাহায্য করতে এখানে আছি।" }] 
            });
          });
        },
        onmessage: async (message: LiveServerMessage) => {
          const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (base64Audio) {
             await this.playAudio(base64Audio);
          }
          
          const modelTranscript = message.serverContent?.outputTranscription;
          if (modelTranscript?.text) {
             this.config.onTranscription(modelTranscript.text, 'ai', false);
          }

          const userTranscript = message.serverContent?.inputTranscription;
          if (userTranscript?.text) {
             this.config.onTranscription(userTranscript.text, 'user', false);
          }

          if (message.serverContent?.turnComplete) {
             this.config.onTranscription('', 'ai', true);
          }
          
          if (message.toolCall) {
            for (const fc of message.toolCall.functionCalls) {
              if (fc.name === 'getPageText') {
                this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                        functionResponses: {
                            id: fc.id,
                            name: fc.name,
                            response: { result: { text: this.currentPageText } }
                        }
                    });
                });
              }
            }
          }

          if (message.serverContent?.interrupted) {
            this.stopAudio();
          }
        },
        onclose: () => console.log("Gemini Live Closed"),
        onerror: (err) => console.error("Gemini Live Error", err)
      },
      config: {
        responseModalities: [Modality.AUDIO],
        outputAudioTranscription: {}, 
        inputAudioTranscription: {},
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
        tools: [{ functionDeclarations: [getPageTextTool] }],
        systemInstruction: `
          আপনি 'BanglaGenius Premium', বাংলাদেশের সেরা ক্লাস ১-১০ এর AI প্রাইভেট টিউটর।

          **আপনার এক্সপার্ট রোল:**
          আপনি একজন মমতাময়ী কিন্তু অত্যন্ত দক্ষ শিক্ষক। আপনি স্ক্রিন দেখতে পাচ্ছেন এবং স্টুডেন্ট কী বলছে তাও শুনতে পাচ্ছেন।

          **প্রিমিয়াম ইন্টারেকশন গাইড:**
          ১. **তাত্ক্ষণিক রেসপন্স:** কোনো ল্যাগ ছাড়াই উত্তর দিন। স্টুডেন্টের কথা শেষ হওয়া মাত্রই রেসপন্স শুরু করুন।
          ২. **ভিজ্যুয়াল লার্নিং:** স্টুডেন্ট যদি কলম (Pen) দিয়ে কিছু মার্ক করে, আপনি সেটি দেখে ব্যাখ্যা করুন। 'getPageText' ব্যবহার করে টেক্সট সঠিক কি না নিশ্চিত হোন।
          ৩. **ইংরেজি ক্লাসের নিয়ম:**
             - ইংরেজি রিডিং পড়ার সময় পরিষ্কার ব্রিটিশ বা আমেরিকান অ্যাকসেন্টে পড়ুন।
             - মানে বোঝানোর সময়: "English Sentence" -> "বাংলা অর্থ এবং সহজ ব্যাখ্যা"।
          ৪. **ভয়েস কোয়ালিটি:** রোবটিক শোনাবেন না। মানুষের মতো আবেগ ও সঠিক বিরামচিহ্ন ব্যবহার করে কথা বলুন।
          ৫. **সংক্ষিপ্ত ও বুদ্ধিদীপ্ত:** অপ্রয়োজনীয় দীর্ঘ কথা বলবেন না। স্টুডেন্ট যাতে বোর না হয় সেদিকে খেয়াল রাখুন।

          সবসময় মনে রাখবেন, আপনি স্টুডেন্টের হাতের কলম এবং চোখের সামনে থাকা বই - উভয়ই ফলো করছেন।
        `,
      },
    });
  }

  private setupAudioAnalysis() {
    if (!this.inputAudioContext || !this.outputAudioContext) return;

    this.inputAnalyser = this.inputAudioContext.createAnalyser();
    this.inputAnalyser.fftSize = 256;
    this.inputAnalyser.smoothingTimeConstant = 0.4;

    this.outputAnalyser = this.outputAudioContext.createAnalyser();
    this.outputAnalyser.fftSize = 256;
    this.outputAnalyser.smoothingTimeConstant = 0.4;

    this.analysisInterval = window.setInterval(() => {
        this.analyzeAudioLevels();
    }, 50); // Faster updates for UI
  }

  private analyzeAudioLevels() {
    if (this.inputAnalyser) {
        const dataArray = new Uint8Array(this.inputAnalyser.frequencyBinCount);
        this.inputAnalyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const normalized = avg / 255;
        this.config.onAudioLevel(normalized, 'user');
        this.isUserSpeakingActive = normalized > this.noiseThreshold;
    }

    if (this.outputAnalyser) {
        const dataArray = new Uint8Array(this.outputAnalyser.frequencyBinCount);
        this.outputAnalyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
        this.config.onAudioLevel(avg / 255, 'ai');
    }
  }

  private startAudioStreaming(stream: MediaStream) {
    if (!this.inputAudioContext || !this.sessionPromise || !this.inputAnalyser) return;

    this.inputSource = this.inputAudioContext.createMediaStreamSource(stream);
    this.processor = this.inputAudioContext.createScriptProcessor(1024, 1, 1); // Minimum buffer for ultra-low latency

    this.inputSource.connect(this.inputAnalyser);
    this.inputAnalyser.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      
      let maxAmplitude = 0;
      for (let i = 0; i < inputData.length; i++) {
          if (Math.abs(inputData[i]) > maxAmplitude) maxAmplitude = Math.abs(inputData[i]);
      }

      if (maxAmplitude > this.noiseThreshold) {
          const base64PCM = this.pcmFloat32ToBase64(inputData);
          this.sessionPromise?.then((session) => {
            session.sendRealtimeInput({
              media: { mimeType: 'audio/pcm;rate=16000', data: base64PCM }
            });
          });
      }
    };
  }

  async sendImageFrame(base64Image: string) {
    if (!this.sessionPromise) return;
    const cleanBase64 = base64Image.split(',')[1];
    this.sessionPromise.then((session) => {
        session.sendRealtimeInput({
            media: { mimeType: 'image/jpeg', data: cleanBase64 }
        });
    });
  }

  async sendPageContext(text: string) {
    this.currentPageText = text;
  }

  async disconnect() {
    if (this.sessionPromise) {
        const session = await this.sessionPromise;
        if (session && typeof session.close === 'function') {
             session.close();
        }
    }
    if (this.analysisInterval) clearInterval(this.analysisInterval);
    this.stopAudio();
    if (this.inputSource) this.inputSource.disconnect();
    if (this.processor) this.processor.disconnect();
    if (this.inputAudioContext) await this.inputAudioContext.close();
    if (this.outputAudioContext) await this.outputAudioContext.close();
    this.sessionPromise = null;
  }
  
  private stopAudio() {
      for (const source of this.sources) {
          try { source.stop(); } catch(e) {}
      }
      this.sources.clear();
      this.nextStartTime = 0;
  }

  private async playAudio(base64: string) {
    if (!this.outputAudioContext || !this.outputAnalyser) return;

    try {
        const audioData = this.base64ToUint8Array(base64);
        const audioBuffer = await this.decodeAudioData(audioData, this.outputAudioContext);
        
        const source = this.outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        
        source.connect(this.outputAnalyser);
        this.outputAnalyser.connect(this.outputAudioContext.destination);
        
        source.onended = () => this.sources.delete(source);

        const currentTime = this.outputAudioContext.currentTime;
        if (this.nextStartTime < currentTime) {
          this.nextStartTime = currentTime;
        }

        source.start(this.nextStartTime);
        this.nextStartTime = this.nextStartTime + audioBuffer.duration;
        this.sources.add(source);
    } catch (e) {
        console.error("Audio playback error", e);
    }
  }

  private pcmFloat32ToBase64(data: Float32Array): string {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }
    return this.encode(new Uint8Array(int16.buffer));
  }

  private encode(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  private async decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number = 24000,
    numChannels: number = 1,
  ): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  }
}
