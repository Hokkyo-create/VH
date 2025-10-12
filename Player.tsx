import React, { useState, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import { Channel } from '../types';
import * as geminiService from '../services/geminiService';
import { decode, decodeAudioData, resample } from '../utils/audio';
import PlayerControls from './PlayerControls';
import type { LiveServerMessage } from '@google/genai';

interface PlayerProps {
  channel: Channel | null;
}

const SUPPORTED_LANGUAGES = [
    { code: 'pt', name: 'Portuguese (Brazil)' },
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'ru', name: 'Russian' },
    { code: 'zh', name: 'Chinese' },
];

const Player: React.FC<PlayerProps> = ({ channel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  
  const [isDubbingActive, setIsDubbingActive] = useState(false);
  const [isSubtitlesActive, setIsSubtitlesActive] = useState(false);
  const [subtitles, setSubtitles] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('Portuguese (Brazil)');
  const [isAiSessionActive, setIsAiSessionActive] = useState(false);
  const subtitleTimeoutRef = useRef<number | null>(null);
  const justCompletedTurnRef = useRef(false);

  // Audio processing refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef(new Set<AudioBufferSourceNode>());

  const stopAiSession = useCallback(() => {
    geminiService.closeSession();
    setIsAiSessionActive(false);

    if (scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect();
        scriptProcessorRef.current = null;
    }

    if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = 1.0;
    }

    if(outputAudioContextRef.current) {
        outputAudioContextRef.current.close().catch(console.error);
        outputAudioContextRef.current = null;
    }
    
    if (subtitleTimeoutRef.current) {
      clearTimeout(subtitleTimeoutRef.current);
    }
  }, []);

  const cleanupAudioGraph = useCallback(() => {
    stopAiSession();
    sourceNodeRef.current?.disconnect();
    gainNodeRef.current?.disconnect();
    audioContextRef.current?.close().catch(console.error);
    
    sourceNodeRef.current = null;
    gainNodeRef.current = null;
    audioContextRef.current = null;
  }, [stopAiSession]);


  useEffect(() => {
    if (videoRef.current && channel) {
      const video = videoRef.current;
      
      const setupHls = () => {
        if (Hls.isSupported()) {
          if (hlsRef.current) {
            hlsRef.current.destroy();
          }
          const hls = new Hls();
          hlsRef.current = hls;
          hls.loadSource(channel.url);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(e => console.error("Autoplay was prevented.", e));
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = channel.url;
          video.addEventListener('loadedmetadata', () => {
            video.play().catch(e => console.error("Autoplay was prevented.", e));
          });
        }
      };
      
      // Stop any previous AI session and clean up audio before setting up new video
      cleanupAudioGraph();
      setupHls();

    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      cleanupAudioGraph();
    };
  }, [channel, cleanupAudioGraph]);

  const setupAudioGraph = useCallback(() => {
    if (!videoRef.current || audioContextRef.current) return;

    try {
        const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
        const context = new AudioCtor();
        audioContextRef.current = context;

        const source = context.createMediaElementSource(videoRef.current);
        sourceNodeRef.current = source;

        const gain = context.createGain();
        gainNodeRef.current = gain;

        source.connect(gain);
        gain.connect(context.destination);
    } catch (e) {
        console.error("Failed to setup audio graph:", e);
    }
  }, []);

  const handleMessage = useCallback(async (message: LiveServerMessage) => {
    if (!isSubtitlesActive && !isDubbingActive) return;

    if (isSubtitlesActive && message.serverContent?.outputTranscription) {
      const text = message.serverContent.outputTranscription.text;
      setSubtitles(prev => {
        if (justCompletedTurnRef.current) {
            justCompletedTurnRef.current = false;
            return text.trim();
        }
        return (prev + text).trim();
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
      }, 3000);
    }

    if (isDubbingActive && outputAudioContextRef.current) {
        const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
        if (base64EncodedAudioString) {
            const outputCtx = outputAudioContextRef.current;
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
            const audioBuffer = await decodeAudioData(
                decode(base64EncodedAudioString),
                outputCtx,
                24000,
                1,
            );
            const source = outputCtx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outputCtx.destination);
            source.addEventListener('ended', () => {
                sourcesRef.current.delete(source);
            });
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current = nextStartTimeRef.current + audioBuffer.duration;
            sourcesRef.current.add(source);
        }
    }
  }, [isDubbingActive, isSubtitlesActive]);
  
  const startAiSession = useCallback(async () => {
    if (!sourceNodeRef.current || !audioContextRef.current) {
        console.error("Audio graph not ready.");
        return;
    }

    if (isAiSessionActive) {
      stopAiSession();
    }
    
    try {
        // Resume context if needed
        if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
        }

        const session = await geminiService.startTranslationSession(
            handleMessage,
            (e) => {
              console.error('Gemini Error:', e);
              stopAiSession();
            },
            (e) => {
                console.log('Gemini session closed');
                stopAiSession();
            },
            targetLanguage
        );
        
        setIsAiSessionActive(true);

        const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
        outputAudioContextRef.current = new AudioCtor({ sampleRate: 24000 });
        if(outputAudioContextRef.current.state === 'suspended') {
          await outputAudioContextRef.current.resume();
        }
        
        const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
        scriptProcessorRef.current = processor;
        
        processor.onaudioprocess = (audioProcessingEvent) => {
            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
            const inputSampleRate = audioProcessingEvent.inputBuffer.sampleRate;
            const resampledData = resample(inputData, inputSampleRate, 16000);
            geminiService.sendAudio(resampledData);
        };

        sourceNodeRef.current.connect(processor);
        processor.connect(audioContextRef.current.destination); // Must connect to destination to keep processing

    } catch(err) {
        console.error("Failed to start AI session from component", err);
        stopAiSession();
        setIsDubbingActive(false);
        setIsSubtitlesActive(false);
    }
  }, [targetLanguage, handleMessage, stopAiSession, isAiSessionActive]);
  
  useEffect(() => {
    if (isDubbingActive || isSubtitlesActive) {
      if (!isAiSessionActive) {
        startAiSession();
      }
    } else {
      if (isAiSessionActive) {
        stopAiSession();
      }
    }
  }, [isDubbingActive, isSubtitlesActive, isAiSessionActive, startAiSession, stopAiSession]);

  useEffect(() => {
    if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = isDubbingActive ? 0.2 : 1.0;
    }
  }, [isDubbingActive]);


  const onLanguageChange = useCallback((lang: string) => {
      setTargetLanguage(lang);
      if (isAiSessionActive) {
          startAiSession();
      }
  }, [isAiSessionActive, startAiSession]);

  if (!channel) {
    return (
      <div className="bg-black aspect-video rounded-lg shadow-2xl flex items-center justify-center">
        <div className="text-center">
            <h2 className="text-2xl font-bold mb-2 text-gray-400">AI IPTV Player</h2>
            <p className="text-gray-500">Select a channel from the list to start watching.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-black aspect-video rounded-lg shadow-2xl group">
      <video 
        ref={videoRef} 
        controls 
        className="w-full h-full rounded-lg" 
        crossOrigin="anonymous" 
        onCanPlay={setupAudioGraph}
        />
      {isSubtitlesActive && subtitles && (
          <div className="absolute bottom-16 left-0 right-0 text-center p-4 pointer-events-none">
              <p className="text-white text-lg md:text-xl font-semibold bg-black/60 rounded-md px-4 py-2 inline-block">
                  {subtitles}
              </p>
          </div>
      )}
      <PlayerControls
        isDubbingActive={isDubbingActive}
        onToggleDubbing={() => setIsDubbingActive(p => !p)}
        isSubtitlesActive={isSubtitlesActive}
        onToggleSubtitles={() => setIsSubtitlesActive(p => !p)}
        targetLanguage={targetLanguage}
        onLanguageChange={onLanguageChange}
        supportedLanguages={SUPPORTED_LANGUAGES}
       />
    </div>
  );
};

export default Player;
