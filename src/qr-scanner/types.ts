import type { ScannerState } from '../internal/scanner-lifecycle/types.js';
import type { QrReadResult } from '../qr-read/types.js';

export type { ScannerState };

export interface QrScannerCameraOptions {
  facingMode?: 'user' | 'environment';
  deviceId?: string;
}

export interface QrScannerOptions {
  /**
   * Optional existing video element to attach camera stream to.
   * If omitted, an internal video element will be managed.
   */
  video?: HTMLVideoElement;

  /**
   * Camera preference options.
   */
  camera?: QrScannerCameraOptions;

  /**
   * Interval in milliseconds between frame decodes. Default: 150ms.
   */
  scanIntervalMs?: number;

  /**
   * Time window in milliseconds during which identical QR detections are ignored.
   * Set to 0 to receive every detection. Default: 1000ms.
   */
  duplicateDelayMs?: number;

  /**
   * Callback invoked whenever a QR code is successfully decoded.
   */
  onScan: (result: QrReadResult) => void;

  /**
   * Optional callback invoked when a camera error or decode error occurs.
   */
  onError?: (error: Error) => void;
}

export interface QrScanner {
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
