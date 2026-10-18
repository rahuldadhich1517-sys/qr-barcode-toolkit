import { PNG } from 'pngjs';
import { InvalidInputError } from '../errors/index.js';

export interface RawImageData {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

export type SupportedImageInput =
  | RawImageData
  | Uint8Array
  | ArrayBuffer
  | Blob
  | unknown; // DOM elements (HTMLImageElement, HTMLCanvasElement, HTMLVideoElement, ImageBitmap)

export function isRawImageData(input: unknown): input is RawImageData {
  if (!input || typeof input !== 'object') return false;
  const candidate = input as Record<string, unknown>;
  return (
    typeof candidate['width'] === 'number' &&
    typeof candidate['height'] === 'number' &&
    candidate['width'] > 0 &&
    candidate['height'] > 0 &&
    (candidate['data'] instanceof Uint8Array ||
      candidate['data'] instanceof Uint8ClampedArray ||
      (typeof Buffer !== 'undefined' && Buffer.isBuffer(candidate['data'])))
  );
}

export async function parseImageInput(input: unknown): Promise<RawImageData> {
  if (input === null || input === undefined) {
    throw new InvalidInputError('Image input cannot be null or undefined');
  }

  // 1. Direct RawImageData or ImageData
  if (isRawImageData(input)) {
    return {
      data: input.data,
      width: input.width,
      height: input.height
    };
  }

  // 2. Buffer or Uint8Array (typically PNG or raw bytes)
  if (input instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(input))) {
    if (input.byteLength === 0) {
      throw new InvalidInputError('Image byte buffer is empty');
    }
    const buf = Buffer.isBuffer(input) ? input : Buffer.from(input.buffer, input.byteOffset, input.byteLength);
    try {
      const png = PNG.sync.read(buf);
      return {
        data: png.data,
        width: png.width,
        height: png.height
      };
    } catch (err) {
      throw new InvalidInputError(
        'Failed to parse image buffer as PNG. Ensure the buffer contains valid PNG bytes or provide a RawImageData object.',
        err
      );
    }
  }

  // 3. ArrayBuffer
  if (input instanceof ArrayBuffer) {
    if (input.byteLength === 0) {
      throw new InvalidInputError('ArrayBuffer is empty');
    }
    return parseImageInput(new Uint8Array(input));
  }

  // 4. Browser Blob / File
  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    if (input.size === 0) {
      throw new InvalidInputError('Image Blob is empty');
    }
    const arrayBuffer = await input.arrayBuffer();
    // In Node or browser with PNG, try PNG parser first
    try {
      return await parseImageInput(arrayBuffer);
    } catch {
      // In browser, decode via createImageBitmap or Image element if available
      if (typeof createImageBitmap === 'function') {
        const bitmap = await createImageBitmap(input);
        return extractFromCanvasSource(bitmap);
      }
      throw new InvalidInputError('Could not decode Blob in this environment');
    }
  }

  // 5. Browser DOM Canvas / Image / Video / ImageBitmap
  if (typeof window !== 'undefined' || typeof document !== 'undefined') {
    return extractFromCanvasSource(input);
  }

  throw new InvalidInputError(
    `Unsupported image input type: ${typeof input}. Supported types are RawImageData, PNG Uint8Array/Buffer, and browser image/canvas/video elements.`
  );
}

function extractFromCanvasSource(source: unknown): RawImageData {
  if (!source || typeof source !== 'object') {
    throw new InvalidInputError('Invalid canvas source');
  }

  // Check HTMLCanvasElement
  if (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) {
    const ctx = source.getContext('2d');
    if (!ctx) {
      throw new InvalidInputError('Failed to get 2D rendering context from canvas');
    }
    const imgData = ctx.getImageData(0, 0, source.width, source.height);
    return {
      data: imgData.data,
      width: imgData.width,
      height: imgData.height
    };
  }

  // Check OffscreenCanvas
  if (typeof OffscreenCanvas !== 'undefined' && source instanceof OffscreenCanvas) {
    const ctx = source.getContext('2d');
    if (!ctx) {
      throw new InvalidInputError('Failed to get 2D rendering context from OffscreenCanvas');
    }
    const imgData = ctx.getImageData(0, 0, source.width, source.height);
    return {
      data: imgData.data,
      width: imgData.width,
      height: imgData.height
    };
  }

  // Check ImageBitmap, HTMLImageElement, HTMLVideoElement
  let width = 0;
  let height = 0;

  if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
    width = source.width;
    height = source.height;
  } else if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) {
    width = source.naturalWidth || source.width;
    height = source.naturalHeight || source.height;
  } else if (typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement) {
    width = source.videoWidth || source.width;
    height = source.videoHeight || source.height;
  }

  if (width <= 0 || height <= 0) {
    throw new InvalidInputError('Source dimensions must be greater than 0');
  }

  // Create temporary canvas to extract pixel data
  let canvas: HTMLCanvasElement | OffscreenCanvas;
  if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(width, height);
  } else if (typeof document !== 'undefined') {
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
  } else {
    throw new InvalidInputError('Canvas creation not supported in this environment');
  }

  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) {
    throw new InvalidInputError('Failed to get 2D rendering context to extract image data');
  }

  ctx.drawImage(source as CanvasImageSource, 0, 0, width, height);
  const imgData = ctx.getImageData(0, 0, width, height);
  return {
    data: imgData.data,
    width: imgData.width,
    height: imgData.height
  };
}
