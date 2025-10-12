import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, Blob } from '@google/genai';
import { encode } from '../utils/audio';

let ai: GoogleGenAI | null = null;
let sessionPromise: Promise<LiveSession> | null = null;

function getAi(): GoogleGenAI {
    if (!ai) {
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    }
    return ai;
}

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

export const startTranslationSession = (
    onMessage: (message: LiveServerMessage) => void,
    onError: (error: ErrorEvent) => void,
    onClose: (event: CloseEvent) => void,
    targetLanguage: string,
): Promise<LiveSession> => {
    const genAI = getAi();
    
    // Ensure any existing session is closed before starting a new one.
    if (sessionPromise) {
        closeSession();
    }
    
    sessionPromise = genAI.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
            onopen: () => {
                console.log('Gemini session opened');
            },
            onmessage: onMessage,
            onerror: onError,
            onclose: onClose,
        },
        config: {
            responseModalities: [Modality.AUDIO],
            outputAudioTranscription: {},
            inputAudioTranscription: {},
            // Updated system instruction for maximum efficiency and real-time summarization.
            systemInstruction: `Você é um tradutor e dublador de IA em tempo real de classe mundial, otimizado para velocidade e eficiência máximas. Sua tarefa é ouvir o áudio de entrada (provavelmente em japonês) e traduzi-lo para o idioma de destino: ${targetLanguage}. **IMPORTANTE: Se o idioma de destino for 'Português', a tradução DEVE ser para Português do Brasil.**

1. **Tradução Eficiente (Essência Rápida):** A prioridade MÁXIMA é a velocidade. Analise o áudio de entrada e capture a *essência* da mensagem o mais rápido possível. Em vez de uma tradução literal palavra por palavra, forneça uma tradução concisa e direta que transmita o significado principal. Resuma ou parafraseie frases longas para entregar a informação crucial em tempo real. O objetivo é a comunicação instantânea.

2. **Qualidade da Voz:** A dublagem deve ser expressiva. Identifique o gênero do locutor pela voz original. Para vozes masculinas, use um tom de voz mais grave. Para vozes femininas, um tom mais agudo. Varie a entonação, o ritmo e a emoção para corresponder ao áudio original, mas sem sacrificar a velocidade.

3. **Formato da Legenda:** Para o texto da legenda, SEMPRE prefixe a tradução com '[MALE]' para locutor masculino ou '[FEMALE]' para locutor feminino. Exemplo: '[MALE] Olá, como você está?' ou '[FEMALE] O tempo hoje está lindo.'

4. **Operação em Tempo Real:** A latência é crítica. Traduza e fale em segmentos de áudio curtos e contínuos assim que os ouvir, sem esperar que a frase inteira termine. Aja como um intérprete de conferência, não como um tradutor de documentos.`,
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
            },
        },
    });

    return sessionPromise;
};

export const sendAudio = (audioData: Float32Array): void => {
    if (sessionPromise) {
        const pcmBlob = createPcmBlob(audioData);
        sessionPromise.then((session) => {
            session.sendRealtimeInput({ media: pcmBlob });
        });
    }
};

export const closeSession = (): void => {
    if (sessionPromise) {
        sessionPromise.then(session => {
            session.close();
            console.log('Gemini session closed via closeSession call.');
        }).catch(e => console.error("Error closing session:", e));
        sessionPromise = null;
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