import { decodeShared } from '../internal/decoder/index.js';
import { InvalidOptionsError, TimeoutError } from '../internal/errors/index.js';
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
  if (options && typeof options !== 'object') {
    throw new InvalidOptionsError('BarcodeReader options must be an object');
  }
  if (options.timeoutMs !== undefined) {
    if (typeof options.timeoutMs !== 'number' || !Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
      throw new InvalidOptionsError('timeoutMs must be a positive number');
    }
  }

  const { signal, timeoutMs } = options;
  if (signal?.aborted) {
    throw new TimeoutError('Decoding was aborted');
  }

  const formats = options.formats ? [...options.formats] : [...DECODABLE_BARCODE_FORMATS];
  for (const fmt of formats) {
    validateBarcodeFormat(fmt);
  }

  const execute = async (): Promise<BarcodeReadResult | null> => {
    const rawImage = await parseImageInput(input);
    if (signal?.aborted) {
      throw new TimeoutError('Decoding was aborted');
    }

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
  };

  if (!timeoutMs && !signal) {
    return execute();
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  let abortHandler: (() => void) | undefined;

  const controlPromise = new Promise<never>((_, reject) => {
    if (timeoutMs) {
      timer = setTimeout(() => {
        reject(new TimeoutError(`Decoding timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }
    if (signal) {
      abortHandler = () => reject(new TimeoutError('Decoding was aborted'));
      signal.addEventListener('abort', abortHandler, { once: true });
    }
  });

  try {
    return await Promise.race([execute(), controlPromise]);
  } finally {
    if (timer) clearTimeout(timer);
    if (signal && abortHandler) {
      signal.removeEventListener('abort', abortHandler);
    }
  }
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
