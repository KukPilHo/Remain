import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

export interface AiModelsConfig {
  llm: {
    model: string;
    temperature: number;
    max_tokens: number;
  };
  stt: {
    model: string;
    language: string;
  };
  tts: {
    model: string;
    voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
  };
}

let cachedConfig: AiModelsConfig | null = null;

export function getAiConfig(): AiModelsConfig {
  if (cachedConfig) return cachedConfig;
  
  try {
    const filePath = path.join(process.cwd(), 'ai-models.yaml');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    cachedConfig = yaml.load(fileContents) as AiModelsConfig;
    return cachedConfig;
  } catch (error) {
    console.error('Failed to load ai-models.yaml, falling back to defaults:', error);
    // Fallback defaults if the file is missing or fails to parse
    return {
      llm: { model: 'gpt-5.4-mini', temperature: 0.7, max_tokens: 200 },
      stt: { model: 'whisper-1', language: 'ko' },
      tts: { model: 'tts-1', voice: 'alloy' }
    };
  }
}
