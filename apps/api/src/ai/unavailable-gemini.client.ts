import { AppError } from '../common/errors/app-error.js';

import type { GeminiClient, GenerateStructuredResult } from './gemini-client.js';

/** Provisional hasta HOG-650: cualquier uso de IA responde `503 AI_UNAVAILABLE`. */
export class UnavailableGeminiClient implements GeminiClient {
  generateStructured<T>(): Promise<GenerateStructuredResult<T>> {
    return Promise.reject(new AppError('AI_UNAVAILABLE'));
  }
}
