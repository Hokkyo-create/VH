import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ocrAndTranslateImageLocal, terminateOcrWorker } from '../services/ocrService';
import type { OcrResult } from '../types';

interface OcrTranslateOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  enabled: boolean;
  targetLanguageCode: string;
  onNewSummary: (summary: string) => void;
}

const OcrTranslateOverlay: React.FC<OcrTranslateOverlayProps> = ({
  videoRef,
  enabled,
  targetLanguageCode,
  onNewSummary,
}) => {
  const [transBlocks, setTransBlocks] = useState<OcrResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const clearResultTimeoutRef = useRef<number | null>(null);

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

      // Always clear the previous timeout
      if (clearResultTimeoutRef.current) {
        clearTimeout(clearResultTimeoutRef.current);
      }

      if (results && results.translatedBlocks.length > 0) {
        setTransBlocks(results.translatedBlocks);
        onNewSummary(results.summary);
        
        // Set a new timeout to clear everything
        clearResultTimeoutRef.current = window.setTimeout(() => {
          setTransBlocks([]);
          onNewSummary('');
          clearResultTimeoutRef.current = null;
        }, 5000); // Keep results for 5 seconds
      } else {
        // If no results, clear immediately
        setTransBlocks([]);
        onNewSummary('');
      }
    } catch (error) {
      console.error('Falha na análise do quadro:', error);
      setTransBlocks([]);
      onNewSummary('');
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, videoRef, targetLanguageCode, onNewSummary]);

  useEffect(() => {
    if (enabled) {
      setTransBlocks([]);
      onNewSummary('');
      intervalRef.current = window.setInterval(analyzeFrameAndTranslate, 3500); // Scan every 3.5 seconds
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (clearResultTimeoutRef.current) clearTimeout(clearResultTimeoutRef.current);
      intervalRef.current = null;
      clearResultTimeoutRef.current = null;
      setTransBlocks([]);
      onNewSummary('');
      terminateOcrWorker(); // Terminate worker when OCR is disabled
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (clearResultTimeoutRef.current) clearTimeout(clearResultTimeoutRef.current);
      terminateOcrWorker(); // Ensure worker is terminated on component unmount
    };
  }, [enabled, analyzeFrameAndTranslate, onNewSummary]);

  if (!enabled || transBlocks.length === 0) {
    return null;
  }

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
      {transBlocks.map((block) => (
        <div
          key={block.id}
          className="absolute flex items-end justify-center p-1" // Align content to bottom-center
          style={{
            left: `${block.bbox.x * 100}%`,
            top: `${block.bbox.y * 100}%`,
            width: `${block.bbox.width * 100}%`,
            height: `${block.bbox.height * 100}%`,
          }}
          title={`Original: ${block.text}`}
        >
          <span
            className="text-center"
            style={{
              padding: '0.2em 0.4em',
              borderRadius: '4px',
              color: '#FFFFE0', // Light yellow, great for subtitles
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              fontSize: `clamp(10px, ${block.bbox.height * 100 * 0.7}vh, 28px)`,
              lineHeight: 1.2,
              // Create a solid outline effect for maximum readability
              textShadow: '1px 1px 2px black, -1px -1px 2px black, 1px -1px 2px black, -1px 1px 2px black, 0 0 5px black',
              boxDecorationBreak: 'clone',
              // @ts-ignore
              WebkitBoxDecorationBreak: 'clone',
            }}
          >
            {block.translatedText}
          </span>
        </div>
      ))}
    </div>
  );
};

export default OcrTranslateOverlay;