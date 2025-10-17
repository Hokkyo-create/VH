import React from 'react';
import DubbingIcon from './icons/DubbingIcon';
import SubtitlesIcon from './icons/SubtitlesIcon';
import SceneAnalysisIcon from './icons/SceneAnalysisIcon';
import OcrIcon from './icons/OcrIcon';
import VolumeIcon from './icons/VolumeIcon';
import PipIcon from './icons/PipIcon';
import FullscreenIcon from './icons/FullscreenIcon';
import PlayIcon from './icons/PlayIcon';
import PauseIcon from './icons/PauseIcon';

interface PlayerControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  isDubbingActive: boolean;
  onToggleDubbing: () => void;
  isSubtitlesActive: boolean;
  onToggleSubtitles: () => void;
  isSceneAnalysisActive: boolean;
  onToggleSceneAnalysis: () => void;
  isOcrActive: boolean;
  onToggleOcr: () => void;
  areAiFeaturesDisabled: boolean;
  targetLanguage: string;
  onLanguageChange: (lang: string) => void;
  supportedLanguages: { code: string; name: string }[];
  maleDubbingVoice: string;
  onMaleDubbingVoiceChange: (voice: string) => void;
  supportedMaleVoices: { code: string; name: string }[];
  femaleDubbingVoice: string;
  onFemaleDubbingVoiceChange: (voice: string) => void;
  supportedFemaleVoices: { code: string; name: string }[];
  volume: number;
  onVolumeChange: (volume: number) => void;
  onTogglePiP: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  isAtLiveEdge: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
}

