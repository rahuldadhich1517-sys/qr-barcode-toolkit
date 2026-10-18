import { InvalidOptionsError } from '../internal/errors/index.js';
import { ScannerController } from '../internal/scanner-lifecycle/controller.js';
import type { QrReadResult } from '../qr-read/types.js';
import type { QrScanner, QrScannerOptions } from './types.js';

export function createQrScanner(options: QrScannerOptions): QrScanner {
  if (!options || typeof options !== 'object') {
    throw new InvalidOptionsError('QrScanner options must be provided as an object');
  }
  if (typeof options.onScan !== 'function') {
    throw new InvalidOptionsError('QrScanner requires an onScan callback function');
  }

  const controller = new ScannerController({
    formats: ['QR_CODE'],
    video: options.video,
    camera: options.camera,
    scanIntervalMs: options.scanIntervalMs,
    duplicateDelayMs: options.duplicateDelayMs,
    onScan: sharedResult => {
      const qrResult: QrReadResult = {
        text: sharedResult.text,
        format: 'QR_CODE',
        rawBytes: sharedResult.rawBytes,
        numBits: sharedResult.numBits,
        resultPoints: sharedResult.resultPoints,
        metadata: sharedResult.metadata
      };
      options.onScan(qrResult);
    },
    onError: options.onError
  });

  return controller;
}
