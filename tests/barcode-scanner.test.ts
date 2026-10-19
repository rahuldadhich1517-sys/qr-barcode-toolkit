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
  ScannerDestroyedError,
  TimeoutError,
  UnsupportedFormatError
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

    it('decodes various 1D and 2D barcode formats accurately', async () => {
      // EAN-13
      const ean13Png = await generateBarcode('9780201379624', {
        format: 'EAN_13',
        output: 'png',
        scale: 3,
        margin: 15
      });
      const ean13Res = await readBarcode(ean13Png, { formats: ['EAN_13'] });
      expect(ean13Res).not.toBeNull();
      expect(ean13Res?.text).toBe('9780201379624');
      expect(ean13Res?.format).toBe('EAN_13');

      // EAN-8
      const ean8Png = await generateBarcode('90311017', {
        format: 'EAN_8',
        output: 'png',
        scale: 3,
        margin: 15
      });
      const ean8Res = await readBarcode(ean8Png, { formats: ['EAN_8'] });
      expect(ean8Res).not.toBeNull();
      expect(ean8Res?.text).toBe('90311017');
      expect(ean8Res?.format).toBe('EAN_8');

      // UPC-A
      const upcaPng = await generateBarcode('012345678905', {
        format: 'UPC_A',
        output: 'png',
        scale: 3,
        margin: 15
      });
      const upcaRes = await readBarcode(upcaPng, { formats: ['UPC_A'] });
      expect(upcaRes).not.toBeNull();
      expect(upcaRes?.text).toBe('012345678905');
      expect(upcaRes?.format).toBe('UPC_A');

      // Code 39
      const code39Png = await generateBarcode('CODE39TEST', {
        format: 'CODE_39',
        output: 'png',
        scale: 3,
        margin: 15
      });
      const code39Res = await readBarcode(code39Png, { formats: ['CODE_39'] });
      expect(code39Res).not.toBeNull();
      expect(code39Res?.text).toBe('CODE39TEST');
      expect(code39Res?.format).toBe('CODE_39');

      // QR Code
      const qrPng = await generateBarcode('https://toolkit.dev', {
        format: 'QR_CODE',
        output: 'png',
        scale: 3,
        margin: 15
      });
      const qrRes = await readBarcode(qrPng, { formats: ['QR_CODE'] });
      expect(qrRes).not.toBeNull();
      expect(qrRes?.text).toBe('https://toolkit.dev');
      expect(qrRes?.format).toBe('QR_CODE');
    });

    it('enforces format filtering correctly', async () => {
      const code128Png = await generateBarcode('FILTER128', {
        format: 'CODE_128',
        output: 'png',
        scale: 3,
        margin: 15
      });

      // Filter includes CODE_128 -> decodes
      const matched = await readBarcode(code128Png, { formats: ['CODE_128'] });
      expect(matched?.text).toBe('FILTER128');

      // Filter excludes CODE_128 (only EAN_13) -> returns null
      const excluded = await readBarcode(code128Png, { formats: ['EAN_13'] });
      expect(excluded).toBeNull();

      // Empty format list -> returns null immediately
      const emptyFormats = await readBarcode(code128Png, { formats: [] });
      expect(emptyFormats).toBeNull();

      // Invalid format in array throws UnsupportedFormatError
      await expect(
        // @ts-expect-error invalid format test
        readBarcode(code128Png, { formats: ['NOT_A_FORMAT'] })
      ).rejects.toThrow(UnsupportedFormatError);
    });

    it('documents and handles UPC-E decoding limitation gracefully without crashing', async () => {
      const upcePng = await generateBarcode('01234565', {
        format: 'UPC_E',
        output: 'png',
        scale: 3,
        margin: 15
      });

      // Due to upstream ZXing UPCEReader rowOffset bug, decode returns null safely
      const result = await readBarcode(upcePng, { formats: ['UPC_E'] });
      expect(result).toBeNull();
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

    it('validates timeoutMs and signal options in readBarcode', async () => {
      const pngBytes = await generateBarcode('CODE128', { format: 'CODE_128', output: 'png' });

      // Non-object options
      // @ts-expect-error non-object options
      await expect(readBarcode(pngBytes, 123)).rejects.toThrow(InvalidOptionsError);

      // Non-positive timeout
      await expect(readBarcode(pngBytes, { timeoutMs: 0 })).rejects.toThrow(InvalidOptionsError);
      await expect(readBarcode(pngBytes, { timeoutMs: -10 })).rejects.toThrow(InvalidOptionsError);
      // @ts-expect-error invalid timeout type
      await expect(readBarcode(pngBytes, { timeoutMs: '100' })).rejects.toThrow(InvalidOptionsError);

      // Already aborted signal
      const controller = new AbortController();
      controller.abort();
      await expect(readBarcode(pngBytes, { signal: controller.signal })).rejects.toThrow(TimeoutError);

      // Timeout expiration on slow async input
      const slowBlob = new Blob([new Uint8Array([1, 2, 3])]);
      vi.spyOn(slowBlob, 'arrayBuffer').mockImplementation(
        () => new Promise<ArrayBuffer>((resolve) => setTimeout(() => resolve(new ArrayBuffer(10)), 150))
      );
      await expect(readBarcode(slowBlob, { timeoutMs: 25 })).rejects.toThrow(TimeoutError);

      // Mid-flight abort on slow async input
      const abortCtrl = new AbortController();
      const abortBlob = new Blob([new Uint8Array([1, 2, 3])]);
      vi.spyOn(abortBlob, 'arrayBuffer').mockImplementation(
        () =>
          new Promise<ArrayBuffer>((resolve) => {
            setTimeout(() => {
              abortCtrl.abort();
              resolve(new ArrayBuffer(10));
            }, 20);
          })
      );
      await expect(readBarcode(abortBlob, { signal: abortCtrl.signal })).rejects.toThrow(TimeoutError);
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

    it('rejects invalid barcode format in scanner options with UnsupportedFormatError', () => {
      expect(() =>
        createBarcodeScanner({
          // @ts-expect-error invalid format test
          formats: ['INVALID_FORMAT'],
          onScan: () => {}
        })
      ).toThrow(UnsupportedFormatError);
    });

    it('applies camera deviceId and facingMode constraints properly', async () => {
      const getUserMediaMock = vi.fn().mockResolvedValue({
        getTracks: vi.fn().mockReturnValue([]),
        getVideoTracks: vi.fn().mockReturnValue([])
      });

      Object.defineProperty(globalThis, 'navigator', {
        value: {
          mediaDevices: {
            getUserMedia: getUserMediaMock
          }
        },
        configurable: true,
        writable: true
      });

      const mockVideo = {
        readyState: 4,
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn()
      };

      const scanner = createBarcodeScanner({
        video: mockVideo as unknown as HTMLVideoElement,
        camera: { deviceId: 'barcode-cam-456' },
        onScan: () => {}
      });
      await scanner.start();
      expect(getUserMediaMock).toHaveBeenCalledWith({
        video: { deviceId: { exact: 'barcode-cam-456' } },
        audio: false
      });
      await scanner.stop();
      scanner.destroy();
    });

    it('supports duplicateDelayMs throttling for barcode scanner', async () => {
      const { generateBarcode } = await import('../src/index.js');
      const { PNG } = await import('pngjs');

      const barcodePng = await generateBarcode('DUP128', {
        format: 'CODE_128',
        output: 'png',
        scale: 2,
        margin: 5
      });
      const parsed = PNG.sync.read(Buffer.from(barcodePng));

      const mockStream = {
        getTracks: vi.fn().mockReturnValue([{ stop: vi.fn(), onended: null }]),
        getVideoTracks: vi.fn().mockReturnValue([{ stop: vi.fn(), onended: null }])
      };

      const mockVideo = {
        readyState: 4,
        videoWidth: parsed.width,
        videoHeight: parsed.height,
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn()
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
        video: mockVideo as unknown as HTMLVideoElement,
        scanIntervalMs: 15,
        duplicateDelayMs: 250,
        onScan
      });

      await scanner.start();

      await new Promise(resolve => setTimeout(resolve, 40));
      const initialCalls = onScan.mock.calls.length;
      expect(initialCalls).toBeGreaterThanOrEqual(1);

      await new Promise(resolve => setTimeout(resolve, 40));
      expect(onScan.mock.calls.length).toBe(initialCalls);

      await new Promise(resolve => setTimeout(resolve, 250));
      expect(onScan.mock.calls.length).toBeGreaterThan(initialCalls);

      await scanner.stop();
      scanner.destroy();
    });

    it('verifies stop and destroy idempotency', async () => {
      const mockTrack = { stop: vi.fn(), onended: null };
      const mockStream = {
        getTracks: vi.fn().mockReturnValue([mockTrack]),
        getVideoTracks: vi.fn().mockReturnValue([mockTrack])
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

      const mockVideo = {
        readyState: 4,
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn()
      };

      const scanner = createBarcodeScanner({
        video: mockVideo as unknown as HTMLVideoElement,
        onScan: () => {}
      });

      await scanner.start();
      await scanner.stop();
      await scanner.stop(); // Safe second call
      expect(scanner.getState()).toBe('stopped');

      scanner.destroy();
      scanner.destroy(); // Safe second call
      expect(scanner.getState()).toBe('destroyed');
    });
  });
});


