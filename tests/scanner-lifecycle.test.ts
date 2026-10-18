import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CameraUnavailableError } from '../src/index.js';
import { ScannerController } from '../src/internal/scanner-lifecycle/controller.js';

describe('ScannerController lifecycle and resource management', () => {
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

  it('cleans up media stream and reports error when camera track ends unexpectedly', async () => {
    let trackEndedCallback: (() => void) | null = null;
    const mockTrack = {
      stop: vi.fn(),
      set onended(cb: () => void) {
        trackEndedCallback = cb;
      },
      get onended() {
        return trackEndedCallback;
      }
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

    const onError = vi.fn();
    const controller = new ScannerController({
      formats: ['QR_CODE'],
      video: mockVideo as unknown as HTMLVideoElement,
      onScan: () => {},
      onError
    });

    await controller.start();
    expect(controller.getState()).toBe('scanning');

    // Trigger unexpected track end (camera disconnect)
    if (trackEndedCallback) {
      (trackEndedCallback as () => void)();
    }

    // Wait for event loop tick
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(controller.getState()).toBe('stopped');
    expect(onError).toHaveBeenCalledWith(expect.any(CameraUnavailableError));
    expect(mockTrack.stop).toHaveBeenCalled();
  });

  it('handles multiple calls to stop() safely without error', async () => {
    const mockTrack = { stop: vi.fn() };
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

    const controller = new ScannerController({
      formats: ['QR_CODE'],
      video: {
        readyState: 2,
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      } as unknown as HTMLVideoElement,
      onScan: () => {}
    });

    await controller.start();
    await controller.stop();
    await controller.stop();
    expect(controller.getState()).toBe('stopped');
  });

  it('creates and detaches internal video element when video is omitted', async () => {
    const mockTrack = { stop: vi.fn() };
    const mockStream = {
      getTracks: vi.fn().mockReturnValue([mockTrack]),
      getVideoTracks: vi.fn().mockReturnValue([mockTrack])
    };

    const createdVideo = {
      playsInline: false,
      muted: false,
      autoplay: false,
      srcObject: null as unknown,
      readyState: 2,
      parentElement: {
        removeChild: vi.fn()
      },
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

    // @ts-expect-error mock document
    globalThis.document = {
      createElement: vi.fn().mockReturnValue(createdVideo)
    };

    const controller = new ScannerController({
      formats: ['QR_CODE'],
      onScan: () => {}
    });

    await controller.start();
    expect(createdVideo.srcObject).toBe(mockStream);

    controller.destroy();
    expect(createdVideo.parentElement.removeChild).toHaveBeenCalledWith(createdVideo);
    expect(controller.getState()).toBe('destroyed');
  });
});
