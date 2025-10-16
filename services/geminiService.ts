import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, Blob } from '@google/genai';
import { encode } from '../utils/audio';

let ai: GoogleGenAI | null = null;
let activeSession: LiveSession | null = null;

function getAi(): GoogleGenAI {
    if (!ai) {
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    }
    return ai;
}

export const translateGenericText = async (text: string, targetLanguage: string, sourceLanguage: string = "Japonês"): Promise<string> => {
    if (!text.trim()) {
        return "";
    }
    try {
        const genAI = getAi();
        const response = await genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [{
                    text: `Aja como um tradutor especialista. Traduza o texto a seguir de ${sourceLanguage} para ${targetLanguage}. Responda APENAS com o texto traduzido, mantendo a formatação original o máximo possível.\n\nTexto para traduzir:\n"${text}"`
                }]
            },
        });
        return response.text.trim();
    } catch (error) {
        console.error(`Erro ao traduzir texto: ${text}`, error);
        return `[Erro na Tradução]`;
    }
};

export const analyzeScene = async (base64ImageData: string): Promise<string> => {
    const genAI = getAi();
    try {
        const response = await genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    {
                        inlineData: {
                            mimeType: 'image/jpeg',
                            data: base64ImageData,
                        },
                    },
                    {
                        text: `Analise esta imagem de um stream de vídeo e descreva o que está acontecendo em uma frase curta e concisa. A cena é um comercial, uma paisagem, música ou uma cena sem falas? Resuma o contexto visual para um espectador. Responda em português do Brasil.`,
                    },
                ],
            },
        });
        return response.text;
    } catch (error) {
        console.error("Error analyzing scene:", error);
        // Return empty string on error to not disrupt UI
        return "";
    }
};

export const startTranslationSession = async (
    onMessage: (message: LiveServerMessage) => void,
    onError: (error: ErrorEvent) => void,
    onClose: (event: CloseEvent) => void,
    targetLanguage: string,
    maleVoiceName: string,
    femaleVoiceName: string,
    programContext?: { title: string; description?: string }
): Promise<LiveSession> => {
    const genAI = getAi();
    
    // Ensure any existing session is closed before starting a new one.
    await closeSession();
    
    let systemInstruction = `Você é um intérprete de IA de classe mundial para transmissões ao vivo. Sua tarefa é ouvir o áudio em japonês e fornecer dublagem e legendas em ${targetLanguage}. **SUA PRIORIDADE MÁXIMA É A VELOCIDADE E A BAIXÍSSIMA LATÊNCIA.**

1.  **MODO INTÉRPRETE SIMULTÂNEO (CRÍTICO):** Comece a traduzir e falar IMEDIATAMENTE ao ouvir a fala. A latência é mais importante que a perfeição gramatical.

2.  **DETECÇÃO DE GÊNERO E ETIQUETAGEM (FORMATO ESTRITO):** Para cada novo trecho de fala, identifique o gênero do locutor e prefixe a tradução com a etiqueta 'HOMEM:' ou 'MULHER:'. Sua resposta de texto deve conter APENAS a tradução etiquetada. A API usará esta etiqueta para selecionar a voz correta.
    *   **Exemplo de Resposta:** \`HOMEM: O tempo está ótimo hoje, não é?\`
    *   **Exemplo de Resposta:** \`MULHER: Sim, concordo plenamente! Um lindo céu azul.\`

3.  **IDIOMA DE DESTINO:** Para 'Português', use **Português do Brasil**.`;


    if (programContext?.title) {
        systemInstruction += `\n\n4. **Contexto do Programa Atual:** Você está traduzindo um programa chamado "${programContext.title}".`;
        if (programContext.description) {
            systemInstruction += ` A descrição é: "${programContext.description}".`;
        }
        systemInstruction += ` Use este contexto para melhorar a precisão da sua tradução, especialmente para termos técnicos, nomes próprios ou jargões específicos do programa.`;
    }

    const session = await genAI.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
            onopen: () => {
                console.log('Gemini session opened');
            },
            onmessage: onMessage,
            onerror: onError,
            onclose: (e) => {
                // Ensure we only nullify the active session if it's the one that closed.
                if (activeSession === session) {
                    activeSession = null;
                }
                onClose(e);
            },
        },
        config: {
            responseModalities: [Modality.AUDIO],
            outputAudioTranscription: {},
            inputAudioTranscription: {},
            systemInstruction: systemInstruction,
            speechConfig: {
                multiSpeakerVoiceConfig: {
                    speakerVoiceConfigs: [
                        {
                            speaker: 'HOMEM',
                            voiceConfig: {
                                prebuiltVoiceConfig: { voiceName: maleVoiceName }
                            }
                        },
                        {
                            speaker: 'MULHER',
                            voiceConfig: {
                                prebuiltVoiceConfig: { voiceName: femaleVoiceName }
                            }
                        }
                    ]
                }
            },
        },
    });
    
    activeSession = session;
    return session;
};

export const sendAudio = (audioData: Float32Array): void => {
    if (activeSession) {
        const pcmBlob = createPcmBlob(audioData);
        try {
            activeSession.sendRealtimeInput({ media: pcmBlob });
        } catch (e) {
            console.error("Failed to send audio data, session might be closing.", e);
        }
    }
};

export const closeSession = async (): Promise<void> => {
    if (activeSession) {
        const sessionToClose = activeSession;
        // Immediately nullify to prevent new data from being sent to the closing session.
        activeSession = null;
        try {
            sessionToClose.close();
            console.log('Gemini session closed via closeSession call.');
        } catch (e) {
            console.error("Error closing session:", e);
        }
    }
};

function createPcmBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // Clamp the data to the [-1, 1] range before conversion.
    const s = Math.max(-1, Math.min(1, data[i]));
    // Convert to 16-bit signed integer.
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}