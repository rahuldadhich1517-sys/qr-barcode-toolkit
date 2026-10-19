import { decodeShared } from '../decoder/index.js';
import {
  BrowserApiUnsupportedError,
  CameraUnavailableError,
  PermissionDeniedError,
  ScannerDestroyedError
} from '../errors/index.js';
import type { BaseScanner, ScannerControllerOptions, ScannerState } from './types.js';

export class ScannerController implements BaseScanner {
  private state: ScannerState = 'idle';
  private readonly options: ScannerControllerOptions;
  private videoElement: HTMLVideoElement | null = null;
  private isInternallyCreatedVideo = false;
  private mediaStream: MediaStream | null = null;
  private loopTimer: ReturnType<typeof setTimeout> | null = null;
  private animationFrameId: number | null = null;
  private isProcessingFrame = false;

  private lastDetectedText: string | null = null;
  private lastDetectedAt = 0;

  private canvas: HTMLCanvasElement | OffscreenCanvas | null = null;
  private canvasCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;

  constructor(options: ScannerControllerOptions) {
    this.options = {
      scanIntervalMs: 150,
      duplicateDelayMs: 1000,
      ...options
    };
  }

  public getState(): ScannerState {
    return this.state;
  }

  public isScanning(): boolean {
    return this.state === 'scanning';
  }

  public isPaused(): boolean {
    return this.state === 'paused';
  }

  public isDestroyed(): boolean {
    return this.state === 'destroyed';
  }

  public async start(): Promise<void> {
    if (this.state === 'destroyed') {
      throw new ScannerDestroyedError();
    }
    if (this.state === 'scanning' || this.state === 'starting') {
      return; // Already active or starting, prevent duplicate loops
    }

    this.state = 'starting';

    try {
      this.ensureBrowserEnvironment();
      await this.initializeMediaStream();
      await this.setupVideoElement();

      this.state = 'scanning';
      this.scheduleNextScan(0);
    } catch (err) {
      this.cleanupMediaStream();
      this.state = 'stopped';
      const mapped = this.mapMediaError(err);
      this.options.onError?.(mapped);
      throw mapped;
    }
  }

  public async stop(): Promise<void> {
    if (this.state === 'destroyed') {
      return;
    }
    this.cancelScheduledScan();
    this.cleanupMediaStream();
    this.state = 'stopped';
  }

  public pause(): void {
    if (this.state === 'destroyed') {
      throw new ScannerDestroyedError();
    }
    if (this.state === 'scanning') {
      this.state = 'paused';
      this.cancelScheduledScan();
    }
  }

  public resume(): void {
    if (this.state === 'destroyed') {
      throw new ScannerDestroyedError();
    }
    if (this.state === 'paused') {
      this.state = 'scanning';
      this.scheduleNextScan(0);
    }
  }

  public destroy(): void {
    if (this.state === 'destroyed') {
      return;
    }
    this.cancelScheduledScan();
    this.cleanupMediaStream();

    if (this.isInternallyCreatedVideo && this.videoElement) {
      if (this.videoElement.parentElement) {
        this.videoElement.parentElement.removeChild(this.videoElement);
      }
      this.videoElement = null;
    }

    this.canvas = null;
    this.canvasCtx = null;
    this.state = 'destroyed';
  }

