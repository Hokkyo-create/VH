import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ocrAndTranslateImageLocal, terminateOcrWorker } from '../services/ocrService';
import type { OcrResult } from '../services/ocrService';

interface OcrTranslateOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  enabled: boolean;
  targetLanguageCode: string;
}

const OcrTranslateOverlay: React.FC<OcrTranslateOverlayProps> = ({
  videoRef,
  enabled,
  targetLanguageCode,
}) => {
  const [transBlocks, setTransBlocks] = useState<OcrResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const clearBlocksTimeoutRef = useRef<number | null>(null);

  const analyzeFrameAndTranslate = useCallback(async () => {
    if (isProcessing || !videoRef.current) return;
    setIsProcessing(true);
    
    try {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.paused) {
          setIsProcessing(false);
          return;
      }
      
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) {
          setIsProcessing(false);
          return;
      }

      if (!canvasRef.current) {
          canvasRef.current = document.createElement('canvas');
      }
      const canvas = canvasRef.current;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
          setIsProcessing(false);
          return;
      }
      ctx.drawImage(video, 0, 0, w, h);
      
      const results = await ocrAndTranslateImageLocal(canvas, targetLanguageCode);

      if (results && results.length > 0) {
        setTransBlocks(results);
        if (clearBlocksTimeoutRef.current) {
          clearTimeout(clearBlocksTimeoutRef.current);
        }
        clearBlocksTimeoutRef.current = window.setTimeout(() => {
          setTransBlocks([]);
          clearBlocksTimeoutRef.current = null;
        }, 4000);
      }
    } catch (error) {
      console.error('Falha na análise do quadro:', error);
      setTransBlocks([]);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, videoRef, targetLanguageCode]);

  useEffect(() => {
    if (enabled) {
      setTransBlocks([]);
      intervalRef.current = window.setInterval(analyzeFrameAndTranslate, 3000); // Increased interval for local processing
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (clearBlocksTimeoutRef.current) clearTimeout(clearBlocksTimeoutRef.current);
      intervalRef.current = null;
      clearBlocksTimeoutRef.current = null;
      setTransBlocks([]);
      terminateOcrWorker(); // Terminate worker when OCR is disabled
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (clearBlocksTimeoutRef.current) clearTimeout(clearBlocksTimeoutRef.current);
      terminateOcrWorker(); // Ensure worker is terminated on component unmount
    };
  }, [enabled, analyzeFrameAndTranslate]);

  if (!enabled || transBlocks.length === 0) {
    return null;
  }

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
      {transBlocks.map((block) => (
        <div
          key={block.id}
          className="absolute bg-black/70 text-white p-1 rounded-sm text-center flex items-center justify-center"
          style={{
            left: `${block.bbox.x * 100}%`,
            top: `${block.bbox.y * 100}%`,
            width: `${block.bbox.width * 100}%`,
            height: `${block.bbox.height * 100}%`,
            fontSize: `clamp(8px, ${block.bbox.height * 100 * 0.6}vh, 24px)`,
            lineHeight: 1.1,
            textShadow: '1px 1px 2px rgba(0,0,0,0.9)',
          }}
          title={`Original: ${block.text}`}
        >
          <span>{block.translatedText}</span>
        </div>
      ))}
    </div>
  );
};

export default OcrTranslateOverlay;