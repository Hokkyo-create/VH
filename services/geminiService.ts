import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { encode } from '../utils/audio';

let sessionPromise: Promise<any> | null = null;

// FIX: Implement startTranslationSession to initialize and connect to the Gemini Live API.
export const startTranslationSession = async (
    apiKey: string,
    onMessage: (message: LiveServerMessage) => void,
    onError: (e: ErrorEvent) => void,
    onClose: (e: CloseEvent) => void,
    targetLanguage: string,
    dubbingVoice: string,
    context?: { title: string; description?: string }
) => {
    const ai = new GoogleGenAI({ apiKey });
    
    const systemInstruction = `Você é um tradutor e dublador em tempo real.
Sua tarefa é transcrever o áudio em japonês que você recebe, traduzir a transcrição para ${targetLanguage} e, em seguida, gerar o áudio da tradução.
- Tente ao máximo corresponder ao ritmo, entonação e tom emocional do orador original para uma dublagem mais natural. Se a fala for cantada, tente manter uma cadência melódica na tradução.
- Responda apenas com a fala traduzida. Não adicione nenhuma outra palavra ou explicação.
- Mantenha a tradução concisa e natural para dublagem.
- O idioma de destino para 'Português' é sempre o Português do Brasil.
- Se você puder distinguir entre um orador masculino e feminino, anexe [M]: ou [F]: no início de cada turno de fala traduzido.
${context?.title ? `\nContexto adicional do programa de TV: "${context.title}". ${context.description || ''}. Use isso para melhorar a precisão da tradução.` : ''}`;

    sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
            onopen: () => console.log('Sessão Gemini aberta.'),
            onmessage: onMessage,
            onerror: onError,
            onclose: onClose,
        },
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: dubbingVoice } }
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction: systemInstruction,
        }
    });

    await sessionPromise;
};

// FIX: Implement sendAudio to encode and stream audio data to the active Gemini session.
export const sendAudio = (audioData: Float32Array) => {
    if (!sessionPromise) {
        return;
    }

    const l = audioData.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = audioData[i] * 32768;
    }
    const pcmBlob: Blob = {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };

    sessionPromise.then(session => {
        if (session) {
            session.sendRealtimeInput({ media: pcmBlob });
        }
    });
};

// FIX: Implement closeSession to properly terminate the connection.
export const closeSession = () => {
    if (sessionPromise) {
        sessionPromise.then(session => {
            if (session) {
                session.close();
            }
            sessionPromise = null;
        });
    }
};

// FIX: Re-implement analyzeScene using the Gemini API for multimodal analysis.
export const analyzeScene = async (apiKey: string, base64ImageData: string): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey });
        const textPart = {
            text: "Analise esta imagem de um stream de vídeo e descreva o que está acontecendo em uma frase curta e concisa. A cena é um comercial, uma paisagem, música ou uma cena sem falas? Resuma o contexto visual para um espectador. Responda em português do Brasil."
        };
        const imagePart = {
            inlineData: {
                mimeType: 'image/jpeg',
                data: base64ImageData,
            },
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] },
            config: {
                maxOutputTokens: 100,
            }
        });

        return response.text.trim() || "";
    } catch (error) {
        console.error("Error analyzing scene with Gemini:", error);
        return "";
    }
};

// FIX: Re-implement translateGenericText using the Gemini API.
export const translateGenericText = async (apiKey: string, text: string, targetLanguage: string, sourceLanguage: string = "Japonês"): Promise<string> => {
    if (!text.trim()) return "";
    try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [{ text: `Você é um tradutor. Traduza o texto a seguir de ${sourceLanguage} para ${targetLanguage}. Responda APENAS com o texto traduzido.\n\nTexto: "${text}"` }]
            },
            config: {
                temperature: 0,
            }
        });

        const translatedText = response.text.trim();
        if (translatedText) return translatedText;
        return `[Erro na Tradução]`;
    } catch (error: any) {
        console.error(`Erro ao traduzir texto: ${text}`, error);
        if (error.message?.toLowerCase().includes('api key not valid')) return `[Erro: Chave Inválida]`;
        if (error.message?.toLowerCase().includes('quota')) return `[Erro: Cota Excedida]`;
        return `[Erro na Tradução]`;
    }
};