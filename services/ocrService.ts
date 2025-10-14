// This declares the Tesseract object from the CDN script to TypeScript
declare const Tesseract: any;

export interface OcrResult {
  id: number;
  text: string;
  translatedText: string;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

let tesseractWorker: any | null = null;

async function getTesseractWorker(): Promise<any> {
    if (!tesseractWorker) {
        tesseractWorker = await Tesseract.createWorker('jpn');
    }
    return tesseractWorker;
}

export const ocrAndTranslateImageLocal = async (
  canvasElement: HTMLCanvasElement,
  targetLanguageCode: string
): Promise<OcrResult[]> => {
  try {
    const worker = await getTesseractWorker();
    const { data } = await worker.recognize(canvasElement);
    
    if (!data.lines || data.lines.length === 0) {
      return [];
    }

    const originalLines = data.lines.map((line: any) => line.text.trim()).filter(Boolean);
    const joinedText = originalLines.join('\n');

    if (!joinedText) {
        return [];
    }
    
    const translateResponse = await fetch("https://libretranslate.de/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            q: joinedText,
            source: "ja",
            target: targetLanguageCode,
            format: "text"
        })
    });

    if (!translateResponse.ok) {
        console.error(`LibreTranslate API error: ${translateResponse.statusText}`);
        return []; // Return empty on translation failure
    }

    const translationResult = await translateResponse.json();
    const translatedLines = (translationResult.translatedText as string).split('\n');

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

    return results;

  } catch (error) {
    console.error('Error with local OCR and translation:', error);
    return [];
  }
};

export const terminateOcrWorker = async () => {
    if (tesseractWorker) {
        await tesseractWorker.terminate();
        tesseractWorker = null;
        console.log('Tesseract worker terminated.');
    }
};