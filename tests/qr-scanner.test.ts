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

    // Test exact deviceId
    const scannerDevice = createQrScanner({
      video: mockVideo as unknown as HTMLVideoElement,
      camera: { deviceId: 'test-cam-123' },
      onScan: () => {}
    });
    await scannerDevice.start();
    expect(getUserMediaMock).toHaveBeenCalledWith({
      video: { deviceId: { exact: 'test-cam-123' } },
      audio: false
    });
    await scannerDevice.stop();
    scannerDevice.destroy();

    // Test facingMode ideal
    getUserMediaMock.mockClear();
    const scannerFacing = createQrScanner({
      video: mockVideo as unknown as HTMLVideoElement,
      camera: { facingMode: 'user' },
      onScan: () => {}
    });
    await scannerFacing.start();
    expect(getUserMediaMock).toHaveBeenCalledWith({
      video: { facingMode: { ideal: 'user' } },
      audio: false
    });
    await scannerFacing.stop();
    scannerFacing.destroy();
  });

  it('creates managed internal video element when video option is not provided and cleans up on destroy', async () => {
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

    const mockVideoEl = {
      readyState: 4,
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      parentElement: {
        removeChild: vi.fn()
      }
    };

    (globalThis as Record<string, unknown>)['document'] = {
      createElement: vi.fn().mockReturnValue(mockVideoEl)
    };

    const scanner = createQrScanner({
      onScan: () => {}
    });

    await scanner.start();
    expect(scanner.getState()).toBe('scanning');
    expect(globalThis.document.createElement).toHaveBeenCalledWith('video');

    // Stopping and restarting reuses existing element
    await scanner.stop();
    expect(scanner.getState()).toBe('stopped');
    await scanner.start();
    expect(scanner.getState()).toBe('scanning');

    scanner.destroy();
    expect(scanner.getState()).toBe('destroyed');
    expect(mockVideoEl.parentElement.removeChild).toHaveBeenCalledWith(mockVideoEl);
  });

  it('throws BrowserApiUnsupportedError if video is not provided and document is undefined', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        mediaDevices: {
          getUserMedia: vi.fn().mockResolvedValue({
            getTracks: vi.fn().mockReturnValue([]),
            getVideoTracks: vi.fn().mockReturnValue([])
          })
        }
      },
      configurable: true,
      writable: true
    });

    // @ts-expect-error ensure document is undefined
    delete globalThis.document;

    const scanner = createQrScanner({
      onScan: () => {}
    });

    await expect(scanner.start()).rejects.toThrow(BrowserApiUnsupportedError);
  });

  it('handles video element error during setup and triggers CameraUnavailableError', async () => {
    const mockStream = {
      getTracks: vi.fn().mockReturnValue([{ stop: vi.fn(), onended: null }]),
      getVideoTracks: vi.fn().mockReturnValue([{ stop: vi.fn(), onended: null }])
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
      readyState: 0,
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      addEventListener: vi.fn((event, cb) => {
        if (event === 'error') {
          setTimeout(() => cb(new Event('error')), 0);
        }
      }),
      removeEventListener: vi.fn()
    };

    const onError = vi.fn();
    const scanner = createQrScanner({
      video: mockVideo as unknown as HTMLVideoElement,
      onScan: () => {},
      onError
    });

    await expect(scanner.start()).rejects.toThrow(CameraUnavailableError);
    expect(onError).toHaveBeenCalledWith(expect.any(CameraUnavailableError));
    expect(scanner.getState()).toBe('stopped');
  });

  it('handles track onended event when scanning', async () => {
    let trackEndedCb: (() => void) | null = null;
    const mockTrack = {
      stop: vi.fn(),
      set onended(cb: () => void) {
        trackEndedCb = cb;
      },
      get onended() {
        return trackEndedCb;
      }
    };
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

    const onError = vi.fn();
    const scanner = createQrScanner({
      video: mockVideo as unknown as HTMLVideoElement,
      onScan: () => {},
      onError
    });

    await scanner.start();
    expect(scanner.getState()).toBe('scanning');

    // Simulate camera disconnect
    expect(trackEndedCb).not.toBeNull();
    trackEndedCb!();

    expect(onError).toHaveBeenCalledWith(expect.any(CameraUnavailableError));
    expect(scanner.getState()).toBe('stopped');
  });

  it('handles track onended event when paused', async () => {
    let trackEndedCb: (() => void) | null = null;
    const mockTrack = {
      stop: vi.fn(),
      set onended(cb: () => void) {
        trackEndedCb = cb;
      },
      get onended() {
        return trackEndedCb;
      }
    };
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

    const onError = vi.fn();
    const scanner = createQrScanner({
      video: mockVideo as unknown as HTMLVideoElement,
      onScan: () => {},
      onError
    });

    await scanner.start();
    scanner.pause();
    expect(scanner.getState()).toBe('paused');

    // Simulate camera disconnect while paused
    trackEndedCb!();

    expect(onError).toHaveBeenCalledWith(expect.any(CameraUnavailableError));
    expect(scanner.getState()).toBe('stopped');
  });

  it('supports duplicateDelayMs throttling and re-detection after window', async () => {
    const { generateQrCode } = await import('../src/index.js');
    const { PNG } = await import('pngjs');

    const qrPng = await generateQrCode('Duplicate Test Code', { output: 'png', width: 100 });
    const parsed = PNG.sync.read(Buffer.from(qrPng));

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
    const scanner = createQrScanner({
      video: mockVideo as unknown as HTMLVideoElement,
      scanIntervalMs: 15,
      duplicateDelayMs: 250, // Distinct duplicate delay window
      onScan
    });

    await scanner.start();

    // First scan tick
    await new Promise(resolve => setTimeout(resolve, 40));
    const initialCalls = onScan.mock.calls.length;
    expect(initialCalls).toBeGreaterThanOrEqual(1);

    // Wait a short time still well within the 250ms window: no new calls
    await new Promise(resolve => setTimeout(resolve, 40));
    expect(onScan.mock.calls.length).toBe(initialCalls);

    // Wait past the duplicateDelayMs window (250ms)
    await new Promise(resolve => setTimeout(resolve, 250));
    expect(onScan.mock.calls.length).toBeGreaterThan(initialCalls);

    await scanner.stop();
    scanner.destroy();
  });

  it('supports duplicateDelayMs: 0 to report every detection', async () => {
    const { generateQrCode } = await import('../src/index.js');
    const { PNG } = await import('pngjs');

    const qrPng = await generateQrCode('Zero Throttle Test', { output: 'png', width: 100 });
    const parsed = PNG.sync.read(Buffer.from(qrPng));

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
    const scanner = createQrScanner({
      video: mockVideo as unknown as HTMLVideoElement,
      scanIntervalMs: 10,
      duplicateDelayMs: 0, // No throttling
      onScan
    });

    await scanner.start();
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(onScan.mock.calls.length).toBeGreaterThanOrEqual(2);

    await scanner.stop();
    scanner.destroy();
  });

  it('verifies stop() and destroy() idempotency', async () => {
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

    const scanner = createQrScanner({
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
    expect(scanner.isDestroyed()).toBe(true);
  });

  it('maps various getUserMedia error names correctly', async () => {
    const errorTypes = [
      { name: 'DevicesNotFoundError', expected: CameraUnavailableError },
      { name: 'NotReadableError', expected: CameraUnavailableError },
      { name: 'TrackStartError', expected: CameraUnavailableError }
    ];

    for (const { name, expected } of errorTypes) {
      const customErr = new Error(`Error: ${name}`);
      customErr.name = name;

      Object.defineProperty(globalThis, 'navigator', {
        value: {
          mediaDevices: {
            getUserMedia: vi.fn().mockRejectedValue(customErr)
          }
        },
        configurable: true,
        writable: true
      });

      const scanner = createQrScanner({ onScan: () => {} });
      await expect(scanner.start()).rejects.toThrow(expected);
    }
  });
});


