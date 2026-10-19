import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PNG } from 'pngjs';
import {
  generateQrCode,
  InvalidInputError,
  InvalidOptionsError,
  readQrCode,
  TimeoutError
} from '../src/index.js';

describe('QR Reader (readQrCode)', () => {
  let originalWindow: unknown;
  let originalHTMLCanvasElement: unknown;
  let originalOffscreenCanvas: unknown;

  beforeEach(() => {
    originalWindow = globalThis.window;
    originalHTMLCanvasElement = (globalThis as Record<string, unknown>)['HTMLCanvasElement'];
    originalOffscreenCanvas = (globalThis as Record<string, unknown>)['OffscreenCanvas'];
  });

  afterEach(() => {
    // @ts-expect-error restore globals
    globalThis.window = originalWindow;
    (globalThis as Record<string, unknown>)['HTMLCanvasElement'] = originalHTMLCanvasElement;
    (globalThis as Record<string, unknown>)['OffscreenCanvas'] = originalOffscreenCanvas;
    vi.restoreAllMocks();
  });

  describe('Phase 4.A: Real Image Decoding & Payload Recovery', () => {
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
      for (const pt of result!.resultPoints!) {
        expect(typeof pt.x).toBe('number');
        expect(typeof pt.y).toBe('number');
      }
    });

    it('decodes Unicode, emojis, multiline payloads, and JSON', async () => {
      const payload = JSON.stringify({
        msg: 'QR Toolkit 🚀',
        lang: '日本語',
        lines: ['line 1', 'line 2']
      });
      const pngBytes = await generateQrCode(payload, { output: 'png', width: 300, margin: 4 });

      const result = await readQrCode(pngBytes);
      expect(result).not.toBeNull();
      expect(result?.text).toBe(payload);
    });

    it('supports tryHarder decoder option', async () => {
      const pngBytes = await generateQrCode('Try Harder Test', { output: 'png', width: 200 });
      const result = await readQrCode(pngBytes, { tryHarder: true });
      expect(result?.text).toBe('Try Harder Test');
    });
  });

  describe('Phase 4.B: Supported Input Formats', () => {
    it('decodes from a RawImageData 4-channel RGBA input object', async () => {
      const originalText = 'Raw ImageData RGBA Test';
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

    it('decodes from a RawImageData 1-channel grayscale input', async () => {
      const originalText = 'Grayscale 1-channel Test';
      const pngBytes = await generateQrCode(originalText, { output: 'png', width: 200, margin: 4 });
      const parsed = PNG.sync.read(Buffer.from(pngBytes));

      // Build 1-byte per pixel grayscale
      const gray = new Uint8ClampedArray(parsed.width * parsed.height);
      for (let i = 0, j = 0; j < gray.length; i += 4, j++) {
        gray[j] = parsed.data[i]!;
      }

      const result = await readQrCode({
        data: gray,
        width: parsed.width,
        height: parsed.height
      });
      expect(result?.text).toBe(originalText);
    });

    it('decodes from an ArrayBuffer input containing PNG bytes', async () => {
      const originalText = 'ArrayBuffer Input Test';
      const pngBytes = await generateQrCode(originalText, { output: 'png', width: 200, margin: 4 });
      const arrayBuffer = pngBytes.buffer.slice(pngBytes.byteOffset, pngBytes.byteOffset + pngBytes.byteLength);

      const result = await readQrCode(arrayBuffer);
      expect(result?.text).toBe(originalText);
    });

    it('decodes from a Blob input containing PNG bytes', async () => {
      const originalText = 'Blob Input Test';
      const pngBytes = await generateQrCode(originalText, { output: 'png', width: 200, margin: 4 });
      const blob = new Blob([pngBytes], { type: 'image/png' });

      const result = await readQrCode(blob);
      expect(result?.text).toBe(originalText);
    });

    it('decodes from an HTMLCanvasElement mock', async () => {
      const originalText = 'Canvas Mock Test';
      const pngBytes = await generateQrCode(originalText, { output: 'png', width: 200, margin: 4 });
      const parsed = PNG.sync.read(Buffer.from(pngBytes));

      class FakeCanvas {
        width = parsed.width;
        height = parsed.height;
        getContext(type: string) {
          if (type === '2d') {
            return {
              getImageData: () => ({
                data: parsed.data,
                width: parsed.width,
                height: parsed.height
              })
            };
          }
          return null;
        }
      }

      (globalThis as Record<string, unknown>)['HTMLCanvasElement'] = FakeCanvas;
      // @ts-expect-error mock window
      globalThis.window = {};

      const fakeCanvas = new FakeCanvas();
      const result = await readQrCode(fakeCanvas as unknown as HTMLCanvasElement);
      expect(result?.text).toBe(originalText);
    });

    it('decodes from an OffscreenCanvas mock', async () => {
      const originalText = 'OffscreenCanvas Mock Test';
      const pngBytes = await generateQrCode(originalText, { output: 'png', width: 200, margin: 4 });
      const parsed = PNG.sync.read(Buffer.from(pngBytes));

      class FakeOffscreen {
        width = parsed.width;
        height = parsed.height;
        getContext(type: string) {
          if (type === '2d') {
            return {
              getImageData: () => ({
                data: parsed.data,
                width: parsed.width,
                height: parsed.height
              })
            };
          }
          return null;
        }
      }

      (globalThis as Record<string, unknown>)['OffscreenCanvas'] = FakeOffscreen;
      // @ts-expect-error mock window
      globalThis.window = {};

      const fakeOffscreen = new FakeOffscreen();
      const result = await readQrCode(fakeOffscreen as unknown as OffscreenCanvas);
      expect(result?.text).toBe(originalText);
    });
  });

  describe('Phase 4.C: Negative Image Scenarios', () => {
    it('returns null when an image has no QR code present (blank white PNG)', async () => {
      const png = new PNG({ width: 100, height: 100 });
      for (let i = 0; i < png.data.length; i += 4) {
        png.data[i] = 255;
        png.data[i + 1] = 255;
        png.data[i + 2] = 255;
        png.data[i + 3] = 255;
      }
      const blankPngBuffer = PNG.sync.write(png);

      const result = await readQrCode(blankPngBuffer);
      expect(result).toBeNull();
    });

    it('returns null when an image is entirely dark / black', async () => {
      const png = new PNG({ width: 100, height: 100 });
      for (let i = 0; i < png.data.length; i += 4) {
        png.data[i] = 0;
        png.data[i + 1] = 0;
        png.data[i + 2] = 0;
        png.data[i + 3] = 255;
      }
      const darkPngBuffer = PNG.sync.write(png);

      const result = await readQrCode(darkPngBuffer);
      expect(result).toBeNull();
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

    it('rejects truncated PNG bytes with InvalidInputError', async () => {
      const truncatedPng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
      await expect(readQrCode(truncatedPng)).rejects.toThrow(InvalidInputError);
    });

    it('rejects corrupted image bytes with InvalidInputError', async () => {
      const corruptedBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      await expect(readQrCode(corruptedBytes)).rejects.toThrow(InvalidInputError);
    });

    it('rejects invalid or unsupported input objects with InvalidInputError', async () => {
      await expect(readQrCode({ invalid: 'object' })).rejects.toThrow(InvalidInputError);
      await expect(readQrCode(12345)).rejects.toThrow(InvalidInputError);
    });
  });

  describe('Phase 4.D: Timeout and AbortSignal', () => {
    it('respects cancellation via an already aborted AbortSignal', async () => {
      const pngBytes = await generateQrCode('Abort Test', { output: 'png' });
      const controller = new AbortController();
      controller.abort();

      await expect(readQrCode(pngBytes, { signal: controller.signal })).rejects.toThrow(TimeoutError);
    });

    it('rejects invalid or non-positive timeout values with InvalidOptionsError', async () => {
      const pngBytes = await generateQrCode('Test', { output: 'png' });
      await expect(readQrCode(pngBytes, { timeoutMs: -10 })).rejects.toThrow(InvalidOptionsError);
      await expect(readQrCode(pngBytes, { timeoutMs: 0 })).rejects.toThrow(InvalidOptionsError);
      // @ts-expect-error invalid type
      await expect(readQrCode(pngBytes, { timeoutMs: '100' })).rejects.toThrow(InvalidOptionsError);
    });

    it('rejects invalid options argument if not an object', async () => {
      const pngBytes = await generateQrCode('Test', { output: 'png' });
      // @ts-expect-error invalid options type
      await expect(readQrCode(pngBytes, 'invalid')).rejects.toThrow(InvalidOptionsError);
    });

    it('throws TimeoutError when timeoutMs expires before decoding completes', async () => {
      // Simulate an async input that takes longer than timeoutMs
      const slowBlob = new Blob([new Uint8Array([1, 2, 3])]);
      vi.spyOn(slowBlob, 'arrayBuffer').mockImplementation(
        () => new Promise<ArrayBuffer>((resolve) => setTimeout(() => resolve(new ArrayBuffer(10)), 150))
      );

      await expect(
        readQrCode(slowBlob, { timeoutMs: 25 })
      ).rejects.toThrow(TimeoutError);
    });

    it('throws TimeoutError when signal aborts mid-flight', async () => {
      const controller = new AbortController();
      const slowBlob = new Blob([new Uint8Array([1, 2, 3])]);
      vi.spyOn(slowBlob, 'arrayBuffer').mockImplementation(
        () =>
          new Promise<ArrayBuffer>((resolve) => {
            setTimeout(() => {
              controller.abort();
              resolve(new ArrayBuffer(10));
            }, 20);
          })
      );

      await expect(
        readQrCode(slowBlob, { signal: controller.signal })
      ).rejects.toThrow(TimeoutError);
    });
  });
});
