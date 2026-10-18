import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BrowserApiUnsupportedError,
  CameraUnavailableError,
  createQrScanner,
  InvalidOptionsError,
  PermissionDeniedError,
  ScannerDestroyedError
} from '../src/index.js';

describe('QR Scanner (createQrScanner)', () => {
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

  it('validates that onScan callback is provided', () => {
    // @ts-expect-error testing runtime validation
    expect(() => createQrScanner({})).toThrow(InvalidOptionsError);
    // @ts-expect-error testing runtime validation
    expect(() => createQrScanner(null)).toThrow(InvalidOptionsError);
  });

  it('throws BrowserApiUnsupportedError when mediaDevices is missing', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      configurable: true,
      writable: true
    });

    const scanner = createQrScanner({
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
    const scanner = createQrScanner({
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
    const scanner = createQrScanner({
      onScan: () => {},
      onError
    });

    await expect(scanner.start()).rejects.toThrow(CameraUnavailableError);
    expect(onError).toHaveBeenCalledWith(expect.any(CameraUnavailableError));
  });

  it('completes full lifecycle: start, pause, resume, stop, destroy and releases tracks', async () => {
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
    const scanner = createQrScanner({
      video: mockVideo as unknown as HTMLVideoElement,
      onScan: () => {}
    });

    expect(scanner.getState()).toBe('idle');
    expect(scanner.isScanning()).toBe(false);

    await scanner.start();
    expect(scanner.getState()).toBe('scanning');
    expect(scanner.isScanning()).toBe(true);
    expect(mockVideo.srcObject).toBe(mockStream);

    // Concurrent start calls should be safe no-op
    await scanner.start();
    expect(scanner.getState()).toBe('scanning');

    // Pause
    scanner.pause();
    expect(scanner.getState()).toBe('paused');
    expect(scanner.isPaused()).toBe(true);

    // Resume
    scanner.resume();
    expect(scanner.getState()).toBe('scanning');

    // Stop
    await scanner.stop();
    expect(scanner.getState()).toBe('stopped');
    expect(mockTrack.stop).toHaveBeenCalled();
    expect(mockVideo.srcObject).toBeNull();

    // Destroy
    scanner.destroy();
    expect(scanner.getState()).toBe('destroyed');
    expect(scanner.isDestroyed()).toBe(true);

    // Operations after destroy must throw
    await expect(scanner.start()).rejects.toThrow(ScannerDestroyedError);
    expect(() => scanner.pause()).toThrow(ScannerDestroyedError);
    expect(() => scanner.resume()).toThrow(ScannerDestroyedError);
  });

  it('successfully processes video frame and invokes onScan with QrReadResult', async () => {
    const { generateQrCode } = await import('../src/index.js');
    const { PNG } = await import('pngjs');

    const qrPng = await generateQrCode('Scanner Callback Test', { output: 'png', width: 100, margin: 4 });
    const parsed = PNG.sync.read(Buffer.from(qrPng));

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

    // Mock OffscreenCanvas to return the real QR image data
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
    const scanner = createQrScanner({
      video: mockVideo as unknown as HTMLVideoElement,
      scanIntervalMs: 10,
      onScan
    });

    await scanner.start();

    // Wait for frame scan loop tick
    await new Promise(resolve => setTimeout(resolve, 80));

    expect(onScan).toHaveBeenCalled();
    const result = onScan.mock.calls[0]?.[0];
    expect(result.text).toBe('Scanner Callback Test');
    expect(result.format).toBe('QR_CODE');

    await scanner.stop();
    scanner.destroy();
  });
});

