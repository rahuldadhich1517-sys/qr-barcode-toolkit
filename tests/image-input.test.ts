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
});
