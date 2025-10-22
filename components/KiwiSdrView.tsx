import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Station } from '../types';
import * as geminiService from '../services/geminiService';
import { loadSettings, saveSettings } from '../services/storageService';
import { decode, decodeAudioData, resample } from '../utils/audio';
import type { LiveServerMessage } from '@google/genai';

import PlayIcon from './icons/PlayIcon';
import PauseIcon from './icons/PauseIcon';
import DubbingIcon from './icons/DubbingIcon';
import SubtitlesIcon from './icons/SubtitlesIcon';
import VolumeIcon from './icons/VolumeIcon';
import SpinnerIcon from './icons/SpinnerIcon';


// To make TypeScript happy with global vars from scripts
declare const L: any; // Declare Leaflet global
declare global {
    interface Window {
        static_rx_data: any[] | undefined;
        kiwisdr_com_data: any[] | undefined;
        snr_data: { [key: string]: number[] } | undefined;
    }
}


interface KiwiSdrViewProps {
    apiKey: string | null;
    onInvalidApiKey: () => void;
    targetLanguage: string;
    onLanguageChange: (language: string) => void;
}

interface Subtitle {
    text: string;
    speaker: 'Homem' | 'Mulher' | null;
}

const SUPPORTED_LANGUAGES = [
    { code: 'pt', name: 'Português (Brasil)' }, { code: 'en', name: 'Inglês' },
    { code: 'es', name: 'Espanhol' }, { code: 'fr', name: 'Francês' },
    { code: 'de', name: 'Alemão' }, { code: 'it', name: 'Italiano' },
    { code: 'ja', name: 'Japonês' }, { code: 'ko', name: 'Coreano' },
    { code: 'ru', name: 'Russo' }, { code: 'zh', name: 'Chinês' },
];

const SUPPORTED_VOICES = [
    { code: 'Puck', name: 'Puck (Masculino)' }, { code: 'Fenrir', name: 'Fenrir (Masculino)' },
    { code: 'Kore', name: 'Kore (Feminino)' }, { code: 'Charon', name: 'Charon (Feminino)' },
    { code: 'Zephyr', name: 'Zephyr (Neutro)' },
];

