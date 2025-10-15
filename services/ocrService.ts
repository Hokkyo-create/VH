import { GoogleGenAI } from '@google/genai';
import { OcrResult } from '../types';

// This declares the Tesseract object from the CDN script to TypeScript
declare const Tesseract: any;

export interface OcrAndSummaryResult {
  translatedBlocks: OcrResult[];
  summary: string;
}

// Gemini setup
let ai: GoogleGenAI | null = null;
function getAi(): GoogleGenAI {
    if (!ai) {
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    }
    return ai;
}

let tesseractWorker: any | null = null;

async function getTesseractWorker(): Promise<any> {
    if (!tesseractWorker) {
        // Initialize worker for Japanese
        tesseractWorker = await Tesseract.createWorker('jpn');
    }
    return tesseractWorker;
}

async function translateTextWithGemini(text: string, targetLanguageCode: string): Promise<string> {
    if (!text.trim()) {
        return "";
    }
    try {
        const genAI = getAi();
        // A simple mapping to provide a clearer language name to the model.
        const languageMap: { [key: string]: string } = {
            'pt': 'Português (Brasil)',
            'en': 'Inglês',
            'es': 'Espanhol',
            'fr': 'Francês',
            'de': 'Alemão',
            'it': 'Italiano',
            'ja': 'Japonês',
            'ko': 'Coreano',
            'ru': 'Russo',
            'zh': 'Chinês',
        };
        const targetLanguageName = languageMap[targetLanguageCode as keyof typeof languageMap] || targetLanguageCode;

        const response = await genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [{
                    text: `Você é um motor de tradução altamente eficiente. Traduza o seguinte texto em japonês para ${targetLanguageName}. Forneça apenas o texto traduzido bruto, sem frases introdutórias, explicações ou rótulos como "Tradução:". Preserve as quebras de linha do texto original.\n\nTexto em japonês:\n"${text}"`
                }]
            },
        });
        return response.text.trim();
    } catch (error) {
        console.error("Erro ao traduzir texto com Gemini:", error);
        // Fallback para retornar o texto original em caso de erro
        return text;
    }
}


async function generateSummaryWithGemini(text: string): Promise<string> {
    if (!text.trim()) {
        return "";
    }
    try {
        const genAI = getAi();
        const response = await genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [{
                    text: `Você é um especialista em resumir textos exibidos em uma tela de TV. Resuma o seguinte texto, que foi traduzido de outro idioma, em uma única frase concisa e informativa para um espectador. Seja direto e claro. Responda em português do Brasil.\n\nTexto para resumir:\n"${text}"`
                }]
            },
        });
        return response.text.trim();
    } catch (error) {
        console.error("Error generating summary with Gemini:", error);
        // Fallback to simple truncation on error
        const prefix = "Resumo: ";
        return text.length > 150 ? prefix + text.slice(0, 150) + "..." : prefix + text;
    }
}


export const ocrAndTranslateImageLocal = async (
  canvasElement: HTMLCanvasElement,
  targetLanguageCode: string
): Promise<OcrAndSummaryResult | null> => {
  try {
    const worker = await getTesseractWorker();
    const { data } = await worker.recognize(canvasElement);
    
    if (!data.lines || data.lines.length === 0) {
      return null;
    }

    const originalLines = data.lines.map((line: any) => line.text.trim()).filter(Boolean);
    const joinedText = originalLines.join('\n');

    if (!joinedText) {
        return null;
    }
    
    const translatedText = await translateTextWithGemini(joinedText, targetLanguageCode);

    if (!translatedText) {
        return null; // Retorna nulo em caso de falha na tradução
    }

    const translatedLines = translatedText.split('\n');

    const imageWidth = canvasElement.width;
    const imageHeight = canvasElement.height;
    const results: OcrResult[] = [];
    let lineIndex = 0;

    for (const line of data.lines) {
        const originalText = line.text.trim();
        if (originalText && translatedLines[lineIndex] !== undefined) {
            const { x0, y0, x1, y1 } = line.bbox;
            results.push({
                id: Math.random(),
                text: originalText,
                translatedText: translatedLines[lineIndex],
                bbox: {
                    x: x0 / imageWidth,
                    y: y0 / imageHeight,
                    width: (x1 - x0) / imageWidth,
                    height: (y1 - y0) / imageHeight,
                }
            });
            lineIndex++;
        }
    }

    if (results.length === 0) return null;
    
    // Generate summary with Gemini
    const fullTranslatedText = translatedLines.join(' ');
    const summary = await generateSummaryWithGemini(fullTranslatedText);

    return {
        translatedBlocks: results,
        summary: summary,
    };

  } catch (error) {
    console.error('Erro com OCR e tradução local:', error);
    return null;
  }
};

export const terminateOcrWorker = async () => {
    if (tesseractWorker) {
        await tesseractWorker.terminate();
        tesseractWorker = null;
        console.log('Worker do Tesseract finalizado.');
    }
};