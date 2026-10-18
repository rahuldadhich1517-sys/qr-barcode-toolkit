import type { ScannerState } from '../internal/scanner-lifecycle/types.js';
import type { BarcodeFormat } from '../internal/validation/index.js';
import type { SupportedImageInput } from '../internal/image-input/index.js';

export type { ScannerState, BarcodeFormat, SupportedImageInput };

export interface BarcodeReadResult {
  text: string;
  format: BarcodeFormat;
  rawBytes?: Uint8Array;
  numBits?: number;
  resultPoints?: Array<{ x: number; y: number }>;
  metadata?: Record<string, unknown>;
}

export interface BarcodeReaderOptions {
  /**
   * Symbologies to decode. If omitted, all verified supported formats will be scanned.
   */
  formats?: BarcodeFormat[];

  /**
   * Timeout in milliseconds.
   */
  timeoutMs?: number;

  /**
   * Optional AbortSignal to cancel decoding.
   */
  signal?: AbortSignal;

  /**
   * Instructs the decoder to spend extra time attempting to detect difficult or low-contrast barcodes.
   */
  tryHarder?: boolean;
}

export interface BarcodeScannerCameraOptions {
  facingMode?: 'user' | 'environment';
  deviceId?: string;
}

export interface BarcodeScannerOptions {
  /**
   * Symbologies to decode. If omitted, all verified supported formats will be scanned.
   */
  formats?: BarcodeFormat[];

  /**
   * Optional existing video element to attach camera stream to.
   */
  video?: HTMLVideoElement;

  /**
   * Camera preference options.
   */
  camera?: BarcodeScannerCameraOptions;

  /**
   * Interval in milliseconds between frame decodes. Default: 150ms.
   */
  scanIntervalMs?: number;

  /**
   * Time window in milliseconds during which identical detections are ignored. Default: 1000ms.
   */
  duplicateDelayMs?: number;

  /**
   * Callback invoked whenever a barcode is successfully decoded.
   */
  onScan: (result: BarcodeReadResult) => void;

  /**
   * Optional callback invoked when a camera error or decode error occurs.
   */
  onError?: (error: Error) => void;
}

export interface BarcodeScanner {
  start(): Promise<void>;
  stop(): Promise<void>;
  pause(): void;
  resume(): void;
  destroy(): void;
  getState(): ScannerState;
  isScanning(): boolean;
  isPaused(): boolean;
  isDestroyed(): boolean;
}
