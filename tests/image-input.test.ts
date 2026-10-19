import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PNG } from 'pngjs';
import { InvalidInputError, parseImageInput } from '../src/index.js';

describe('Image Input Parser (src/internal/image-input/index.ts)', () => {
  let originalWindow: unknown;
  let originalDocument: unknown;
  let originalHTMLCanvasElement: unknown;
  let originalOffscreenCanvas: unknown;

  beforeEach(() => {
    originalWindow = globalThis.window;
    originalDocument = globalThis.document;
    originalHTMLCanvasElement = (globalThis as Record<string, unknown>)['HTMLCanvasElement'];
    originalOffscreenCanvas = (globalThis as Record<string, unknown>)['OffscreenCanvas'];
  });

  afterEach(() => {
    // @ts-expect-error restore
    globalThis.window = originalWindow;
    // @ts-expect-error restore
    globalThis.document = originalDocument;
    (globalThis as Record<string, unknown>)['HTMLCanvasElement'] = originalHTMLCanvasElement;
    (globalThis as Record<string, unknown>)['OffscreenCanvas'] = originalOffscreenCanvas;
    vi.restoreAllMocks();
  });

  it('parses an ArrayBuffer input containing valid PNG bytes', async () => {
    const png = new PNG({ width: 2, height: 2 });
    for (let i = 0; i < png.data.length; i += 4) {
      png.data[i] = 120;
      png.data[i + 1] = 130;
      png.data[i + 2] = 140;
      png.data[i + 3] = 255;
    }
    const pngBuffer = PNG.sync.write(png);

    const result = await parseImageInput(pngBuffer.buffer.slice(pngBuffer.byteOffset, pngBuffer.byteOffset + pngBuffer.byteLength));
    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
    expect(result.data.length).toBe(16);
  });

  it('parses a Blob input containing valid PNG bytes', async () => {
    const png = new PNG({ width: 2, height: 2 });
    for (let i = 0; i < png.data.length; i += 4) {
      png.data[i] = 200;
      png.data[i + 1] = 210;
      png.data[i + 2] = 220;
      png.data[i + 3] = 255;
    }
    const pngBuffer = PNG.sync.write(png);

    const blob = new Blob([pngBuffer], { type: 'image/png' });
    const result = await parseImageInput(blob);
    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
  });

  it('parses an HTMLCanvasElement mock', async () => {
    class FakeHTMLCanvasElement {
      width = 10;
      height = 10;
      getContext(type: string) {
        if (type === '2d') {
          return {
            getImageData: () => ({
              data: new Uint8ClampedArray(400),
              width: 10,
              height: 10
            })
          };
        }
        return null;
      }
    }

    (globalThis as Record<string, unknown>)['HTMLCanvasElement'] = FakeHTMLCanvasElement;
    // @ts-expect-error mock window
    globalThis.window = {};

    const fakeCanvas = new FakeHTMLCanvasElement();
    const result = await parseImageInput(fakeCanvas);
    expect(result.width).toBe(10);
    expect(result.height).toBe(10);
    expect(result.data.length).toBe(400);
  });

  it('parses an OffscreenCanvas mock', async () => {
    class FakeOffscreenCanvas {
      width = 8;
      height = 8;
      getContext(type: string) {
        if (type === '2d') {
          return {
            getImageData: () => ({
              data: new Uint8ClampedArray(256),
              width: 8,
              height: 8
            })
          };
        }
        return null;
      }
    }

    (globalThis as Record<string, unknown>)['OffscreenCanvas'] = FakeOffscreenCanvas;
    // @ts-expect-error mock window
    globalThis.window = {};

    const fakeOffscreen = new FakeOffscreenCanvas();
    const result = await parseImageInput(fakeOffscreen);
    expect(result.width).toBe(8);
    expect(result.height).toBe(8);
    expect(result.data.length).toBe(256);
  });

  it('parses an HTMLImageElement mock', async () => {
    class FakeHTMLImageElement {
      naturalWidth = 16;
      naturalHeight = 16;
      width = 16;
      height = 16;
    }

    class FakeOffscreenCanvas {
      width: number;
      height: number;
      constructor(w: number, h: number) {
        this.width = w;
        this.height = h;
      }
      getContext() {
        return {
          drawImage: vi.fn(),
          getImageData: (sx: number, sy: number, sw: number, sh: number) => ({
            data: new Uint8ClampedArray(sw * sh * 4),
            width: sw,
            height: sh
          })
        };
      }
    }

    (globalThis as Record<string, unknown>)['HTMLImageElement'] = FakeHTMLImageElement;
    (globalThis as Record<string, unknown>)['OffscreenCanvas'] = FakeOffscreenCanvas;
    // @ts-expect-error mock window
    globalThis.window = {};

    const fakeImg = new FakeHTMLImageElement();
    const result = await parseImageInput(fakeImg);
    expect(result.width).toBe(16);
    expect(result.height).toBe(16);
    expect(result.data.length).toBe(16 * 16 * 4);
  });

  it('parses an HTMLVideoElement mock', async () => {
    class FakeHTMLVideoElement {
      videoWidth = 24;
      videoHeight = 20;
      width = 24;
      height = 20;
    }

    class FakeOffscreenCanvas {
      width: number;
      height: number;
      constructor(w: number, h: number) {
        this.width = w;
        this.height = h;
      }
      getContext() {
        return {
          drawImage: vi.fn(),
          getImageData: (sx: number, sy: number, sw: number, sh: number) => ({
            data: new Uint8ClampedArray(sw * sh * 4),
            width: sw,
            height: sh
          })
        };
      }
    }

    (globalThis as Record<string, unknown>)['HTMLVideoElement'] = FakeHTMLVideoElement;
    (globalThis as Record<string, unknown>)['OffscreenCanvas'] = FakeOffscreenCanvas;
    // @ts-expect-error mock window
    globalThis.window = {};

    const fakeVideo = new FakeHTMLVideoElement();
    const result = await parseImageInput(fakeVideo);
    expect(result.width).toBe(24);
    expect(result.height).toBe(20);
    expect(result.data.length).toBe(24 * 20 * 4);
  });

  it('throws when canvas 2D context cannot be obtained', async () => {
    class BadCanvas {
      width = 10;
      height = 10;
      getContext() {
        return null;
      }
    }

    (globalThis as Record<string, unknown>)['HTMLCanvasElement'] = BadCanvas;
    // @ts-expect-error mock window
    globalThis.window = {};

    await expect(parseImageInput(new BadCanvas())).rejects.toThrow(InvalidInputError);
  });

  it('rejects empty ArrayBuffer or empty Blob', async () => {
    await expect(parseImageInput(new ArrayBuffer(0))).rejects.toThrow(InvalidInputError);
    await expect(parseImageInput(new Blob([]))).rejects.toThrow(InvalidInputError);
  });

  it('passes through valid RawImageData with Uint8Array or Uint8ClampedArray', async () => {
    const rawClamped = {
      data: new Uint8ClampedArray(16),
      width: 2,
      height: 2
    };
    const res1 = await parseImageInput(rawClamped);
    expect(res1.width).toBe(2);
    expect(res1.height).toBe(2);

    const rawUint = {
      data: new Uint8Array(16),
      width: 2,
      height: 2
    };
    const res2 = await parseImageInput(rawUint);
    expect(res2.width).toBe(2);
    expect(res2.height).toBe(2);
  });

  it('rejects invalid image source with 0 dimensions', async () => {
    // @ts-expect-error mock window
    globalThis.window = {};
    (globalThis as Record<string, unknown>)['ImageBitmap'] = class FakeImageBitmap {
      width = 0;
      height = 0;
    };

    const emptyBitmap = new (globalThis as Record<string, unknown>)['ImageBitmap']();
    await expect(parseImageInput(emptyBitmap)).rejects.toThrow(InvalidInputError);
  });

  it('falls back to document.createElement("canvas") when OffscreenCanvas is undefined', async () => {
    // @ts-expect-error mock window
    globalThis.window = {};
    delete (globalThis as Record<string, unknown>)['OffscreenCanvas'];

    const mockCtx = {
      drawImage: vi.fn(),
      getImageData: () => ({
        data: new Uint8ClampedArray(400),
        width: 10,
        height: 10
      })
    };

    (globalThis as Record<string, unknown>)['document'] = {
      createElement: vi.fn().mockReturnValue({
        width: 10,
        height: 10,
        getContext: () => mockCtx
      })
    };

    (globalThis as Record<string, unknown>)['ImageBitmap'] = class FakeBitmap {
      width = 10;
      height = 10;
    };

    const bitmap = new (globalThis as Record<string, unknown>)['ImageBitmap']();
    const result = await parseImageInput(bitmap);
    expect(result.width).toBe(10);
    expect(result.height).toBe(10);
  });

  it('rejects unsupported types in Node environment', async () => {
    // @ts-expect-error null window/doc
    delete globalThis.window;
    // @ts-expect-error null window/doc
    delete globalThis.document;

    await expect(parseImageInput(12345)).rejects.toThrow(InvalidInputError);
    await expect(parseImageInput(true)).rejects.toThrow(InvalidInputError);
    await expect(parseImageInput({ some: 'object' })).rejects.toThrow(InvalidInputError);
  });
});
