export interface Channel {
  name: string;
  logo: string | null;
  url: string;
  group: string;
}

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