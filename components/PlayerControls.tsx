import React from 'react';
import DubbingIcon from './icons/DubbingIcon';
import SubtitlesIcon from './icons/SubtitlesIcon';
import SceneAnalysisIcon from './icons/SceneAnalysisIcon';
import OcrIcon from './icons/OcrIcon';
import VolumeIcon from './icons/VolumeIcon';
import PipIcon from './icons/PipIcon';
import FullscreenIcon from './icons/FullscreenIcon';

interface PlayerControlsProps {
  isDubbingActive: boolean;
  onToggleDubbing: () => void;
  isSubtitlesActive: boolean;
  onToggleSubtitles: () => void;
  isSceneAnalysisActive: boolean;
  onToggleSceneAnalysis: () => void;
  isOcrActive: boolean;
  onToggleOcr: () => void;
  targetLanguage: string;
  onLanguageChange: (lang: string) => void;
  supportedLanguages: { code: string; name: string }[];
  volume: number;
  onVolumeChange: (volume: number) => void;
  onTogglePiP: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

const PlayerControls: React.FC<PlayerControlsProps> = ({
  isDubbingActive,
  onToggleDubbing,
  isSubtitlesActive,
  onToggleSubtitles,
  isSceneAnalysisActive,
  onToggleSceneAnalysis,
  isOcrActive,
  onToggleOcr,
  targetLanguage,
  onLanguageChange,
  supportedLanguages,
  volume,
  onVolumeChange,
  onTogglePiP,
  isFullscreen,
  onToggleFullscreen,
}) => {
  return (
    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-300">
      <div className="flex items-center gap-3 w-1/3 max-w-[200px]">
        <VolumeIcon volume={volume} />
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-teal-400 [&::-webkit-slider-thumb]:rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black/50 focus:ring-teal-500"
          title={`Volume: ${Math.round(volume * 100)}%`}
          aria-label="Volume control"
        />
      </div>
      <div className="flex items-center gap-2 md:gap-4">
        <select
          value={targetLanguage}
          onChange={(e) => onLanguageChange(e.target.value)}
          className="bg-gray-800/70 text-white border border-gray-600 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer text-sm"
          title="Selecione o idioma de tradução"
        >
          {supportedLanguages.map((lang) => (
            <option key={lang.code} value={lang.name}>
              {lang.name}
            </option>
          ))}
        </select>
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
        <button
          onClick={onToggleOcr}
          title={isOcrActive ? 'Desativar Tradução de Tela (OCR)' : 'Ativar Tradução de Tela (OCR)'}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <OcrIcon active={isOcrActive} />
        </button>
        <button
          onClick={onToggleSceneAnalysis}
          title={isSceneAnalysisActive ? 'Desativar Análise de Cena' : 'Ativar Análise de Cena'}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <SceneAnalysisIcon active={isSceneAnalysisActive} />
        </button>
        <button
          onClick={onToggleSubtitles}
          title={isSubtitlesActive ? 'Desativar Legendas' : 'Ativar Legendas'}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <SubtitlesIcon active={isSubtitlesActive} />
        </button>
        <button
          onClick={onToggleDubbing}
          title={isDubbingActive ? 'Desativar Dublagem com IA' : 'Ativar Dublagem com IA'}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <DubbingIcon active={isDubbingActive} />
        </button>
      </div>
    </div>
  );
};

export default PlayerControls;