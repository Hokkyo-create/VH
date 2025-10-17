import React, { useRef } from 'react';
import SpinnerIcon from './icons/SpinnerIcon';
import ClearIcon from './icons/ClearIcon';

interface UrlInputProps {
  onSubmit: (url: string) => void;
  onFileContent: (content: string) => void;
  isLoading: boolean;
  m3uUrl: string;
  onUrlChange: (url: string) => void;
  onClear: () => void;
}

const UrlInput: React.FC<UrlInputProps> = ({ onSubmit, onFileContent, isLoading, m3uUrl, onUrlChange, onClear }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(m3uUrl);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          onFileContent(content);
        }
      };
      reader.readAsText(file);
    }
     // Limpa o valor do input de arquivo para permitir o reenvio do mesmo arquivo
    e.target.value = '';
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-md">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-grow">
          <input
            type="text"
            value={m3uUrl}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="Digite a URL da sua lista de reprodução M3U aqui..."
            className="w-full bg-gray-700 text-gray-200 placeholder-gray-400 border border-gray-600 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 pr-10"
            disabled={isLoading}
          />
          {m3uUrl && (
            <button
              type="button"
              onClick={onClear}
              className="absolute inset-y-0 right-0 flex items-center pr-3 group"
              title="Limpar URL e carregar lista padrão"
              disabled={isLoading}
            >
              <ClearIcon />
            </button>
          )}
        </div>
        <button
          type="submit"
          className="bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-6 rounded-md transition-colors duration-300 flex items-center justify-center disabled:bg-gray-600 disabled:cursor-not-allowed"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <SpinnerIcon />
              Carregando...
            </>
          ) : (
            'Carregar Lista'
          )}
        </button>
      </form>
       <div className="mt-3 text-center">
        <p className="text-gray-400 text-sm mb-2">OU</p>
         <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept=".m3u,.m3u8"
            disabled={isLoading}
          />
        <button 
            onClick={handleUploadClick}
            disabled={isLoading}
            className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded-md transition-colors duration-300 disabled:bg-gray-700 disabled:cursor-not-allowed"
        >
          Enviar Arquivo M3U
        </button>
      </div>
    </div>
  );
};

export default UrlInput;