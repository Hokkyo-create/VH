import React, { useState, useRef } from 'react';
import SpinnerIcon from './icons/SpinnerIcon';

interface UrlInputProps {
  onSubmit: (url: string) => void;
  onFileContent: (content: string) => void;
  isLoading: boolean;
}

const UrlInput: React.FC<UrlInputProps> = ({ onSubmit, onFileContent, isLoading }) => {
  const [url, setUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(url);
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
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-md">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Digite a URL da sua lista de reprodução M3U aqui..."
          className="flex-grow bg-gray-700 text-gray-200 placeholder-gray-400 border border-gray-600 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
          disabled={isLoading}
        />
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
