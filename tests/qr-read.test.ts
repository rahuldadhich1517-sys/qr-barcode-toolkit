import { describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import {
  generateQrCode,
  InvalidInputError,
  readQrCode,
  TimeoutError
} from '../src/index.js';

describe('QR Reader (readQrCode)', () => {
  it('decodes a valid QR code still image and recovers exact text', async () => {
    const originalText = 'https://example.com/qr/toolkit';
    const pngBytes = await generateQrCode(originalText, { output: 'png', width: 250, margin: 4 });

    const result = await readQrCode(pngBytes);
    expect(result).not.toBeNull();
    expect(result?.text).toBe(originalText);
    expect(result?.format).toBe('QR_CODE');
    expect(result?.rawBytes).toBeDefined();
    expect(result?.resultPoints).toBeDefined();
    expect(result?.resultPoints?.length).toBeGreaterThanOrEqual(3);
  });

  it('decodes Unicode, emojis, and multiline payloads correctly', async () => {
    const payload = 'QR Toolkit 🚀\nLine 2: 12345\n日本語テキスト';
    const pngBytes = await generateQrCode(payload, { output: 'png', width: 300, margin: 4 });

    const result = await readQrCode(pngBytes);
    expect(result).not.toBeNull();
    expect(result?.text).toBe(payload);
  });

  it('returns null when an image has no QR code present', async () => {
    // Generate a blank 100x100 white PNG
    const png = new PNG({ width: 100, height: 100 });
    for (let i = 0; i < png.data.length; i += 4) {
      png.data[i] = 255; // R
      png.data[i + 1] = 255; // G
      png.data[i + 2] = 255; // B
      png.data[i + 3] = 255; // A
    }
    const blankPngBuffer = PNG.sync.write(png);

    const result = await readQrCode(blankPngBuffer);
    expect(result).toBeNull();
  });

  it('decodes from a RawImageData input object', async () => {
    const originalText = 'Raw ImageData Test';
    const pngBytes = await generateQrCode(originalText, { output: 'png', width: 200, margin: 4 });
    const parsed = PNG.sync.read(Buffer.from(pngBytes));

    const rawInput = {
      data: parsed.data,
      width: parsed.width,
      height: parsed.height
    };

    const result = await readQrCode(rawInput);
    expect(result).not.toBeNull();
    expect(result?.text).toBe(originalText);
  });

  it('rejects null or undefined input with InvalidInputError', async () => {
    // @ts-expect-error testing runtime validation
    await expect(readQrCode(null)).rejects.toThrow(InvalidInputError);
    // @ts-expect-error testing runtime validation
    await expect(readQrCode(undefined)).rejects.toThrow(InvalidInputError);
  });

  it('rejects empty byte buffer with InvalidInputError', async () => {
    await expect(readQrCode(new Uint8Array(0))).rejects.toThrow(InvalidInputError);
  });

  it('rejects corrupted image bytes with InvalidInputError', async () => {
    const corruptedBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    await expect(readQrCode(corruptedBytes)).rejects.toThrow(InvalidInputError);
  });

  it('rejects invalid or unsupported input objects with InvalidInputError', async () => {
    await expect(readQrCode({ invalid: 'object' })).rejects.toThrow(InvalidInputError);
    await expect(readQrCode(12345)).rejects.toThrow(InvalidInputError);
  });

  it('respects cancellation via AbortSignal', async () => {
    const pngBytes = await generateQrCode('Abort Test', { output: 'png' });
    const controller = new AbortController();
    controller.abort();

    await expect(readQrCode(pngBytes, { signal: controller.signal })).rejects.toThrow(TimeoutError);
  });
});