const KiwiSdrView: React.FC<KiwiSdrViewProps> = ({ apiKey, onInvalidApiKey, targetLanguage, onLanguageChange }) => {
    const [stations, setStations] = useState<Station[]>([]);
    const [selectedStation, setSelectedStation] = useState<Station | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [loadingError, setLoadingError] = useState<string | null>(null);
    
    const mapRef = useRef<any>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const markersRef = useRef<any[]>([]);
    const audioRef = useRef<HTMLAudioElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
    const gainNodeRef = useRef<GainNode | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const dubbingGainNodeRef = useRef<GainNode | null>(null);
    
    const initialSettings = loadSettings();
    const [isDubbingActive, setIsDubbingActive] = useState(initialSettings.isDubbingActive ?? false);
    const [isSubtitlesActive, setIsSubtitlesActive] = useState(initialSettings.isSubtitlesActive ?? false);
    const [dubbingVoice, setDubbingVoice] = useState(initialSettings.dubbingVoice ?? 'Zephyr');
    const [volume, setVolume] = useState(initialSettings.volume ?? 1);
    const [subtitle, setSubtitle] = useState<Subtitle | null>(null);
    const [aiError, setAiError] = useState<string | null>(null);
    const currentTurnTranscriptionRef = useRef({ text: '', speaker: null as 'Homem' | 'Mulher' | null });
    const nextStartTimeRef = useRef(0);
    const scheduledSourcesRef = useRef(new Set<AudioBufferSourceNode>());

    useEffect(() => { saveSettings({ isDubbingActive }); }, [isDubbingActive]);
    useEffect(() => { saveSettings({ isSubtitlesActive }); }, [isSubtitlesActive]);
    useEffect(() => { saveSettings({ dubbingVoice }); }, [dubbingVoice]);
    useEffect(() => { saveSettings({ volume }); }, [volume]);

    // Initialize map and process pre-loaded data
    useEffect(() => {
        const POLLING_INTERVAL = 100;
        const TIMEOUT = 10000; // 10 seconds
        let elapsedTime = 0;
        let pollingInterval: number;

        const checkDependencies = (): string[] => {
            const missing: string[] = [];
            if (!mapContainerRef.current) missing.push("Map container");
            if (typeof L === 'undefined') missing.push("Leaflet library (L)");
            else if (typeof L.terminator !== 'function') missing.push("Leaflet Terminator plugin (L.terminator)");
            if (typeof window.static_rx_data === 'undefined') missing.push("static_rx_data");
            if (typeof window.kiwisdr_com_data === 'undefined') missing.push("kiwisdr_com_data");
            if (typeof window.snr_data === 'undefined') missing.push("snr_data");
            return missing;
        };

        const setupMapAndData = () => {
            const missingDeps = checkDependencies();

            if (missingDeps.length === 0) {
                clearInterval(pollingInterval);
                try {
                    if (!mapRef.current && mapContainerRef.current) {
                        const map = L.map(mapContainerRef.current, { worldCopyJump: true }).setView([20, 0], 3);
                        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                            subdomains: 'abcd',
                            maxZoom: 19
                        }).addTo(map);
                        L.terminator().addTo(map);
                        mapRef.current = map;
                    }

                    const kiwis: Station[] = (window.kiwisdr_com_data || [])
                        .filter((rx: any) => rx.s === 'online' && rx.g && rx.u && rx.p)
                        .map((rx: any) => {
                            const [lat, lng] = rx.g.split(',').map(Number);
                            return { name: rx.n, url: `http://${rx.u}:${rx.p}`, country: rx.c, lat, lng };
                        });

                    const statics: Station[] = (window.static_rx_data || []).map((rx: any) => ({
                        name: rx.name, url: rx.url, country: rx.country, lat: rx.lat, lng: rx.lng
                    }));
                    
                    setStations([...statics, ...kiwis]);
                } catch (error) {
                    console.error("Failed to process station data", error);
                    setLoadingError("Falha ao processar dados dos receptores.");
                } finally {
                    setIsLoadingData(false);
                }
            } else {
                elapsedTime += POLLING_INTERVAL;
                if (elapsedTime >= TIMEOUT) {
                    clearInterval(pollingInterval);
                    console.error("Map dependencies failed to load:", missingDeps.join(', '));
                    setLoadingError(`Não foi possível carregar os recursos do mapa. Verifique sua conexão. (${missingDeps[0]})`);
                    setIsLoadingData(false);
                }
            }
        };

        setIsLoadingData(true);
        setLoadingError(null);
        pollingInterval = window.setInterval(setupMapAndData, POLLING_INTERVAL);

        return () => {
            clearInterval(pollingInterval);
            if (mapRef.current) {
                try {
                    mapRef.current.remove();
                } catch (e) {
                    console.error("Error removing map instance:", e);
                }
                mapRef.current = null;
            }
        };
    }, []);

    // Render markers on the map when station data is available
    useEffect(() => {
        if (!mapRef.current || stations.length === 0) return;
        
        // Clear previous markers
        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = [];

        const snr_color = (snr: number | null): string => {
            if (snr === null) return "#0000ff";
            if (snr >= 17) return "#ff0000";
            if (snr >= 14) return "#ff8000";
            if (snr >= 11) return "#ffff00";
            if (snr >= 8) return "#80ff00";
            if (snr >= 5) return "#00ff00";
            return "#0000ff";
        };

        const get_snr = (rx_url: string): number | null => {
            if (typeof window.snr_data === 'undefined') return null;
            for (const key in window.snr_data) {
                if (rx_url.includes(key)) {
                    const values = window.snr_data[key];
                    return values[values.length - 1];
                }
            }
            return null;
        };
        
        stations.forEach(station => {
            const snr = get_snr(station.url);
            const color = snr_color(snr);
            
            const icon = L.divIcon({
                html: `
                    <div class="relative flex items-center justify-center cursor-pointer group">
                        <div class="absolute w-6 h-6 rounded-full animate-ping opacity-60" style="background-color: ${color};"></div>
                        <div class="relative w-4 h-4 rounded-full border-2 border-gray-900 group-hover:scale-125 transition-transform" style="background-color: ${color};"></div>
                    </div>
                `,
                className: '',
                iconSize: [24, 24],
                iconAnchor: [12, 12],
            });

            const marker = L.marker([station.lat, station.lng], { icon }).addTo(mapRef.current);
            marker.bindTooltip(`<b>${station.name}</b><br><span class="text-gray-400">${station.country}</span>`);
            marker.on('click', () => {
                setSelectedStation(station);
                mapRef.current.flyTo([station.lat, station.lng], Math.max(mapRef.current.getZoom(), 5));
            });
            markersRef.current.push(marker);
        });

    }, [stations]);

    const handleAiError = useCallback((message: string, isAuthError: boolean = false) => {
        console.error("Erro de IA:", message);
        setAiError(message);
        setIsDubbingActive(false);
        setIsSubtitlesActive(false);
        if (isAuthError) onInvalidApiKey();
    }, [onInvalidApiKey]);
    
    useEffect(() => {
      if (aiError) {
        const timer = setTimeout(() => setAiError(null), 8000);
        return () => clearTimeout(timer);
      }
    }, [aiError]);

    const handleMessage = useCallback(async (message: LiveServerMessage) => {
        if (isSubtitlesActive && message.serverContent?.outputTranscription) {
            let textChunk = message.serverContent.outputTranscription.text;
            if (currentTurnTranscriptionRef.current.text === '') {
                 if (textChunk.startsWith('[M]:')) {
                    currentTurnTranscriptionRef.current.speaker = 'Homem';
                    textChunk = textChunk.substring(4).trim();
                } else if (textChunk.startsWith('[F]:')) {
                    currentTurnTranscriptionRef.current.speaker = 'Mulher';
                    textChunk = textChunk.substring(4).trim();
                } else {
                    currentTurnTranscriptionRef.current.speaker = null;
                    textChunk = textChunk.trim();
                }
            } else {
                textChunk = textChunk.trim();
            }

            if(textChunk) {
              currentTurnTranscriptionRef.current.text += (currentTurnTranscriptionRef.current.text ? ' ' : '') + textChunk;
            }

            setSubtitle({ text: currentTurnTranscriptionRef.current.text, speaker: currentTurnTranscriptionRef.current.speaker });
        }

        if (message.serverContent?.turnComplete) {
            currentTurnTranscriptionRef.current = { text: '', speaker: null };
            setTimeout(() => setSubtitle(null), 2000); // Hide subtitle after a delay
        }

        if (isDubbingActive && outputAudioContextRef.current) {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
            if (base64Audio) {
                const outputCtx = outputAudioContextRef.current;
                const audioBuffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
                const scheduleTime = Math.max(outputCtx.currentTime, nextStartTimeRef.current);
                const source = outputCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(dubbingGainNodeRef.current!);
                source.start(scheduleTime);
                nextStartTimeRef.current = scheduleTime + audioBuffer.duration;
                scheduledSourcesRef.current.add(source);
                source.onended = () => scheduledSourcesRef.current.delete(source);
            }
        }
    }, [isSubtitlesActive, isDubbingActive]);

    const stopLiveDubbing = useCallback(() => {
        scheduledSourcesRef.current.forEach(source => {
            try { source.stop(); } catch(e) {}
        });
        scheduledSourcesRef.current.clear();
        nextStartTimeRef.current = 0;
    }, []);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !selectedStation) return;

        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(selectedStation.url)}`;
        audio.src = proxyUrl;
        audio.crossOrigin = 'anonymous';

        const playAudio = async () => {
            try {
                if (audioContextRef.current?.state === 'suspended') await audioContextRef.current.resume();
                await audio.play();
                setIsPlaying(true);
            } catch (error) { console.error("Autoplay falhou:", error); setIsPlaying(false); }
        };

        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);

        audio.addEventListener('canplay', playAudio);
        audio.addEventListener('play', onPlay);
        audio.addEventListener('pause', onPause);

        return () => {
            audio.removeEventListener('canplay', playAudio);
            audio.removeEventListener('play', onPlay);
            audio.removeEventListener('pause', onPause);
            audio.pause();
            audio.removeAttribute('src');
            audio.load();
            setIsPlaying(false);
        };
    }, [selectedStation]);

    useEffect(() => {
        const audio = audioRef.current;
        const isAiNeeded = (isDubbingActive || isSubtitlesActive) && selectedStation;

        const teardownAiConnection = () => {
            geminiService.closeSession();
            stopLiveDubbing();
            if (outputAudioContextRef.current) {
                outputAudioContextRef.current.close().catch(console.error);
                outputAudioContextRef.current = null;
                dubbingGainNodeRef.current = null;
            }
            if (scriptProcessorRef.current && gainNodeRef.current && audioContextRef.current) {
                try {
                    gainNodeRef.current.disconnect(scriptProcessorRef.current);
                    scriptProcessorRef.current.disconnect(audioContextRef.current.destination);
                } catch (e) {}
                scriptProcessorRef.current = null;
            }
            if (sourceNodeRef.current && gainNodeRef.current && audioContextRef.current) {
                try {
                    sourceNodeRef.current.disconnect();
                    gainNodeRef.current.disconnect();
                    sourceNodeRef.current.connect(gainNodeRef.current);
                    gainNodeRef.current.connect(audioContextRef.current.destination);
                } catch (e) {
                    console.warn("Não foi possível restaurar o caminho de áudio padrão.", e);
                }
            }
        };

        if (!isAiNeeded || !audio || !apiKey) {
            teardownAiConnection();
            return;
        }

        if (!audioContextRef.current) {
            const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
            audioContextRef.current = new AudioCtor();
        }
        
        const audioCtx = audioContextRef.current;
        
        const setupAiConnection = async () => {
            setAiError(null);
            await audioCtx.resume();
            
            if (!sourceNodeRef.current) sourceNodeRef.current = audioCtx.createMediaElementSource(audio);
            if (!gainNodeRef.current) gainNodeRef.current = audioCtx.createGain();

            const processor = audioCtx.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (event) => {
                const inputData = event.inputBuffer.getChannelData(0);
                const resampledData = resample(inputData, event.inputBuffer.sampleRate, 16000);
                geminiService.sendAudio(resampledData);
            };
            scriptProcessorRef.current = processor;
            
            try {
                sourceNodeRef.current.disconnect();
                gainNodeRef.current.disconnect();
                sourceNodeRef.current.connect(gainNodeRef.current);
                gainNodeRef.current.connect(processor);
                processor.connect(audioCtx.destination);
            } catch (e) {
                 console.warn("Erro ao configurar o caminho de áudio da IA:", e);
            }
            
            try {
                await geminiService.startTranslationSession(apiKey, handleMessage,
                    (e) => handleAiError("A conexão com a IA foi interrompida."),
                    (e) => console.log('Sessão Gemini fechada.'),
                    targetLanguage, dubbingVoice
                );
                const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
                outputAudioContextRef.current = new AudioCtor({ sampleRate: 24000 });
                dubbingGainNodeRef.current = outputAudioContextRef.current.createGain();
                dubbingGainNodeRef.current.connect(outputAudioContextRef.current.destination);
                await outputAudioContextRef.current.resume();
            } catch (err: any) {
                const isAuthError = err.message?.includes('API key not valid');
                handleAiError(isAuthError ? "Chave de API do Gemini inválida." : "Não foi possível iniciar a sessão de IA.", isAuthError);
            }
        };

        setupAiConnection();
        return teardownAiConnection;

    }, [apiKey, selectedStation, isDubbingActive, isSubtitlesActive, targetLanguage, dubbingVoice, handleMessage, handleAiError, stopLiveDubbing]);

    useEffect(() => {
        if (gainNodeRef.current && audioContextRef.current) {
            gainNodeRef.current.gain.linearRampToValueAtTime(isDubbingActive ? 0.4 * volume : volume, audioContextRef.current.currentTime + 0.1);
        } else if(audioRef.current) {
            audioRef.current.volume = isDubbingActive ? 0.4 * volume : volume;
        }

        if (dubbingGainNodeRef.current && outputAudioContextRef.current) {
            dubbingGainNodeRef.current.gain.linearRampToValueAtTime(isDubbingActive ? volume : 0, outputAudioContextRef.current.currentTime + 0.1);
        }
    }, [isDubbingActive, volume]);

    const handleTogglePlay = async () => {
        if (!audioRef.current) return;
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
        }
        if (isPlaying) audioRef.current.pause();
        else await audioRef.current.play();
    };
    
    const subtitleColor = subtitle?.speaker === 'Homem' ? 'text-cyan-300' 
                        : subtitle?.speaker === 'Mulher' ? 'text-pink-300' 
                        : 'text-white';

    return (
        <div className="flex-grow relative overflow-hidden rounded-lg bg-gray-800">
            <div ref={mapContainerRef} id="map-container" className="w-full h-full" />
            <audio ref={audioRef} />

            {(isLoadingData || loadingError) && (
                <div className="absolute inset-0 bg-gray-900/70 backdrop-blur-sm flex items-center justify-center z-30">
                    {isLoadingData ? (
                        <div className="flex flex-col items-center gap-2">
                            <SpinnerIcon />
                            <p className="text-gray-300">Carregando receptores de rádio do mundo todo...</p>
                        </div>
                    ) : (
                       loadingError && (
                            <div className="text-center p-4 bg-red-900/50 rounded-lg border border-red-700">
                                <h3 className="font-bold text-red-300 text-lg">Erro ao Carregar Mapa</h3>
                                <p className="text-red-400 mt-2">{loadingError}</p>
                            </div>
                       )
                    )}
                </div>
            )}

            <div className="absolute top-2 left-2 bg-gray-900/70 p-2 rounded-md z-10 text-xs text-gray-400">
                <p>Cores dos Marcadores (Sensibilidade):</p>
                <div className="flex items-center gap-2 mt-1">
                    <div className="w-3 h-3 rounded-full" style={{backgroundColor: '#ff0000'}}></div><span>Ótima</span>
                    <div className="w-3 h-3 rounded-full" style={{backgroundColor: '#ffff00'}}></div><span>Boa</span>
                    <div className="w-3 h-3 rounded-full" style={{backgroundColor: '#00ff00'}}></div><span>Média</span>
                    <div className="w-3 h-3 rounded-full" style={{backgroundColor: '#0000ff'}}></div><span>Fraca</span>
                </div>
            </div>

            <div className={`absolute top-4 left-1/2 -translate-x-1/2 text-center p-4 pointer-events-none transition-opacity duration-300 ease-in-out ${subtitle ? 'opacity-100' : 'opacity-0'} z-10`}>
                <p className={`text-xl md:text-2xl font-semibold bg-black/75 rounded-lg px-4 py-2 inline-block ${subtitleColor}`} style={{ textShadow: '2px 2px 5px rgba(0,0,0,0.8)' }}>
                    {subtitle?.text}
                </p>
            </div>
            
             {aiError && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 w-11/12 max-w-lg p-3 bg-red-800/90 border border-red-600 rounded-lg text-center z-20 transition-opacity duration-300 ease-in-out animate-pulse">
                  <p className="text-white font-semibold text-sm sm:text-base">{aiError}</p>
              </div>
            )}
            
            {selectedStation && (
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent z-10">
                    <div className="bg-gray-800/80 backdrop-blur-sm p-4 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                            {selectedStation.favicon && <img src={selectedStation.favicon} alt={selectedStation.name} className="w-12 h-12 rounded-md object-contain bg-white/10 p-1" />}
                            <div className="min-w-0">
                                <p className="font-bold text-lg truncate" title={selectedStation.name}>{selectedStation.name}</p>
                                <p className="text-sm text-gray-400">{selectedStation.country}</p>
                            </div>
                        </div>

                        <div className="flex items-center flex-wrap justify-center gap-x-3 gap-y-2">
                           <div className="flex items-center gap-3">
                                <button onClick={handleTogglePlay} title={isPlaying ? 'Pausar' : 'Reproduzir'} className="p-1 rounded-full hover:bg-white/10 transition-colors" disabled={!selectedStation}>
                                    {isPlaying ? <PauseIcon /> : <PlayIcon />}
                                </button>
                                <div className="flex items-center gap-2 w-28 group/volume">
                                    <VolumeIcon volume={volume} />
                                    <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-600/80 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-teal-400 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:scale-0 group-hover/volume:[&::-webkit-slider-thumb]:scale-100 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:bg-teal-400 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:scale-0 group-hover/volume:[&::-moz-range-thumb]:scale-100 transition-transform duration-200 ease-in-out" title={`Volume: ${Math.round(volume * 100)}%`} aria-label="Controle de volume" />
                                </div>
                           </div>
                           <div className="h-8 w-px bg-gray-600"></div>
                           <div className="flex items-center gap-1">
                             <select value={targetLanguage} onChange={(e) => onLanguageChange(e.target.value)} className="bg-gray-700/80 text-white border border-gray-600 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer text-xs sm:text-sm hover:bg-gray-600/80">
                                {SUPPORTED_LANGUAGES.map((lang) => <option key={lang.code} value={lang.name} className="bg-gray-800">{lang.name}</option>)}
                            </select>
                             <select value={dubbingVoice} onChange={(e) => setDubbingVoice(e.target.value)} className="bg-gray-700/80 text-white border border-gray-600 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer text-xs sm:text-sm hover:bg-gray-600/80 disabled:opacity-50" disabled={!apiKey}>
                                {SUPPORTED_VOICES.map((voice) => <option key={voice.code} value={voice.code} className="bg-gray-800">{voice.name}</option>)}
                            </select>
                           </div>
                           <div className="h-8 w-px bg-gray-600"></div>
                           <div className="flex items-center gap-1">
                            <button onClick={() => setIsSubtitlesActive(p => !p)} title={!apiKey ? 'Adicione uma chave de API para ativar as Legendas' : (isSubtitlesActive ? 'Desativar Legendas' : 'Ativar Legendas')} className="p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={!apiKey}>
                                <SubtitlesIcon active={isSubtitlesActive} />
                            </button>
                            <button onClick={() => setIsDubbingActive(p => !p)} title={!apiKey ? 'Adicione uma chave de API para ativar a Dublagem' : (isDubbingActive ? 'Desativar Dublagem' : 'Ativar Dublagem')} className="p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={!apiKey}>
                                <DubbingIcon active={isDubbingActive} />
                            </button>
                           </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default KiwiSdrView;
