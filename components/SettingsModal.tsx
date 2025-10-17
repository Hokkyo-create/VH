import React, { useState, useEffect } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (apiKey: string) => void;
  currentApiKey: string | null;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave, currentApiKey }) => {
  const [apiKeyInput, setApiKeyInput] = useState('');

  useEffect(() => {
    setApiKeyInput(''); 
  }, [isOpen]);

  const handleSave = () => {
    if (apiKeyInput.trim()) {
      onSave(apiKeyInput.trim());
    }
  };

  if (!isOpen) {
    return null;
  }

  const maskedApiKey = currentApiKey 
    ? `${currentApiKey.substring(0, 4)}...${currentApiKey.substring(currentApiKey.length - 4)}`
    : 'Nenhuma';

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-md p-6 border border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-teal-400 mb-4">Configurações</h2>
        
        <div className="space-y-4">
          <div>
            {/* FIX: Updated label to refer to Gemini API key. */}
            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-300 mb-1">
              Chave de API do Gemini
            </label>
            {/* FIX: Updated description with the correct link for obtaining a Gemini API key. */}
            <p className="text-xs text-gray-400 mb-2">
              Sua chave é salva apenas no seu navegador. Obtenha sua chave em{' '}
              <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-teal-400 hover:underline"
              >
                aistudio.google.com
              </a>.
            </p>
             <p className="text-sm text-gray-500 mb-2">
                Chave Atual: <span className="font-mono bg-gray-700 px-1 rounded">{maskedApiKey}</span>
             </p>
            <input
              type="password"
              id="apiKey"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              // FIX: Updated placeholder text for Gemini API key.
              placeholder="Cole sua chave de API do Gemini aqui"
              className="w-full bg-gray-700 text-gray-200 placeholder-gray-400 border border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            Fechar
          </button>
          <button
            onClick={handleSave}
            disabled={!apiKeyInput.trim()}
            className="px-4 py-2 bg-teal-500 text-white font-bold rounded-md hover:bg-teal-600 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
          >
            Salvar Chave
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;