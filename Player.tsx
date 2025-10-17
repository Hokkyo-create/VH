import React, { useState, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import { Channel, EpgData, Programme, DubbingSegment } from '../types';
import * as geminiService from '../services/geminiService';
import { loadSettings, saveSettings } from '../services/storageService';
import { decode, decodeAudioData, resample } from '../utils/audio';
import PlayerControls from './PlayerControls';
import OcrTranslateOverlay from './OcrTranslateOverlay';
import type { LiveServerMessage } from '@google/genai';

interface PlayerProps {
  channel: Channel | null;
  apiKey: string | null;
  onInvalidApiKey: () => void;
  epgData: EpgData | null;
  currentProgram: Programme | null;
  onProgramChange: (program: Programme | null) => void;
  targetLanguage: string;
  onLanguageChange: (language: string) => void;
}

interface Subtitle {
    text: string;
    speaker: 'Homem' | 'Mulher' | null;
    start: number;
    end: number;
}


const SUPPORTED_LANGUAGES = [
    { code: 'pt', name: 'Português (Brasil)' },
    { code: 'en', name: 'Inglês' },
    { code: 'es', name: 'Espanhol' },
    { code: 'fr', name: 'Francês' },
    { code: 'de', name: 'Alemão' },
    { code: 'it', name: 'Italiano' },
    { code: 'ja', name: 'Japonês' },
    { code: 'ko', name: 'Coreano' },
    { code: 'ru', name: 'Russo' },
    { code: 'zh', name: 'Chinês' },
];

const MALE_VOICES = [
    { code: 'Puck', name: 'Puck (Padrão M.)' },
    { code: 'Fenrir', name: 'Fenrir' },
    { code: 'Zephyr', name: 'Zephyr (Neutro)' },
];

const FEMALE_VOICES = [
    { code: 'Kore', name: 'Kore (Padrão F.)' },
    { code: 'Charon', name: 'Charon' },
    { code: 'Zephyr', name: 'Zephyr (Neutro)' },
];


const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
        if (typeof reader.result === 'string') {
            resolve(reader.result.split(',')[1]);
        } else {
            reject(new Error("Não foi possível converter blob para string base64."));
        }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};


