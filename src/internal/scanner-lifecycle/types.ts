import type { BarcodeFormat } from '../validation/index.js';
import type { SharedDecodeResult } from '../decoder/index.js';

export type ScannerState = 'idle' | 'starting' | 'scanning' | 'paused' | 'stopped' | 'destroyed';

export interface CameraFacingPreference {
  facingMode?: 'user' | 'environment';
  deviceId?: string;
}

export interface ScannerControllerOptions {
  formats: BarcodeFormat[];
  video?: HTMLVideoElement;
  camera?: CameraFacingPreference;
  scanIntervalMs?: number;
  duplicateDelayMs?: number;
  onScan: (result: SharedDecodeResult) => void;
  onError?: (error: Error) => void;
}

export interface BaseScanner {
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
