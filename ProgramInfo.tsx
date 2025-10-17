import React, { useState, useEffect } from 'react';
import { Channel, Programme } from '../types';
import * as geminiService from '../services/geminiService';
import SpinnerIcon from './icons/SpinnerIcon';

interface ProgramInfoProps {
  channel: Channel | null;
  program: Programme | null;
  targetLanguage: string;
  apiKey: string | null;
}

const ProgramInfo: React.FC<ProgramInfoProps> = ({ channel, program, targetLanguage, apiKey }) => {
  const [translatedProgram, setTranslatedProgram] = useState<{ title: string; desc: string } | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    if (program && targetLanguage !== 'Japonês' && apiKey) {
        let isCancelled = false;
        const translate = async () => {
            setIsTranslating(true);
            setTranslatedProgram(null);
            try {
                const [translatedTitle, translatedDesc] = await Promise.all([
                    geminiService.translateGenericText(apiKey, program.title, targetLanguage),
                    geminiService.translateGenericText(apiKey, program.desc || '', targetLanguage)
                ]);

                if (!isCancelled) {
                    setTranslatedProgram({ title: translatedTitle, desc: translatedDesc });
                }
            } catch (e) {
                console.error("Falha ao traduzir as informações do programa", e);
                if (!isCancelled) {
                    setTranslatedProgram({ title: "[Erro na Tradução]", desc: "" });
                }
            } finally {
                if (!isCancelled) {
                    setIsTranslating(false);
                }
            }
        };
        translate();

        return () => {
            isCancelled = true;
        };
    } else {
        setTranslatedProgram(null);
        setIsTranslating(false);
    }
  }, [program, targetLanguage, apiKey]);

  if (!channel) {
    return null;
  }
  
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const displayTitle = translatedProgram?.title || program?.title;
  const displayDesc = translatedProgram?.desc || program?.desc || 'Nenhuma descrição disponível.';

  return (
    <div className="bg-gray-800 rounded-lg shadow-md p-4 flex flex-col md:flex-row gap-4">
        <div className="flex-shrink-0 flex flex-row md:flex-col items-center md:items-start text-center md:text-left gap-3 md:gap-2 w-full md:w-32">
             {channel.logo ? (
                <img src={channel.logo} alt={channel.name} className="w-16 h-16 object-contain rounded-md bg-gray-700" />
            ) : (
                <div className="w-16 h-16 rounded-md bg-gray-700 flex items-center justify-center text-teal-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.5A4.5 4.5 0 0 0 18 2c-1.5 0-2.75 1.06-4 1.06-3 0-6-8-6-12.5A4.5 4.5 0 0 0 6 2c-1.5 0-2.75 1.06-4 1.06-3 0-6-8-6-12.5A4.5 4.5 0 0 0 2 2c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.5Z"/><path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.5A4.5 4.5 0 0 0 18 2c-1.5 0-2.75 1.06-4 1.06-3 0-6-8-6-12.5A4.5 4.5 0 0 0 6 2c-1.5 0-2.75 1.06-4 1.06-3 0-6-8-6-12.5A4.5 4.5 0 0 0 2 2c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.5Z"/></svg>
                </div>
            )}
            <p className="font-semibold text-gray-300 md:mt-2 truncate" title={channel.name}>{channel.name}</p>
        </div>
        
        <div className="hidden md:block w-px bg-gray-700"></div>

        <div className="flex-grow min-w-0">
        {program ? (
            <>
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-teal-400 truncate" title={displayTitle}>{displayTitle}</h3>
                    {isTranslating && <SpinnerIcon />}
                </div>
                <p className="text-sm text-gray-400 mb-2">
                    {formatTime(program.start)} - {formatTime(program.stop)}
                </p>
                <div className="text-sm text-gray-300 max-h-24 overflow-y-auto pr-2">
                    <p style={{ whiteSpace: 'pre-wrap' }}>{displayDesc}</p>
                </div>
            </>
        ) : (
            <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">Nenhuma informação de programa disponível.</p>
            </div>
        )}
        </div>
    </div>
  );
};

export default ProgramInfo;
