export function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export function resample(inputData: Float32Array, fromSampleRate: number, toSampleRate: number): Float32Array {
  if (fromSampleRate === toSampleRate) {
    return inputData;
  }
  
  const ratio = fromSampleRate / toSampleRate;
  const outputLength = Math.floor(inputData.length / ratio);
  const result = new Float32Array(outputLength);
  
  for (let i = 0; i < outputLength; i++) {
    const fromIndex = i * ratio;
    const fromIndexFloor = Math.floor(fromIndex);
    const fromIndexCeil = Math.min(fromIndexFloor + 1, inputData.length - 1);
    const weight = fromIndex - fromIndexFloor;
    
    // Linear interpolation
    result[i] = inputData[fromIndexFloor] * (1 - weight) + inputData[fromIndexCeil] * weight;
  }
  
  return result;
}
