import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PNG } from 'pngjs';
import {
  BrowserApiUnsupportedError,
  CameraUnavailableError,
  createBarcodeScanner,
  generateBarcode,
  InvalidInputError,
  InvalidOptionsError,
  PermissionDeniedError,
  readBarcode,
  ScannerDestroyedError
} from '../src/index.js';

describe('Barcode Scanner & Reader (readBarcode, createBarcodeScanner)', () => {
  let originalNavigatorDesc: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalNavigatorDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  });

  afterEach(() => {
    if (originalNavigatorDesc) {
      Object.defineProperty(globalThis, 'navigator', originalNavigatorDesc);
    }
    // @ts-expect-error cleanup document
    delete globalThis.document;
    vi.restoreAllMocks();
  });

  describe('readBarcode (still image)', () => {
    it('decodes a generated Code 128 barcode still image', async () => {
      const code = 'HELLO-BARCODE';
      const pngBytes = await generateBarcode(code, {
        format: 'CODE_128',
        output: 'png',
        scale: 3,
        margin: 15
      });

      const result = await readBarcode(pngBytes, {
        formats: ['CODE_128']
      });

      expect(result).not.toBeNull();
      expect(result?.text).toBe(code);
      expect(result?.format).toBe('CODE_128');
      expect(result?.rawBytes).toBeDefined();
    });

    it('returns null when image contains no barcode', async () => {
      const png = new PNG({ width: 100, height: 100 });
      for (let i = 0; i < png.data.length; i += 4) {
        png.data[i] = 255;
        png.data[i + 1] = 255;
        png.data[i + 2] = 255;
        png.data[i + 3] = 255;
      }
      const blankBytes = PNG.sync.write(png);

      const result = await readBarcode(blankBytes);
      expect(result).toBeNull();
    });

    it('rejects corrupted image bytes with InvalidInputError', async () => {
      await expect(readBarcode(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow(InvalidInputError);
    });

    it('rejects empty input buffer with InvalidInputError', async () => {
      await expect(readBarcode(new Uint8Array(0))).rejects.toThrow(InvalidInputError);
    });
  });

  describe('createBarcodeScanner (continuous live scanning)', () => {
    it('validates that onScan callback is provided', () => {
      // @ts-expect-error testing invalid options
      expect(() => createBarcodeScanner({})).toThrow(InvalidOptionsError);
      // @ts-expect-error testing invalid options
      expect(() => createBarcodeScanner(null)).toThrow(InvalidOptionsError);
    });

    it('throws BrowserApiUnsupportedError when mediaDevices is missing', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {},
        configurable: true,
        writable: true
      });

      const scanner = createBarcodeScanner({
        onScan: () => {}
      });

      await expect(scanner.start()).rejects.toThrow(BrowserApiUnsupportedError);
    });

    it('handles permission denied error mapping correctly', async () => {
      const notAllowedError = new Error('Permission denied');
      notAllowedError.name = 'NotAllowedError';

      Object.defineProperty(globalThis, 'navigator', {
        value: {
          mediaDevices: {
            getUserMedia: vi.fn().mockRejectedValue(notAllowedError)
          }
        },
        configurable: true,
        writable: true
      });

      const onError = vi.fn();
      const scanner = createBarcodeScanner({
        onScan: () => {},
        onError
      });

      await expect(scanner.start()).rejects.toThrow(PermissionDeniedError);
      expect(onError).toHaveBeenCalledWith(expect.any(PermissionDeniedError));
    });

    it('handles camera unavailable error mapping correctly', async () => {
      const notFoundError = new Error('Device not found');
      notFoundError.name = 'NotFoundError';

      Object.defineProperty(globalThis, 'navigator', {
        value: {
          mediaDevices: {
            getUserMedia: vi.fn().mockRejectedValue(notFoundError)
          }
        },
        configurable: true,
        writable: true
      });

      const onError = vi.fn();
      const scanner = createBarcodeScanner({
        onScan: () => {},
        onError
      });

      await expect(scanner.start()).rejects.toThrow(CameraUnavailableError);
      expect(onError).toHaveBeenCalledWith(expect.any(CameraUnavailableError));
    });

    it('manages lifecycle correctly: start, pause, resume, stop, destroy', async () => {
      const mockTrack = {
        stop: vi.fn(),
        onended: null as unknown
      };

      const mockStream = {
        getTracks: vi.fn().mockReturnValue([mockTrack]),
        getVideoTracks: vi.fn().mockReturnValue([mockTrack])
      };

      const mockVideo = {
        playsInline: false,
        muted: false,
        autoplay: false,
        srcObject: null as unknown,
        readyState: 2,
        videoWidth: 320,
        videoHeight: 240,
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn(),
        addEventListener: vi.fn((event, cb) => {
          if (event === 'loadeddata') {
            setTimeout(cb, 0);
          }
        }),
        removeEventListener: vi.fn()
      };

      Object.defineProperty(globalThis, 'navigator', {
        value: {
          mediaDevices: {
            getUserMedia: vi.fn().mockResolvedValue(mockStream)
          }
        },
        configurable: true,
        writable: true
      });

      // @ts-expect-error mock video element
      const scanner = createBarcodeScanner({
        video: mockVideo as unknown as HTMLVideoElement,
        formats: ['CODE_128', 'EAN_13'],
        onScan: () => {}
      });

      expect(scanner.getState()).toBe('idle');
      await scanner.start();
      expect(scanner.getState()).toBe('scanning');

      scanner.pause();
      expect(scanner.getState()).toBe('paused');

      scanner.resume();
      expect(scanner.getState()).toBe('scanning');

      await scanner.stop();
      expect(scanner.getState()).toBe('stopped');
      expect(mockTrack.stop).toHaveBeenCalled();

      scanner.destroy();
      expect(scanner.getState()).toBe('destroyed');

      await expect(scanner.start()).rejects.toThrow(ScannerDestroyedError);
    });

    it('processes video frame and invokes onScan with BarcodeReadResult', async () => {
      const { generateBarcode } = await import('../src/index.js');
      const { PNG } = await import('pngjs');

      const barcodePng = await generateBarcode('FRAME128', {
        format: 'CODE_128',
        output: 'png',
        scale: 3,
        margin: 10
      });
      const parsed = PNG.sync.read(Buffer.from(barcodePng));

      const mockTrack = { stop: vi.fn(), onended: null };
      const mockStream = {
        getTracks: vi.fn().mockReturnValue([mockTrack]),
        getVideoTracks: vi.fn().mockReturnValue([mockTrack])
      };

      const mockVideo = {
        playsInline: false,
        muted: false,
        autoplay: false,
        srcObject: null as unknown,
        readyState: 4,
        videoWidth: parsed.width,
        videoHeight: parsed.height,
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn(),
        addEventListener: vi.fn((event, cb) => {
          if (event === 'loadeddata') setTimeout(cb, 0);
        }),
        removeEventListener: vi.fn()
      };

      Object.defineProperty(globalThis, 'navigator', {
        value: {
          mediaDevices: {
            getUserMedia: vi.fn().mockResolvedValue(mockStream)
          }
        },
        configurable: true,
        writable: true
      });

      (globalThis as Record<string, unknown>)['OffscreenCanvas'] = class FakeCanvas {
        width = parsed.width;
        height = parsed.height;
        getContext() {
          return {
            drawImage: vi.fn(),
            getImageData: () => ({
              data: parsed.data,
              width: parsed.width,
              height: parsed.height
            })
          };
        }
      };

      const onScan = vi.fn();
      const scanner = createBarcodeScanner({
        formats: ['CODE_128'],
        video: mockVideo as unknown as HTMLVideoElement,
        scanIntervalMs: 10,
        onScan
      });

      await scanner.start();

      // Wait for frame scan loop tick
      await new Promise(resolve => setTimeout(resolve, 80));

      expect(onScan).toHaveBeenCalled();
      const result = onScan.mock.calls[0]?.[0];
      expect(result.text).toBe('FRAME128');
      expect(result.format).toBe('CODE_128');

      await scanner.stop();
      scanner.destroy();
    });
  });
});