  private ensureBrowserEnvironment(): void {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      throw new BrowserApiUnsupportedError(
        'Camera access requires a browser environment with navigator.mediaDevices.getUserMedia support'
      );
    }
  }

  private async initializeMediaStream(): Promise<void> {
    const videoConstraints: MediaTrackConstraints = {};

    if (this.options.camera?.deviceId) {
      videoConstraints.deviceId = { exact: this.options.camera.deviceId };
    } else if (this.options.camera?.facingMode) {
      videoConstraints.facingMode = { ideal: this.options.camera.facingMode };
    }

    const constraints: MediaStreamConstraints = {
      video: Object.keys(videoConstraints).length > 0 ? videoConstraints : true,
      audio: false
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.mediaStream = stream;

    // Monitor track disconnect
    for (const track of stream.getVideoTracks()) {
      track.onended = () => {
        if (this.state === 'scanning' || this.state === 'paused') {
          this.stop().catch(() => {});
          this.options.onError?.(new CameraUnavailableError('Camera media track ended or disconnected'));
        }
      };
    }
  }

  private async setupVideoElement(): Promise<void> {
    if (this.options.video) {
      this.videoElement = this.options.video;
      this.isInternallyCreatedVideo = false;
    } else {
      if (!this.videoElement && typeof document !== 'undefined') {
        this.videoElement = document.createElement('video');
        this.isInternallyCreatedVideo = true;
      }
    }

    if (!this.videoElement) {
      throw new BrowserApiUnsupportedError('Unable to create or obtain a video element');
    }

    this.videoElement.playsInline = true;
    this.videoElement.muted = true;
    this.videoElement.autoplay = true;
    this.videoElement.srcObject = this.mediaStream;

    await new Promise<void>((resolve, reject) => {
      if (!this.videoElement) return resolve();
      if (this.videoElement.readyState >= 2) {
        return resolve();
      }

      const onLoadedData = () => {
        cleanup();
        resolve();
      };
      const onError = (e: Event) => {
        cleanup();
        reject(new CameraUnavailableError('Failed to load video stream', e));
      };
      const cleanup = () => {
        this.videoElement?.removeEventListener('loadeddata', onLoadedData);
        this.videoElement?.removeEventListener('error', onError);
      };

      this.videoElement.addEventListener('loadeddata', onLoadedData);
      this.videoElement.addEventListener('error', onError);

      // Play video to start streaming
      this.videoElement.play().catch(() => {
        // Some browsers require loadeddata before play, resolve anyway
        resolve();
      });
    });
  }

  private scheduleNextScan(delayMs: number): void {
    if (this.state !== 'scanning') return;

    this.cancelScheduledScan();
    this.loopTimer = setTimeout(() => {
      this.loopTimer = null;
      if (typeof requestAnimationFrame === 'function') {
        this.animationFrameId = requestAnimationFrame(() => {
          this.animationFrameId = null;
          this.scanFrame().catch(err => {
            this.options.onError?.(err);
          });
        });
      } else {
        this.scanFrame().catch(err => {
          this.options.onError?.(err);
        });
      }
    }, delayMs);
  }

  private cancelScheduledScan(): void {
    if (this.loopTimer !== null) {
      clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }
    if (this.animationFrameId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private async scanFrame(): Promise<void> {
    if (this.state !== 'scanning' || this.isProcessingFrame) {
      return;
    }

    const video = this.videoElement;
    if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      // Stream frame not ready yet, retry after standard interval
      this.scheduleNextScan(this.options.scanIntervalMs ?? 150);
      return;
    }

    this.isProcessingFrame = true;

    try {
      const width = video.videoWidth;
      const height = video.videoHeight;

      if (!this.canvas) {
        if (typeof OffscreenCanvas !== 'undefined') {
          this.canvas = new OffscreenCanvas(width, height);
        } else if (typeof document !== 'undefined') {
          const c = document.createElement('canvas');
          c.width = width;
          c.height = height;
          this.canvas = c;
        }
      }

      if (this.canvas) {
        if (this.canvas.width !== width) this.canvas.width = width;
        if (this.canvas.height !== height) this.canvas.height = height;

        if (!this.canvasCtx) {
          this.canvasCtx = this.canvas.getContext('2d') as
            | CanvasRenderingContext2D
            | OffscreenCanvasRenderingContext2D
            | null;
        }

        if (this.canvasCtx) {
          this.canvasCtx.drawImage(video, 0, 0, width, height);
          const imageData = this.canvasCtx.getImageData(0, 0, width, height);

          const result = await decodeShared(
            {
              data: imageData.data,
              width,
              height
            },
            {
              formats: this.options.formats
            }
          );

          if (result && this.state === 'scanning') {
            const now = Date.now();
            const isDuplicate =
              this.lastDetectedText === result.text &&
              now - this.lastDetectedAt < (this.options.duplicateDelayMs ?? 1000);

            if (!isDuplicate) {
              this.lastDetectedText = result.text;
              this.lastDetectedAt = now;
              this.options.onScan(result);
            }
          }
        }
      }
    } catch (err) {
      // Decode errors on a single frame are ignored or forwarded
      if (err instanceof Error) {
        this.options.onError?.(err);
      }
    } finally {
      this.isProcessingFrame = false;
      if (this.state === 'scanning') {
        this.scheduleNextScan(this.options.scanIntervalMs ?? 150);
      }
    }
  }

  private cleanupMediaStream(): void {
    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        try {
          track.stop();
        } catch {
          // ignore track stop error
        }
      }
      this.mediaStream = null;
    }

    if (this.videoElement) {
      try {
        this.videoElement.srcObject = null;
        this.videoElement.pause();
      } catch {
        // ignore
      }
    }
  }

  private mapMediaError(err: unknown): Error {
    if (err instanceof BrowserApiUnsupportedError || err instanceof ScannerDestroyedError) {
      return err;
    }
    const errorName = (err as Record<string, unknown>)?.['name'];
    if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
      return new PermissionDeniedError('Camera permission was denied by the user or system', err);
    }
    if (
      errorName === 'NotFoundError' ||
      errorName === 'DevicesNotFoundError' ||
      errorName === 'NotReadableError' ||
      errorName === 'TrackStartError'
    ) {
      return new CameraUnavailableError('Camera device is unavailable or already in use', err);
    }
    return err instanceof Error ? err : new Error(String(err));
  }
}
