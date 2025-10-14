import React, { useState, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import { Channel } from '../types';
import * as geminiService from '../services/geminiService';
import { loadSettings, saveSettings } from '../services/storageService';
import { decode, decodeAudioData, resample } from '../utils/audio';
import PlayerControls from './PlayerControls';
import OcrTranslateOverlay from './OcrTranslateOverlay';
import type { LiveServerMessage } from '@google/genai';

interface PlayerProps {
  channel: Channel | null;
}

const SUPPORTED_LANGUAGES = [
    { code: 'pt', name: 'Português' },
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

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
        if (typeof reader.result === 'string') {
            resolve(reader.result.split(',')[1]);
        } else {
            reject(new Error("Failed to convert blob to base64 string."));
        }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};


const Player: React.FC<PlayerProps> = ({ channel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  
  // AI and Audio Graph Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef(new Set<AudioBufferSourceNode>());
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load initial settings from localStorage
  const initialSettings = loadSettings();

  // State
  const [isDubbingActive, setIsDubbingActive] = useState(initialSettings.isDubbingActive ?? false);
  const [isSubtitlesActive, setIsSubtitlesActive] = useState(initialSettings.isSubtitlesActive ?? false);
  const [isSceneAnalysisActive, setIsSceneAnalysisActive] = useState(initialSettings.isSceneAnalysisActive ?? false);
  const [isOcrActive, setIsOcrActive] = useState(initialSettings.isOcrActive ?? false);
  const [subtitles, setSubtitles] = useState('');
  const [sceneDescription, setSceneDescription] = useState('');
  const [targetLanguage, setTargetLanguage] = useState(initialSettings.language ?? 'Português');
  const [volume, setVolume] = useState(initialSettings.volume ?? 1);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Logic refs
  const subtitleTimeoutRef = useRef<number | null>(null);
  const sceneAnalysisTimeoutRef = useRef<number | null>(null);
  const sceneDescriptionTimeoutRef = useRef<number | null>(null);
  const justCompletedTurnRef = useRef(true); 
  const currentSpeakerRef = useRef<'Homem' | 'Mulher' | null>(null);

  // Save settings to localStorage whenever they change
  useEffect(() => { saveSettings({ isDubbingActive }); }, [isDubbingActive]);
  useEffect(() => { saveSettings({ isSubtitlesActive }); }, [isSubtitlesActive]);
  useEffect(() => { saveSettings({ isSceneAnalysisActive }); }, [isSceneAnalysisActive]);
  useEffect(() => { saveSettings({ isOcrActive }); }, [isOcrActive]);
  useEffect(() => { saveSettings({ language: targetLanguage }); }, [targetLanguage]);
  useEffect(() => { saveSettings({ volume }); }, [volume]);

  const handleAiError = useCallback((message: string) => {
    console.error("AI Error:", message);
    setAiError(message);
    setIsDubbingActive(false);
    setIsSubtitlesActive(false);
    setIsSceneAnalysisActive(false);
  }, []);

  // Effect to auto-hide the AI error message
  useEffect(() => {
    if (aiError) {
      const timer = setTimeout(() => {
        setAiError(null);
      }, 8000); // Hide after 8 seconds
      return () => clearTimeout(timer);
    }
  }, [aiError]);

  // Effect 1: Manages HLS playback and the core audio graph.
  useEffect(() => {
    if (!videoRef.current || !channel) return;
    const video = videoRef.current;

    hlsRef.current?.destroy();
    sourceNodeRef.current?.disconnect();
    gainNodeRef.current?.disconnect();
    audioContextRef.current?.close().catch(console.error);
    
    if (Hls.isSupported()) {
      const hls = new Hls();
      hlsRef.current = hls;
      hls.loadSource(channel.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(e => console.error("Autoplay prevented.", e));
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = channel.url;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(e => console.error("Autoplay prevented.", e));
      });
    }
    
    try {
      const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
      const context = new AudioCtor();
      audioContextRef.current = context;
      const source = context.createMediaElementSource(video);
      sourceNodeRef.current = source;
      const gain = context.createGain();
      gainNodeRef.current = gain;
      gain.gain.value = 1; // Start at full volume, state will take over.
      source.connect(gain);
      gain.connect(context.destination);
    } catch (e) {
      console.error("Error creating audio graph:", e);
    }
    
    // Reset states for the new channel
    setSubtitles('');
    setSceneDescription('');
    setAiError(null);
    currentSpeakerRef.current = null;
    if (subtitleTimeoutRef.current) clearTimeout(subtitleTimeoutRef.current);
    if (sceneDescriptionTimeoutRef.current) clearTimeout(sceneDescriptionTimeoutRef.current);

    return () => {
      hlsRef.current?.destroy();
      sourceNodeRef.current?.disconnect();
      gainNodeRef.current?.disconnect();
      audioContextRef.current?.close().catch(console.error);
      audioContextRef.current = null;
      sourceNodeRef.current = null;
      gainNodeRef.current = null;
    };
  }, [channel]);

  const runSceneAnalysis = useCallback(async () => {
    if (!isSceneAnalysisActive || !videoRef.current || !canvasRef.current) return;
    
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
                const description = await geminiService.analyzeScene(base64Data);
                if (description) {
                    setSceneDescription(description);
                    if (sceneDescriptionTimeoutRef.current) {
                        clearTimeout(sceneDescriptionTimeoutRef.current);
                    }
                    sceneDescriptionTimeoutRef.current = window.setTimeout(() => {
                        setSceneDescription('');
                    }, 7000); // Show for 7 seconds
                }
            } catch (error) {
                handleAiError("A análise de cena falhou.");
            }
        }
    }, 'image/jpeg', 0.8);
  }, [isSceneAnalysisActive, handleAiError]);

  const handleMessage = useCallback(async (message: LiveServerMessage) => {
    // Clear scene analysis timeout as soon as speech is detected
    if (message.serverContent?.outputTranscription || message.serverContent?.inputTranscription) {
        if(sceneAnalysisTimeoutRef.current) {
            clearTimeout(sceneAnalysisTimeoutRef.current);
            sceneAnalysisTimeoutRef.current = null;
        }
    }

    if (isSubtitlesActive && message.serverContent?.outputTranscription) {
      let text = message.serverContent.outputTranscription.text;
      if (justCompletedTurnRef.current) {
        if (text.startsWith('[MALE]')) {
          currentSpeakerRef.current = 'Homem';
          text = text.substring('[MALE]'.length);
        } else if (text.startsWith('[FEMALE]')) {
          currentSpeakerRef.current = 'Mulher';
          text = text.substring('[FEMALE]'.length);
        } else {
          currentSpeakerRef.current = null;
        }
      }

      setSubtitles(prev => {
        let newText;
        if (justCompletedTurnRef.current) {
          justCompletedTurnRef.current = false;
          newText = text;
        } else {
          const prevTextOnly = prev.startsWith('Homem: ') ? prev.substring('Homem: '.length) :
                               prev.startsWith('Mulher: ') ? prev.substring('Mulher: '.length) :
                               prev;
          newText = prevTextOnly + text;
        }

        if (currentSpeakerRef.current) {
          return `${currentSpeakerRef.current}: ${newText.trim()}`;
        }
        return newText.trim();
      });

      if (subtitleTimeoutRef.current) {
        clearTimeout(subtitleTimeoutRef.current);
        subtitleTimeoutRef.current = null;
      }
    }
    
    if (message.serverContent?.turnComplete) {
      justCompletedTurnRef.current = true;
      subtitleTimeoutRef.current = window.setTimeout(() => {
        setSubtitles('');
        currentSpeakerRef.current = null;
      }, 1500);

      // If scene analysis is active, trigger it after a delay
      if(isSceneAnalysisActive) {
        if(sceneAnalysisTimeoutRef.current) clearTimeout(sceneAnalysisTimeoutRef.current);
        sceneAnalysisTimeoutRef.current = window.setTimeout(runSceneAnalysis, 2500); // 2.5s of silence
      }
    }

    if (isDubbingActive && outputAudioContextRef.current) {
      const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
      if (base64EncodedAudioString) {
        const outputCtx = outputAudioContextRef.current;
        nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
        const audioBuffer = await decodeAudioData(decode(base64EncodedAudioString), outputCtx, 24000, 1);
        const source = outputCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(outputCtx.destination);
        source.addEventListener('ended', () => sourcesRef.current.delete(source));
        source.start(nextStartTimeRef.current);
        nextStartTimeRef.current += audioBuffer.duration;
        sourcesRef.current.add(source);
      }
    }
  }, [isDubbingActive, isSubtitlesActive, isSceneAnalysisActive, runSceneAnalysis]);


  // Effect 2: Manages the AI session (for audio)
  useEffect(() => {
    const isAudioAiNeeded = isDubbingActive || isSubtitlesActive;
    if (!isAudioAiNeeded) {
        geminiService.closeSession();
        if(scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        return;
    };
    if (!audioContextRef.current || !gainNodeRef.current) return; 

    let isCancelled = false;
    const setupAiConnection = async () => {
      try {
        setAiError(null);
        await audioContextRef.current!.resume();
        await geminiService.startTranslationSession(
          handleMessage,
          (e) => handleAiError("A conexão com a IA foi interrompida. As funções de tradução foram desativadas."),
          (e) => console.log('Gemini session closed.'),
          targetLanguage
        );
        if (isCancelled) { geminiService.closeSession(); return; }

        const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
        outputAudioContextRef.current = new AudioCtor({ sampleRate: 24000 });
        await outputAudioContextRef.current.resume();

        const processor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
        scriptProcessorRef.current = processor;
        
        processor.onaudioprocess = (event) => {
          const inputData = event.inputBuffer.getChannelData(0);
          const resampledData = resample(inputData, event.inputBuffer.sampleRate, 16000);
          geminiService.sendAudio(resampledData);
        };
        gainNodeRef.current!.connect(processor);
        processor.connect(audioContextRef.current!.destination);

      } catch (err) { 
        handleAiError("Não foi possível iniciar a sessão de IA. Verifique sua chave de API e a conexão.");
      }
    };
    setupAiConnection();

    return () => {
      isCancelled = true;
      geminiService.closeSession();
      scriptProcessorRef.current?.disconnect();
      outputAudioContextRef.current?.close().catch(console.error);
      scriptProcessorRef.current = null;
      outputAudioContextRef.current = null;
    };
  }, [isDubbingActive, isSubtitlesActive, targetLanguage, handleMessage, handleAiError]);

  // Effect 3: Manages the original video volume for dubbing and user volume.
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = isDubbingActive ? 0.2 * volume : volume;
    }
  }, [isDubbingActive, volume]);

  const handleToggleSubtitles = () => {
    setIsSubtitlesActive(p => !p);
  };

  const handleTogglePiP = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (error) {
      console.error("Error toggling Picture-in-Picture mode:", error);
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

  // Effect to sync fullscreen state with browser events (like pressing ESC)
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);
  
  const targetLanguageCode = SUPPORTED_LANGUAGES.find(l => l.name === targetLanguage)?.code ?? 'pt';

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
  
  const subtitleColorClass =
    currentSpeakerRef.current === 'Homem'
      ? 'text-cyan-300'
      : currentSpeakerRef.current === 'Mulher'
      ? 'text-pink-300'
      : 'text-white';

  return (
    <div ref={playerContainerRef} className="relative bg-black aspect-video rounded-lg shadow-2xl group">
      <video ref={videoRef} className="w-full h-full rounded-lg" crossOrigin="anonymous" />
      <canvas ref={canvasRef} className="hidden" />

      <OcrTranslateOverlay 
        videoRef={videoRef}
        enabled={isOcrActive}
        targetLanguageCode={targetLanguageCode}
      />

      <div className={`absolute top-4 left-0 right-0 text-center p-2 pointer-events-none transition-opacity duration-500 ease-in-out ${sceneDescription ? 'opacity-100' : 'opacity-0'}`}>
        <p 
          className="text-base font-serif italic bg-black/70 rounded-md px-3 py-1 inline-block text-gray-300"
          style={{ textShadow: '1px 1px 3px rgba(0,0,0,0.7)' }}
        >
            {sceneDescription}
        </p>
      </div>

      <div className={`absolute bottom-24 left-0 right-0 text-center p-4 pointer-events-none transition-opacity duration-300 ease-in-out ${subtitles ? 'opacity-100' : 'opacity-0'}`}>
        <p 
          className={`text-lg md:text-xl font-semibold bg-black/75 rounded-lg px-4 py-2 inline-block transition-colors duration-300 ${subtitleColorClass}`}
          style={{ textShadow: '2px 2px 5px rgba(0,0,0,0.8)' }}
        >
            {subtitles}
        </p>
      </div>
      
      {aiError && (
          <div className="absolute bottom-16 sm:bottom-20 left-4 right-4 p-3 bg-red-800/90 border border-red-600 rounded-lg text-center z-20 transition-opacity duration-300 ease-in-out animate-pulse">
              <p className="text-white font-semibold text-sm sm:text-base">{aiError}</p>
          </div>
      )}

      <PlayerControls
        isDubbingActive={isDubbingActive}
        onToggleDubbing={() => setIsDubbingActive(p => !p)}
        isSubtitlesActive={isSubtitlesActive}
        onToggleSubtitles={handleToggleSubtitles}
        isSceneAnalysisActive={isSceneAnalysisActive}
        onToggleSceneAnalysis={() => setIsSceneAnalysisActive(p => !p)}
        isOcrActive={isOcrActive}
        onToggleOcr={() => setIsOcrActive(p => !p)}
        targetLanguage={targetLanguage}
        onLanguageChange={setTargetLanguage}
        supportedLanguages={SUPPORTED_LANGUAGES}
        volume={volume}
        onVolumeChange={setVolume}
        onTogglePiP={handleTogglePiP}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
      />
    </div>
  );
};

export default Player;