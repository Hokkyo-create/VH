export interface Channel {
  name: string;
  logo: string | null;
  url: string;
  group: string;
  tvgId: string | null;
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

export interface Programme {
  start: Date;
  stop: Date;
  title: string;
  desc?: string;
  channel: string; // tvg-id
}

export interface EpgData {
  [channelId: string]: Programme[];
}

export interface DubbingSegment {
  start: number;
  end: number;
  buffer: AudioBuffer;
}
