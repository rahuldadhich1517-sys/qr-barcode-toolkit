import { decodeShared } from '../internal/decoder/index.js';
import { InvalidOptionsError } from '../internal/errors/index.js';
import { parseImageInput, type SupportedImageInput } from '../internal/image-input/index.js';
import { ScannerController } from '../internal/scanner-lifecycle/controller.js';
import {
  type BarcodeFormat,
  DECODABLE_BARCODE_FORMATS,
  validateBarcodeFormat
} from '../internal/validation/index.js';
import type {
  BarcodeReaderOptions,
  BarcodeReadResult,
  BarcodeScanner,
  BarcodeScannerOptions
} from './types.js';

export async function readBarcode(
  input: SupportedImageInput,
  options: BarcodeReaderOptions = {}
): Promise<BarcodeReadResult | null> {
  const formats = options.formats ? [...options.formats] : [...DECODABLE_BARCODE_FORMATS];
  for (const fmt of formats) {
    validateBarcodeFormat(fmt);
  }

  const rawImage = await parseImageInput(input);

  const result = await decodeShared(rawImage, {
    formats,
    tryHarder: options.tryHarder,
    signal: options.signal,
    timeoutMs: options.timeoutMs
  });

  if (!result) {
    return null;
  }

  return {
    text: result.text,
    format: result.format,
    rawBytes: result.rawBytes,
    numBits: result.numBits,
    resultPoints: result.resultPoints,
    metadata: result.metadata
  };
}

export function createBarcodeScanner(options: BarcodeScannerOptions): BarcodeScanner {
  if (!options || typeof options !== 'object') {
    throw new InvalidOptionsError('BarcodeScanner options must be provided as an object');
  }
  if (typeof options.onScan !== 'function') {
    throw new InvalidOptionsError('BarcodeScanner requires an onScan callback function');
  }

  const formats: BarcodeFormat[] = options.formats ? [...options.formats] : [...DECODABLE_BARCODE_FORMATS];
  for (const fmt of formats) {
    validateBarcodeFormat(fmt);
  }

  const controller = new ScannerController({
    formats,
    video: options.video,
    camera: options.camera,
    scanIntervalMs: options.scanIntervalMs,
    duplicateDelayMs: options.duplicateDelayMs,
    onScan: sharedResult => {
      const barcodeResult: BarcodeReadResult = {
        text: sharedResult.text,
        format: sharedResult.format,
        rawBytes: sharedResult.rawBytes,
        numBits: sharedResult.numBits,
        resultPoints: sharedResult.resultPoints,
        metadata: sharedResult.metadata
      };
      options.onScan(barcodeResult);
    },
    onError: options.onError
  });

  return controller;
}
