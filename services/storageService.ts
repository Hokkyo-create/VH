import { EpgData } from '../types';

export interface AppSettings {
  m3uUrl?: string;
  volume?: number;
  language?: string;
  isDubbingActive?: boolean;
  isSubtitlesActive?: boolean;
  isSceneAnalysisActive?: boolean;
  isOcrActive?: boolean;
  dubbingVoice?: string;
  apiKey?: string;
  isSpeedCorrectionActive?: boolean;
}

const SETTINGS_KEY = 'ai_iptv_player_settings_v1';

export const loadSettings = (): AppSettings => {
  try {
    const settingsJson = localStorage.getItem(SETTINGS_KEY);
    return settingsJson ? JSON.parse(settingsJson) : {};
  } catch (e) {
    console.error("Failed to load settings from localStorage", e);
    return {};
  }
};

export const saveSettings = (newSettings: Partial<AppSettings>): void => {
  try {
    const currentSettings = loadSettings();
    const updatedSettings = { ...currentSettings, ...newSettings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updatedSettings));
  } catch (e) {
    console.error("Failed to save settings to localStorage", e);
  }
};