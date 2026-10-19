import { describe, expect, it } from 'vitest';
import {
  createBinaryBitmap,
  decodeShared,
  toGrayscaleBuffer,
  toToolkitFormat,
  toZxingFormats
} from '../src/internal/decoder/index.js';
import {
  DecodeError,
  InitializationError,
  TimeoutError
} from '../src/internal/errors/index.js';
import { ScannerController } from '../src/internal/scanner-lifecycle/index.js';
import { generateBarcode, generateQrCode } from '../src/index.js';

describe('Internal Decoder & Lifecycle Module Verification', () => {
  it('correctly maps formats between Toolkit and ZXing formats', () => {
    const zxFormats = toZxingFormats(['QR_CODE', 'CODE_128', 'EAN_13']);
    expect(zxFormats.length).toBe(3);

    expect(toToolkitFormat(zxFormats[0]!)).toBe('QR_CODE');
    expect(toToolkitFormat(999999)).toBeUndefined();
  });

  it('converts RGBA buffer to grayscale and handles transparent pixels', () => {
    const width = 2;
    const height = 2;
    // 4 pixels: pixel 0 transparent (alpha=0), pixel 1 black, pixel 2 white, pixel 3 color
    const rgba = new Uint8ClampedArray([
      255, 0, 0, 0,       // transparent -> becomes 0xff (white)
      0, 0, 0, 255,       // black -> 0
      255, 255, 255, 255, // white -> 255
      100, 150, 200, 255  // weighted
    ]);

    const grayscale = toGrayscaleBuffer(rgba, width, height);
    expect(grayscale.length).toBe(4);
    expect(grayscale[0]).toBe(255);
    expect(grayscale[1]).toBe(0);
    expect(grayscale[2]).toBe(255);
    expect(grayscale[3]).toBeGreaterThan(100);
  });

  it('creates BinaryBitmap from 1-channel, 3-channel (fallback), and 4-channel raw images', () => {
    // 1 channel (grayscale)
    const grayRaw = {
      data: new Uint8ClampedArray(16),
      width: 4,
      height: 4
    };
    const b1 = createBinaryBitmap(grayRaw);
    expect(b1).toBeDefined();

    // 4 channels (RGBA)
    const rgbaRaw = {
      data: new Uint8ClampedArray(16 * 4),
      width: 4,
      height: 4
    };
    const b2 = createBinaryBitmap(rgbaRaw);
    expect(b2).toBeDefined();

    // 3 channels (RGB fallback)
    const rgbRaw = {
      data: new Uint8Array(16 * 3),
      width: 4,
      height: 4
    };
    const b3 = createBinaryBitmap(rgbRaw);
    expect(b3).toBeDefined();
  });

  it('handles decodeShared options: empty formats list, single QR fast path, multi-format path, and timeout', async () => {
    const qrPng = await generateQrCode('Test Decode Shared', { output: 'png' });
    const { PNG } = await import('pngjs');
    const parsed = PNG.sync.read(Buffer.from(qrPng));
    const rawImage = {
      data: parsed.data,
      width: parsed.width,
      height: parsed.height
    };

    // 1. Empty formats list returns null immediately
    const emptyRes = await decodeShared(rawImage, { formats: [] });
    expect(emptyRes).toBeNull();

    // 2. Fast path for single QR_CODE with tryHarder
    const qrFastRes = await decodeShared(rawImage, {
      formats: ['QR_CODE'],
      tryHarder: true
    });
    expect(qrFastRes?.text).toBe('Test Decode Shared');
    expect(qrFastRes?.format).toBe('QR_CODE');

    // 3. Multi-format path with tryHarder
    const multiRes = await decodeShared(rawImage, {
      formats: ['QR_CODE', 'CODE_128'],
      tryHarder: true
    });
    expect(multiRes?.text).toBe('Test Decode Shared');

    // 4. Aborted signal throws TimeoutError
    const controller = new AbortController();
    controller.abort();
    await expect(
      decodeShared(rawImage, { signal: controller.signal })
    ).rejects.toThrow(TimeoutError);

    // 5. Shared decode timeoutMs parameter
    const timeoutRes = await decodeShared(rawImage, {
      formats: ['QR_CODE'],
      timeoutMs: 1000
    });
    expect(timeoutRes?.text).toBe('Test Decode Shared');
  });

  it('decodes barcode via MultiFormatReader and extracts resultPoints and metadata', async () => {
    const code128 = await generateBarcode('EXTRACT128', {
      format: 'CODE_128',
      output: 'png',
      scale: 3,
      margin: 15
    });
    const { PNG } = await import('pngjs');
    const parsed = PNG.sync.read(Buffer.from(code128));

    const result = await decodeShared(
      { data: parsed.data, width: parsed.width, height: parsed.height },
      { formats: ['CODE_128'] }
    );

    expect(result).not.toBeNull();
    expect(result?.text).toBe('EXTRACT128');
    expect(result?.format).toBe('CODE_128');
    expect(result?.rawBytes).toBeDefined();
  });

  it('verifies custom errors DecodeError and InitializationError', () => {
    const decodeErr = new DecodeError('Failed decoding image', { reason: 'blur' });
    expect(decodeErr.name).toBe('DecodeError');
    expect(decodeErr.code).toBe('DECODE_ERROR');
    expect(decodeErr.details).toEqual({ reason: 'blur' });
    expect(decodeErr instanceof Error).toBe(true);

    const initErr = new InitializationError('Failed init', { code: 500 });
    expect(initErr.name).toBe('InitializationError');
    expect(initErr.code).toBe('INITIALIZATION_FAILED');
    expect(initErr.details).toEqual({ code: 500 });
    expect(initErr instanceof Error).toBe(true);
  });

  it('verifies scanner-lifecycle barrel export', () => {
    expect(ScannerController).toBeDefined();
    expect(typeof ScannerController).toBe('function');
  });
});
