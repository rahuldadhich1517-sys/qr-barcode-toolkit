import type { SupportedImageInput } from '../internal/image-input/index.js';

export interface QrReadResult {
  text: string;
  format: 'QR_CODE';
  rawBytes?: Uint8Array;
  numBits?: number;
  resultPoints?: Array<{ x: number; y: number }>;
  metadata?: Record<string, unknown>;
}

export interface QrReaderOptions {
  /**
   * Timeout in milliseconds for decoding.
   * If decoding exceeds this time, a TimeoutError will be thrown.
   */
  timeoutMs?: number;

  /**
   * Optional AbortSignal to cancel decoding.
   */
  signal?: AbortSignal;

  /**
   * Instructs the decoder to spend more time attempting to decode difficult or low-contrast images.
   */
  tryHarder?: boolean;
}

export type { SupportedImageInput };
