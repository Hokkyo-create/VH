import React from 'react';
import DubbingIcon from './icons/DubbingIcon';
import SubtitlesIcon from './icons/SubtitlesIcon';
import SceneAnalysisIcon from './icons/SceneAnalysisIcon';

interface PlayerControlsProps {
  isDubbingActive: boolean;
  onToggleDubbing: () => void;
  isSubtitlesActive: boolean;
  onToggleSubtitles: () => void;
  isSceneAnalysisActive: boolean;
  onToggleSceneAnalysis: () => void;
  targetLanguage: string;
  onLanguageChange: (lang: string) => void;
  supportedLanguages: { code: string; name: string }[];
}

const PlayerControls: React.FC<PlayerControlsProps> = ({
  isDubbingActive,
  onToggleDubbing,
  isSubtitlesActive,
  onToggleSubtitles,
  isSceneAnalysisActive,
  onToggleSceneAnalysis,
  targetLanguage,
  onLanguageChange,
  supportedLanguages,
}) => {
  return (
    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-end opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-300">
      <div className="flex items-center gap-4">
        <select
          value={targetLanguage}
          onChange={(e) => onLanguageChange(e.target.value)}
          className="bg-gray-800/70 text-white border border-gray-600 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
          title="Selecione o idioma de tradução"
        >
          {supportedLanguages.map((lang) => (
            <option key={lang.code} value={lang.name}>
              {lang.name}
            </option>
          ))}
        </select>
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