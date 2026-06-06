/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface WinGoRound {
  period: string;
  resultColor: 'Red' | 'Green' | 'Violet' | 'Red & Violet' | 'Green & Violet';
  resultNumber: number;
  resultSize: 'Big' | 'Small';
  time: string;
}

export interface PredictionItem {
  period: string;
  predictedColor: 'Red' | 'Green' | 'Violet' | 'Red-Violet' | 'Green-Violet';
  predictedSize: 'Big' | 'Small';
  predictedNumbers: number[];
  confidence: number; // 0 - 100 percentage
}

export interface SystemStats {
  accuracy: number;
  decryptionSpeed: number; // in ms
  serverLatency: number; // in ms
  processedRounds: number;
  signalStrength: number; // 0-100
}

export interface VoiceMessage {
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  isVoice: boolean;
}