const Player: React.FC<PlayerProps> = ({ channel, apiKey, onInvalidApiKey, epgData, currentProgram, onProgramChange, targetLanguage, onLanguageChange }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  
  // Refs de IA e Grafo de Áudio
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const dubbingGainNodeRef = useRef<GainNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Carrega configurações iniciais do localStorage
  const initialSettings = loadSettings();

  // Estado
  const [isDubbingActive, setIsDubbingActive] = useState(initialSettings.isDubbingActive ?? false);
  const [isSubtitlesActive, setIsSubtitlesActive] = useState(initialSettings.isSubtitlesActive ?? false);
  const [isSceneAnalysisActive, setIsSceneAnalysisActive] = useState(initialSettings.isSceneAnalysisActive ?? false);
  const [isOcrActive, setIsOcrActive] = useState(initialSettings.isOcrActive ?? false);
  const [renderedSubtitle, setRenderedSubtitle] = useState<Subtitle | null>(null);
  const [streamingSubtitle, setStreamingSubtitle] = useState<Subtitle | null>(null);
  const [sceneDescription, setSceneDescription] = useState('');
  const [ocrSummary, setOcrSummary] = useState('');
  const [maleDubbingVoice, setMaleDubbingVoice] = useState(initialSettings.maleDubbingVoice ?? 'Puck');
  const [femaleDubbingVoice, setFemaleDubbingVoice] = useState(initialSettings.femaleDubbingVoice ?? 'Kore');
  const [volume, setVolume] = useState(initialSettings.volume ?? 1);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isAtLiveEdge, setIsAtLiveEdge] = useState(true);
  
  // Refs de lógica
  const sceneAnalysisTimeoutRef = useRef<number | null>(null);
  const sceneDescriptionTimeoutRef = useRef<number | null>(null);
  const programCheckIntervalRef = useRef<number | null>(null);
  const subtitleHistoryRef = useRef<Subtitle[]>([]);
  const dubbingHistoryRef = useRef<DubbingSegment[]>([]);
  const lastPlayedDubbingIndexRef = useRef<number>(-1);
  const currentDubbingSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const currentTurnTranscriptionRef = useRef({ text: '', speaker: null as 'Homem' | 'Mulher' | null, start: 0 });

  // Salva configurações no localStorage sempre que elas mudam
  useEffect(() => { saveSettings({ isDubbingActive }); }, [isDubbingActive]);
  useEffect(() => { saveSettings({ isSubtitlesActive }); }, [isSubtitlesActive]);
  useEffect(() => { saveSettings({ isSceneAnalysisActive }); }, [isSceneAnalysisActive]);
  useEffect(() => { saveSettings({ isOcrActive }); }, [isOcrActive]);
  useEffect(() => { saveSettings({ maleDubbingVoice }); }, [maleDubbingVoice]);
  useEffect(() => { saveSettings({ femaleDubbingVoice }); }, [femaleDubbingVoice]);
  useEffect(() => { saveSettings({ volume }); }, [volume]);

  const handleAiError = useCallback((message: string, isAuthError: boolean = false) => {
    console.error("Erro de IA:", message);
    setAiError(message);
    setIsDubbingActive(false);
    setIsSubtitlesActive(false);
    setIsSceneAnalysisActive(false);
    if (isAuthError) {
      onInvalidApiKey();
    }
  }, [onInvalidApiKey]);

  // Efeito para ocultar automaticamente a mensagem de erro da IA
  useEffect(() => {
    if (aiError) {
      const timer = setTimeout(() => {
        setAiError(null);
      }, 8000); // Oculta após 8 segundos
      return () => clearTimeout(timer);
    }
  }, [aiError]);

  // Efeito para encontrar e atualizar o programa atual a partir dos dados do EPG
  useEffect(() => {
    const findCurrentProgram = () => {
      if (!channel?.tvgId || !epgData) {
        onProgramChange(null);
        return;
      }
      const programsForChannel = epgData[channel.tvgId];
      if (!programsForChannel) {
        onProgramChange(null);
        return;
      }
      const now = new Date();
      const program = programsForChannel.find(p => now >= p.start && now < p.stop);
      onProgramChange(program || null);
    };

    findCurrentProgram(); // Verificação inicial
    
    // Verifica por novo programa a cada minuto
    programCheckIntervalRef.current = window.setInterval(findCurrentProgram, 60000);

    return () => {
      if (programCheckIntervalRef.current) {
        clearInterval(programCheckIntervalRef.current);
      }
    };
  }, [channel, epgData, onProgramChange]);

  const handleTogglePlay = useCallback(async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
  
    try {
        // Sempre garante que o contexto de áudio esteja rodando antes de uma ação de play/pause
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
        }
    
        if (video.paused) {
            await video.play();
        } else {
            video.pause();
        }
    } catch (e) {
        console.error("Ação de Play/Pause falhou", e);
    }
  }, []);
  
  // Efeito para inicializar e gerenciar a reprodução HLS e o grafo de áudio
  useEffect(() => {
    if (!videoRef.current || !channel) return;
    const video = videoRef.current;
    
    const stopCurrentDubbing = () => {
        if (currentDubbingSourceRef.current) {
            try { currentDubbingSourceRef.current.stop(); } catch(e) {}
            currentDubbingSourceRef.current = null;
        }
    };
    
    if (hlsRef.current) {
        hlsRef.current.destroy();
    }
    
    if (!audioContextRef.current) {
        try {
            const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
            audioContextRef.current = new AudioCtor();
            const source = audioContextRef.current.createMediaElementSource(video);
            const gain = audioContextRef.current.createGain();
            source.connect(gain);
            gain.connect(audioContextRef.current.destination);
            sourceNodeRef.current = source;
            gainNodeRef.current = gain;
        } catch(e) {
            console.error("Não foi possível criar o contexto de áudio", e);
            return;
        }
    }
    
    stopCurrentDubbing();
    setRenderedSubtitle(null);
    setStreamingSubtitle(null);
    subtitleHistoryRef.current = [];
    dubbingHistoryRef.current = [];
    lastPlayedDubbingIndexRef.current = -1;
    setSceneDescription('');
    setOcrSummary('');
    onProgramChange(null);
    setAiError(null);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setIsAtLiveEdge(true);

    const playVideo = async () => {
        try {
            if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
                await audioContextRef.current.resume();
            }
            await video.play();
        } catch (error) {
            if (error instanceof Error && error.name !== 'AbortError') {
                console.error("Autoplay falhou:", error);
            }
        }
    };
    
    if (Hls.isSupported()) {
        const hls = new Hls();
        hlsRef.current = hls;
        hls.loadSource(channel.url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, playVideo);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = channel.url;
        video.addEventListener('loadedmetadata', playVideo);
    }

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    
    const onTimeUpdate = () => {
        if (!videoRef.current) return;
        const now = videoRef.current.currentTime;
        setCurrentTime(now);

        const buffer = videoRef.current.buffered;
        if (buffer && buffer.length > 0) {
            const liveThreshold = 15;
            const liveEdge = buffer.end(buffer.length - 1);
            setIsAtLiveEdge((liveEdge - now) < liveThreshold);
        }
        
        // Sincronização de Legendas Históricas
        const subHistory = subtitleHistoryRef.current;
        const activeSub = subHistory.find(sub => now >= sub.start && now <= sub.end) || null;
        setRenderedSubtitle(activeSub);
        
        // Sincronização de Dublagem
        if (isDubbingActive && outputAudioContextRef.current) {
            const dubHistory = dubbingHistoryRef.current;
            let foundSegment = false;
            for (let i = 0; i < dubHistory.length; i++) {
                const segment = dubHistory[i];
                if (now >= segment.start && now < segment.end) {
                    foundSegment = true;
                    if (lastPlayedDubbingIndexRef.current !== i) {
                        stopCurrentDubbing();
                        
                        const outputCtx = outputAudioContextRef.current;
                        const source = outputCtx.createBufferSource();
                        source.buffer = segment.buffer;
                        source.connect(dubbingGainNodeRef.current!);
                        
                        const offset = now - segment.start;
                        source.start(0, offset);
                        
                        currentDubbingSourceRef.current = source;
                        lastPlayedDubbingIndexRef.current = i;
                    }
                    break;
                }
            }
            if (!foundSegment && currentDubbingSourceRef.current) {
                stopCurrentDubbing();
                lastPlayedDubbingIndexRef.current = -1;
            }
        }
    };
    const onDurationChange = () => videoRef.current && setDuration(videoRef.current.duration);
    
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);

    return () => {
        stopCurrentDubbing();
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }
        video.removeEventListener('loadedmetadata', playVideo);
        video.removeEventListener('play', onPlay);
        video.removeEventListener('pause', onPause);
        video.removeEventListener('timeupdate', onTimeUpdate);
        video.removeEventListener('durationchange', onDurationChange);
        video.pause();
        video.removeAttribute('src');
        video.load();
    };
  }, [channel, onProgramChange, isDubbingActive]);


  const runSceneAnalysis = useCallback(async () => {
    if (!isSceneAnalysisActive || !videoRef.current || !canvasRef.current || !apiKey) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob(async (blob) => {
        if (blob) {
            try {
                const base64Data = await blobToBase64(blob);
                const description = await geminiService.analyzeScene(apiKey, base64Data);
                if (description) {
                    setSceneDescription(description);
                    if (sceneDescriptionTimeoutRef.current) {
                        clearTimeout(sceneDescriptionTimeoutRef.current);
                    }
                    sceneDescriptionTimeoutRef.current = window.setTimeout(() => {
                        setSceneDescription('');
                    }, 7000); // Mostra por 7 segundos
                }
            } catch (error) {
                handleAiError("A análise de cena falhou.");
            }
        }
    }, 'image/jpeg', 0.8);
  }, [isSceneAnalysisActive, handleAiError, apiKey]);

  const handleMessage = useCallback(async (message: LiveServerMessage) => {
    if (message.serverContent?.outputTranscription || message.serverContent?.inputTranscription) {
        if(sceneAnalysisTimeoutRef.current) {
            clearTimeout(sceneAnalysisTimeoutRef.current);
            sceneAnalysisTimeoutRef.current = null;
        }
    }

    // Processamento de Legendas em Streaming
    if (isSubtitlesActive && message.serverContent?.outputTranscription) {
      let textChunk = message.serverContent.outputTranscription.text;
      const now = videoRef.current?.currentTime ?? 0;
      const turnRef = currentTurnTranscriptionRef; // Shorter alias

      if (turnRef.current.text === '') { // This is the first chunk of a new turn
          turnRef.current.start = now;
          if (textChunk.startsWith('HOMEM:')) {
              turnRef.current.speaker = 'Homem';
              textChunk = textChunk.substring('HOMEM:'.length);
          } else if (textChunk.startsWith('MULHER:')) {
              turnRef.current.speaker = 'Mulher';
              textChunk = textChunk.substring('MULHER:'.length);
          } else {
              turnRef.current.speaker = null;
          }
      }
      
      const processedChunk = textChunk.trim();
      if (processedChunk) {
        turnRef.current.text += (turnRef.current.text ? ' ' : '') + processedChunk;
      }
      
      // Update the streaming subtitle if there's text
      if (turnRef.current.text) {
        setStreamingSubtitle({
            text: turnRef.current.text,
            speaker: turnRef.current.speaker,
            start: turnRef.current.start,
            end: now + 2, // Keep subtitle on screen for 2 seconds after last word
        });
      }
    }
    
    if (message.serverContent?.turnComplete) {
        const turn = currentTurnTranscriptionRef.current;
        const end = videoRef.current?.currentTime ?? 0;
        if (turn.text && end > turn.start) {
            subtitleHistoryRef.current.push({ 
                text: turn.text.trim(), 
                speaker: turn.speaker, 
                start: turn.start, 
                end 
            });
        }
        // Reset for the next turn
        setStreamingSubtitle(null);
        currentTurnTranscriptionRef.current = { text: '', speaker: null, start: 0 };

        if(isSceneAnalysisActive) {
            if(sceneAnalysisTimeoutRef.current) clearTimeout(sceneAnalysisTimeoutRef.current);
            sceneAnalysisTimeoutRef.current = window.setTimeout(runSceneAnalysis, 2500); // 2.5s de silêncio
        }
    }

    // Armazenamento de Dublagem
    if (isDubbingActive && outputAudioContextRef.current) {
      const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
      if (base64EncodedAudioString) {
          const startTime = videoRef.current?.currentTime ?? 0;
          const outputCtx = outputAudioContextRef.current;
          const audioBuffer = await decodeAudioData(decode(base64EncodedAudioString), outputCtx, 24000, 1);
          dubbingHistoryRef.current.push({ start: startTime, end: startTime + audioBuffer.duration, buffer: audioBuffer });
      }
    }
  }, [isDubbingActive, isSubtitlesActive, isSceneAnalysisActive, runSceneAnalysis]);


  // Efeito 3: Gerencia a sessão de IA e o roteamento do grafo de áudio.
  useEffect(() => {
    const isAudioAiNeeded = isDubbingActive || isSubtitlesActive;
    if (!audioContextRef.current || !gainNodeRef.current || !sourceNodeRef.current || !apiKey) {
        return;
    }

    const audioCtx = audioContextRef.current;
    const gainNode = gainNodeRef.current;
    const sourceNode = sourceNodeRef.current;

    const setupAiConnection = async () => {
        setAiError(null);
        await audioCtx.resume();
        
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processor.onaudioprocess = (event) => {
            const inputData = event.inputBuffer.getChannelData(0);
            const resampledData = resample(inputData, event.inputBuffer.sampleRate, 16000);
            geminiService.sendAudio(resampledData);
        };
        scriptProcessorRef.current = processor;

        try {
            sourceNode.disconnect();
            sourceNode.connect(gainNode);
            gainNode.connect(processor);
            processor.connect(audioCtx.destination);
        } catch(e) { console.warn("O redirecionamento do grafo de áudio pode ter inconsistências.", e); }
        
        try {
            await geminiService.startTranslationSession(
                apiKey,
                handleMessage,
                (e) => handleAiError("A conexão com a IA foi interrompida. As funções de tradução foram desativadas."),
                (e) => console.log('Sessão Gemini fechada.'),
                targetLanguage,
                maleDubbingVoice,
                femaleDubbingVoice,
                currentProgram ? { title: currentProgram.title, description: currentProgram.desc } : undefined
            );
            const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
            outputAudioContextRef.current = new AudioCtor({ sampleRate: 24000 });
            dubbingGainNodeRef.current = outputAudioContextRef.current.createGain();
            dubbingGainNodeRef.current.connect(outputAudioContextRef.current.destination);
            await outputAudioContextRef.current.resume();

        } catch (err: any) { 
             const isAuthError = err.message?.includes('API key not valid');
             handleAiError(
                isAuthError 
                ? "Sua chave de API do Gemini é inválida. Verifique-a nas configurações."
                : "Não foi possível iniciar a sessão de IA. Verifique sua chave e a conexão.",
                isAuthError
             );
        }
    };

    const teardownAiConnection = () => {
        geminiService.closeSession();
        if (currentDubbingSourceRef.current) {
            try { currentDubbingSourceRef.current.stop(); } catch(e) {}
            currentDubbingSourceRef.current = null;
        }
        if (outputAudioContextRef.current) {
            outputAudioContextRef.current.close().catch(console.error);
            outputAudioContextRef.current = null;
            dubbingGainNodeRef.current = null;
        }
        if (scriptProcessorRef.current) {
            try {
                gainNode.disconnect(scriptProcessorRef.current);
                scriptProcessorRef.current.disconnect(audioCtx.destination);
            } catch (e) {}
            scriptProcessorRef.current = null;
        }
        try { 
            sourceNode.disconnect();
            sourceNode.connect(gainNode);
            gainNode.connect(audioCtx.destination);
        } catch (e) { console.warn("Não foi possível restaurar o caminho de áudio padrão.", e); }
    };

    if (isAudioAiNeeded) {
        setupAiConnection();
    }

    return teardownAiConnection;
  }, [apiKey, isDubbingActive, isSubtitlesActive, targetLanguage, maleDubbingVoice, femaleDubbingVoice, handleMessage, handleAiError, currentProgram]);

  // Efeito 4: Gerencia o volume do vídeo original para dublagem e volume do usuário.
  useEffect(() => {
    if (gainNodeRef.current && audioContextRef.current) {
      gainNodeRef.current.gain.linearRampToValueAtTime(
        isDubbingActive ? 0.2 * volume : volume,
        audioContextRef.current.currentTime + 0.2
      );
    }
    if (dubbingGainNodeRef.current && outputAudioContextRef.current) {
        dubbingGainNodeRef.current.gain.linearRampToValueAtTime(
            isDubbingActive ? 1 : 0,
            outputAudioContextRef.current.currentTime + 0.2
        );
    }
  }, [isDubbingActive, volume]);

  const handleSeek = useCallback((time: number) => {
    if (videoRef.current) {
      if (currentDubbingSourceRef.current) {
          try { currentDubbingSourceRef.current.stop(); } catch(e) {}
          currentDubbingSourceRef.current = null;
      }
      videoRef.current.currentTime = time;
      setCurrentTime(time);
      lastPlayedDubbingIndexRef.current = -1;
    }
  }, []);

  const handleTogglePiP = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (error) {
      console.error("Erro ao alternar o modo Picture-in-Picture:", error);
    }
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    const playerElement = playerContainerRef.current;
    if (!playerElement) return;

    if (!document.fullscreenElement) {
      playerElement.requestFullscreen().catch((err) => {
        console.error(`Erro ao tentar ativar o modo de tela cheia: ${err.message} (${err.name})`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);
  
  const targetLanguageCode = SUPPORTED_LANGUAGES.find(l => l.name === targetLanguage)?.code ?? 'pt';
  const areAiFeaturesDisabled = !apiKey;


  if (!channel) {
    return (
      <div className="bg-black aspect-video rounded-lg shadow-2xl flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2 text-gray-400">Player de IPTV com IA</h2>
          <p className="text-gray-500">Selecione um canal da lista para começar a assistir.</p>
        </div>
      </div>
    );
  }
  
  const displaySubtitle = streamingSubtitle || renderedSubtitle;

  const subtitleColorClass =
    displaySubtitle?.speaker === 'Homem'
      ? 'text-cyan-300'
      : displaySubtitle?.speaker === 'Mulher'
      ? 'text-pink-300'
      : 'text-white';

  return (
    <div ref={playerContainerRef} className="relative bg-black aspect-video rounded-lg shadow-2xl group overflow-hidden">
      <video ref={videoRef} className="w-full h-full rounded-lg" crossOrigin="anonymous" playsInline />
      <canvas ref={canvasRef} className="hidden" />

      <OcrTranslateOverlay 
        videoRef={videoRef}
        enabled={isOcrActive && !!apiKey}
        targetLanguageCode={targetLanguageCode}
        onNewSummary={setOcrSummary}
        apiKey={apiKey}
      />

      <div className="absolute top-0 left-0 right-0 p-4 pointer-events-none flex flex-col items-center gap-2 transition-opacity duration-500 group-hover:opacity-100 opacity-0 focus-within:opacity-100">
         {currentProgram && (
           <div className="bg-black/70 rounded-lg px-3 py-1 text-center max-w-2xl">
              <p className="font-bold text-base text-teal-300 truncate">{currentProgram.title}</p>
           </div>
         )}
         <p 
          className={`text-base font-serif italic bg-black/70 rounded-md px-3 py-1 inline-block text-gray-300 transition-opacity duration-500 ease-in-out ${sceneDescription ? 'opacity-100' : 'opacity-0'}`}
          style={{ textShadow: '1px 1px 3px rgba(0,0,0,0.7)' }}
        >
            {sceneDescription}
        </p>
         <p 
          className={`text-sm font-semibold bg-teal-900/80 rounded-md px-3 py-1 inline-block text-teal-200 max-w-xl transition-opacity duration-500 ease-in-out ${ocrSummary ? 'opacity-100' : 'opacity-0'}`}
          style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}
        >
            {ocrSummary}
        </p>
      </div>


      <div className={`absolute bottom-28 left-0 right-0 text-center p-4 pointer-events-none transition-opacity duration-300 ease-in-out ${displaySubtitle ? 'opacity-100' : 'opacity-0'}`}>
        <p 
          className={`text-xl md:text-2xl font-semibold bg-black/75 rounded-lg px-4 py-2 inline-block transition-colors duration-300 ${subtitleColorClass}`}
          style={{ textShadow: '2px 2px 5px rgba(0,0,0,0.8)' }}
        >
            {displaySubtitle?.speaker && <span className="font-bold">{displaySubtitle.speaker}: </span>}
            {displaySubtitle?.text}
        </p>
      </div>
      
      {aiError && (
          <div className="absolute bottom-24 sm:bottom-28 left-4 right-4 p-3 bg-red-800/90 border border-red-600 rounded-lg text-center z-20 transition-opacity duration-300 ease-in-out animate-pulse">
              <p className="text-white font-semibold text-sm sm:text-base">{aiError}</p>
          </div>
      )}

      <PlayerControls
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        currentTime={currentTime}
        duration={duration}
        onSeek={handleSeek}
        isDubbingActive={isDubbingActive}
        onToggleDubbing={() => setIsDubbingActive(p => !p)}
        isSubtitlesActive={isSubtitlesActive}
        onToggleSubtitles={() => setIsSubtitlesActive(p => !p)}
        isSceneAnalysisActive={isSceneAnalysisActive}
        onToggleSceneAnalysis={() => setIsSceneAnalysisActive(p => !p)}
        isOcrActive={isOcrActive}
        onToggleOcr={() => setIsOcrActive(p => !p)}
        areAiFeaturesDisabled={areAiFeaturesDisabled}
        targetLanguage={targetLanguage}
        onLanguageChange={onLanguageChange}
        supportedLanguages={SUPPORTED_LANGUAGES}
        maleDubbingVoice={maleDubbingVoice}
        onMaleDubbingVoiceChange={setMaleDubbingVoice}
        supportedMaleVoices={MALE_VOICES}
        femaleDubbingVoice={femaleDubbingVoice}
        onFemaleDubbingVoiceChange={setFemaleDubbingVoice}
        supportedFemaleVoices={FEMALE_VOICES}
        volume={volume}
        onVolumeChange={setVolume}
        onTogglePiP={handleTogglePiP}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        isAtLiveEdge={isAtLiveEdge}
        videoRef={videoRef}
      />
    </div>
  );
};

export default Player;
