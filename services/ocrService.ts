import { OcrResult } from '../types';
import * as aiService from './geminiService';

declare const Tesseract: any;

export interface OcrAndSummaryResult {
  translatedBlocks: OcrResult[];
  summary: string;
}

let tesseractWorker: any | null = null;

async function getTesseractWorker(): Promise<any> {
    if (!tesseractWorker) {
        tesseractWorker = await Tesseract.createWorker('jpn');
    }
    return tesseractWorker;
}

const translateTextWithAI = (apiKey: string, text: string, targetLanguageCode: string) => {
    const languageMap: { [key: string]: string } = {
        'pt': 'Português (Brasil)', 'en': 'Inglês', 'es': 'Espanhol',
        'fr': 'Francês', 'de': 'Alemão', 'it': 'Italiano',
        'ja': 'Japonês', 'ko': 'Coreano', 'ru': 'Russo', 'zh': 'Chinês',
    };
    const targetLanguageName = languageMap[targetLanguageCode as keyof typeof languageMap] || targetLanguageCode;
    return aiService.translateGenericText(apiKey, text, targetLanguageName, "Japonês");
}


export const ocrAndTranslateImageLocal = async (
  apiKey: string,
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
    
    const translatedText = await translateTextWithAI(apiKey, joinedText, targetLanguageCode);

    if (!translatedText || translatedText.startsWith('[Erro')) {
        return null;
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
    
    const fullTranslatedText = translatedLines.join(' ');
    // This is a simple summary for now. A call to a summarization endpoint could be added here.
    const summary = fullTranslatedText.length > 100 ? fullTranslatedText.slice(0, 100) + "..." : fullTranslatedText;

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