const PlayerControls: React.FC<PlayerControlsProps> = ({
  isPlaying,
  onTogglePlay,
  currentTime,
  duration,
  onSeek,
  isDubbingActive,
  onToggleDubbing,
  isSubtitlesActive,
  onToggleSubtitles,
  isSceneAnalysisActive,
  onToggleSceneAnalysis,
  isOcrActive,
  onToggleOcr,
  areAiFeaturesDisabled,
  targetLanguage,
  onLanguageChange,
  supportedLanguages,
  maleDubbingVoice,
  onMaleDubbingVoiceChange,
  supportedMaleVoices,
  femaleDubbingVoice,
  onFemaleDubbingVoiceChange,
  supportedFemaleVoices,
  volume,
  onVolumeChange,
  onTogglePiP,
  isFullscreen,
  onToggleFullscreen,
  isAtLiveEdge,
  videoRef,
}) => {
  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds) || !isFinite(timeInSeconds) || timeInSeconds < 0) {
      return '00:00';
    }
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const isLive = duration === Infinity;
  const isSeekable = isFinite(duration) && duration > 0;

  const handleGoToLive = () => {
    if (videoRef.current) {
        const buffer = videoRef.current.buffered;
        if (buffer.length > 0) {
            // Seek to 5 seconds before the end of the buffer to ensure smooth transition
            const livePosition = buffer.end(buffer.length - 1) - 5;
            onSeek(livePosition);
        }
    }
  };


  return (
    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/50 to-transparent flex flex-col opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-300">
      {/* Progress Bar */}
      {isSeekable && (
         <div className="relative w-full flex items-center group/progress mb-2">
            <input
                type="range"
                min="0"
                max={duration}
                value={currentTime}
                onChange={(e) => onSeek(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-gray-600/50 rounded-lg appearance-none cursor-pointer 
                           group-hover/progress:h-2 transition-all duration-200
                           [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 
                           [&::-webkit-slider-thumb]:bg-teal-400 [&::-webkit-slider-thumb]:rounded-full
                           [&::-webkit-slider-thumb]:scale-0 group-hover/progress:[&::-webkit-slider-thumb]:scale-100
                           [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 
                           [&::-moz-range-thumb]:bg-teal-400 [&::-moz-range-thumb]:rounded-full
                           [&::-moz-range-thumb]:scale-0 group-hover/progress:[&::-moz-range-thumb]:scale-100
                           transition-transform duration-200 ease-in-out
                           focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black/50 focus:ring-teal-500"
                aria-label="Seek slider"
            />
        </div>
      )}

      {/* Controls Row */}
      <div className="flex items-center justify-between gap-4">
        {/* Left Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={onTogglePlay}
            title={isPlaying ? 'Pausar' : 'Reproduzir'}
            className="p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
          <div className="flex items-center gap-2 w-28 group/volume">
            <VolumeIcon volume={volume} />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
               className="w-full h-1.5 bg-gray-600/80 rounded-lg appearance-none cursor-pointer 
                           [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 
                           [&::-webkit-slider-thumb]:bg-teal-400 [&::-webkit-slider-thumb]:rounded-full
                           [&::-webkit-slider-thumb]:scale-0 group-hover/volume:[&::-webkit-slider-thumb]:scale-100
                           [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 
                           [&::-moz-range-thumb]:bg-teal-400 [&::-moz-range-thumb]:rounded-full
                           [&::-moz-range-thumb]:scale-0 group-hover/volume:[&::-moz-range-thumb]:scale-100
                           transition-transform duration-200 ease-in-out
                           focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black/50 focus:ring-teal-500"
              title={`Volume: ${Math.round(volume * 100)}%`}
              aria-label="Controle de volume"
            />
          </div>
          <div className="text-white text-sm font-mono select-none">
            {formatTime(currentTime)}
            {isSeekable && ` / ${formatTime(duration)}`}
            {isLive && (
              isAtLiveEdge ? 
              <span className="ml-2 px-1.5 py-0.5 bg-red-600 text-white text-xs font-bold rounded">AO VIVO</span> :
              <button onClick={handleGoToLive} className="ml-2 px-1.5 py-0.5 bg-gray-500 text-white text-xs font-bold rounded hover:bg-gray-400">VOLTAR AO VIVO</button>
            )}
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center justify-end flex-wrap gap-x-1 md:gap-x-2">
            <select
            value={targetLanguage}
            onChange={(e) => onLanguageChange(e.target.value)}
            className="bg-gray-800/80 text-white border border-gray-600 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer text-xs sm:text-sm hover:bg-gray-700/80"
            title="Selecione o idioma de tradução"
            >
            {supportedLanguages.map((lang) => (
                <option key={lang.code} value={lang.name} className="bg-gray-800">
                {lang.name}
                </option>
            ))}
            </select>
            <div className="flex gap-x-1">
                <select
                    value={maleDubbingVoice}
                    onChange={(e) => onMaleDubbingVoiceChange(e.target.value)}
                    className="bg-gray-800/80 text-white border border-gray-600 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer text-xs sm:text-sm hover:bg-gray-700/80 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Voz de IA a ser usada para locutores masculinos"
                    disabled={areAiFeaturesDisabled}
                >
                    {supportedMaleVoices.map((voice) => (
                        <option key={voice.code} value={voice.code} className="bg-gray-800">
                        {voice.name}
                        </option>
                    ))}
                </select>
                <select
                    value={femaleDubbingVoice}
                    onChange={(e) => onFemaleDubbingVoiceChange(e.target.value)}
                    className="bg-gray-800/80 text-white border border-gray-600 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer text-xs sm:text-sm hover:bg-gray-700/80 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Voz de IA a ser usada para locutoras femininas"
                    disabled={areAiFeaturesDisabled}
                >
                    {supportedFemaleVoices.map((voice) => (
                        <option key={voice.code} value={voice.code} className="bg-gray-800">
                        {voice.name}
                        </option>
                    ))}
                </select>
            </div>
            <div className="h-6 w-px bg-gray-600 mx-1"></div>
            <button
              onClick={onToggleOcr}
              title={areAiFeaturesDisabled ? 'Adicione uma chave de API para ativar o OCR' : (isOcrActive ? 'Desativar Tradução de Tela (OCR)' : 'Ativar Tradução de Tela (OCR)')}
              className="p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={areAiFeaturesDisabled}
            >
              <OcrIcon active={isOcrActive} />
            </button>
            <button
              onClick={onToggleSceneAnalysis}
              title={areAiFeaturesDisabled ? 'Adicione uma chave de API para ativar a Análise de Cena' : (isSceneAnalysisActive ? 'Desativar Análise de Cena' : 'Ativar Análise de Cena')}
              className="p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={areAiFeaturesDisabled}
            >
              <SceneAnalysisIcon active={isSceneAnalysisActive} />
            </button>
            <button
              onClick={onToggleSubtitles}
              title={areAiFeaturesDisabled ? 'Adicione uma chave de API para ativar as Legendas' : (isSubtitlesActive ? 'Desativar Legendas' : 'Ativar Legendas')}
              className="p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={areAiFeaturesDisabled}
            >
              <SubtitlesIcon active={isSubtitlesActive} />
            </button>
            <button
              onClick={onToggleDubbing}
              title={areAiFeaturesDisabled ? 'Adicione uma chave de API para ativar a Dublagem' : (isDubbingActive ? 'Desativar Dublagem com IA' : 'Ativar Dublagem com IA')}
              className="p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={areAiFeaturesDisabled}
            >
              <DubbingIcon active={isDubbingActive} />
            </button>
            <div className="h-6 w-px bg-gray-600 mx-1"></div>
            <button
            onClick={onTogglePiP}
            title="Ativar/Desativar Picture-in-Picture"
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
                <PipIcon />
            </button>
            <button
            onClick={onToggleFullscreen}
            title={isFullscreen ? 'Sair da Tela Cheia' : 'Entrar em Tela Cheia'}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
            <FullscreenIcon isFullscreen={isFullscreen} />
            </button>
        </div>
      </div>
    </div>
  );
};

export default PlayerControls;
