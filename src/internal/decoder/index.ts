import {
  BarcodeFormat as ZXBarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  NotFoundException,
  QRCodeReader,
  RGBLuminanceSource
} from '@zxing/library';
import { TimeoutError } from '../errors/index.js';
import type { RawImageData } from '../image-input/index.js';
import { type BarcodeFormat, validateBarcodeFormat } from '../validation/index.js';

export interface SharedDecodeResult {
  text: string;
  format: BarcodeFormat;
  rawBytes?: Uint8Array;
  numBits?: number;
  resultPoints?: Array<{ x: number; y: number }>;
  metadata?: Record<string, unknown>;
}

export interface SharedDecoderOptions {
  formats?: BarcodeFormat[];
  tryHarder?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
}

const ZXING_TO_TOOLKIT_FORMAT: Record<number, BarcodeFormat> = {
  [ZXBarcodeFormat.QR_CODE]: 'QR_CODE',
  [ZXBarcodeFormat.CODE_128]: 'CODE_128',
  [ZXBarcodeFormat.CODE_39]: 'CODE_39',
  [ZXBarcodeFormat.CODE_93]: 'CODE_93',
  [ZXBarcodeFormat.EAN_8]: 'EAN_8',
  [ZXBarcodeFormat.EAN_13]: 'EAN_13',
  [ZXBarcodeFormat.UPC_A]: 'UPC_A',
  [ZXBarcodeFormat.UPC_E]: 'UPC_E',
  [ZXBarcodeFormat.ITF]: 'ITF',
  [ZXBarcodeFormat.CODABAR]: 'CODABAR',
  [ZXBarcodeFormat.DATA_MATRIX]: 'DATA_MATRIX',
  [ZXBarcodeFormat.PDF_417]: 'PDF_417',
  [ZXBarcodeFormat.AZTEC]: 'AZTEC'
};

const TOOLKIT_TO_ZXING_FORMAT: Record<BarcodeFormat, number> = {
  QR_CODE: ZXBarcodeFormat.QR_CODE,
  CODE_128: ZXBarcodeFormat.CODE_128,
  CODE_39: ZXBarcodeFormat.CODE_39,
  CODE_93: ZXBarcodeFormat.CODE_93,
  EAN_8: ZXBarcodeFormat.EAN_8,
  EAN_13: ZXBarcodeFormat.EAN_13,
  UPC_A: ZXBarcodeFormat.UPC_A,
  UPC_E: ZXBarcodeFormat.UPC_E,
  ITF: ZXBarcodeFormat.ITF,
  CODABAR: ZXBarcodeFormat.CODABAR,
  DATA_MATRIX: ZXBarcodeFormat.DATA_MATRIX,
  PDF_417: ZXBarcodeFormat.PDF_417,
  AZTEC: ZXBarcodeFormat.AZTEC
};

export function toGrayscaleBuffer(
  imageBuffer: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number
): Uint8ClampedArray {
  const size = width * height;
  const grayscale = new Uint8ClampedArray(size);
  for (let i = 0, j = 0; j < size; i += 4, j++) {
    const alpha = imageBuffer[i + 3] ?? 255;
    if (alpha === 0) {
      grayscale[j] = 0xff; // transparent treated as white
    } else {
      const r = imageBuffer[i] ?? 0;
      const g = imageBuffer[i + 1] ?? 0;
      const b = imageBuffer[i + 2] ?? 0;
      // 0.299R + 0.587G + 0.114B in integer math
      grayscale[j] = (306 * r + 601 * g + 117 * b + 0x200) >> 10;
    }
  }
  return grayscale;
}

export function toZxingFormats(formats: BarcodeFormat[]): number[] {
  const result: number[] = [];
  for (const fmt of formats) {
    validateBarcodeFormat(fmt);
    const zx = TOOLKIT_TO_ZXING_FORMAT[fmt];
    if (zx !== undefined) {
      result.push(zx);
    }
  }
  return result;
}

export function toToolkitFormat(zxFormat: number): BarcodeFormat | undefined {
  return ZXING_TO_TOOLKIT_FORMAT[zxFormat];
}

export function createBinaryBitmap(raw: RawImageData): BinaryBitmap {
  const { data, width, height } = raw;
  let grayscale: Uint8ClampedArray;

  // If already grayscale (1 byte per pixel: width * height)
  if (data.length === width * height) {
    grayscale = data instanceof Uint8ClampedArray ? data : new Uint8ClampedArray(data);
  } else if (data.length === width * height * 4) {
    // RGBA: convert to grayscale buffer
    grayscale = toGrayscaleBuffer(data, width, height);
  } else {
    // Fallback: take average of channels
    grayscale = new Uint8ClampedArray(width * height);
    const channels = Math.max(1, Math.floor(data.length / (width * height)));
    for (let i = 0, j = 0; j < grayscale.length; i += channels, j++) {
      grayscale[j] = data[i] ?? 0;
    }
  }

  const luminanceSource = new RGBLuminanceSource(grayscale, width, height);
  return new BinaryBitmap(new HybridBinarizer(luminanceSource));
}

export async function decodeShared(
  raw: RawImageData,
  options: SharedDecoderOptions = {}
): Promise<SharedDecodeResult | null> {
  const { signal, timeoutMs } = options;

  if (signal?.aborted) {
    throw new TimeoutError('Decode operation was aborted');
  }

  let timer: ReturnType<typeof setTimeout> | undefined;

  const execution = new Promise<SharedDecodeResult | null>((resolve, reject) => {
    try {
      if (signal?.aborted) {
        return reject(new TimeoutError('Decode operation was aborted'));
      }

      const binaryBitmap = createBinaryBitmap(raw);

      // If caller specified an empty formats list, no format matches
      if (options.formats && options.formats.length === 0) {
        return resolve(null);
      }

      // Dedicated fast path for QR_CODE only
      if (options.formats && options.formats.length === 1 && options.formats[0] === 'QR_CODE') {
        const qrReader = new QRCodeReader();
        try {
          const hints = new Map<DecodeHintType, unknown>();
          if (options.tryHarder) {
            hints.set(DecodeHintType.TRY_HARDER, true);
          }
          const res = qrReader.decode(binaryBitmap, hints);
          return resolve(extractResult(res));
        } catch (err) {
          if (
            err instanceof NotFoundException ||
            (err && typeof err === 'object' && err.constructor?.name === 'NotFoundException')
          ) {
            return resolve(null);
          }
          return resolve(null);
        }
      }

      // Multi format path
      const multiReader = new MultiFormatReader();
      const hints = new Map<DecodeHintType, unknown>();

      if (options.formats && options.formats.length > 0) {
        const zxFormats = toZxingFormats(options.formats);
        hints.set(DecodeHintType.POSSIBLE_FORMATS, zxFormats);
      }
      if (options.tryHarder) {
        hints.set(DecodeHintType.TRY_HARDER, true);
      }

      try {
        const res = multiReader.decode(binaryBitmap, hints);
        const extracted = extractResult(res);
        if (options.formats && options.formats.length > 0 && !options.formats.includes(extracted.format)) {
          return resolve(null);
        }
        return resolve(extracted);
      } catch (err) {
        if (
          err instanceof NotFoundException ||
          (err && typeof err === 'object' && err.constructor?.name === 'NotFoundException')
        ) {
          return resolve(null);
        }
        return resolve(null);
      }
    } catch (err) {
      reject(err);
    }
  });

  if (timeoutMs && timeoutMs > 0) {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new TimeoutError(`Decoding timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([execution, timeoutPromise]);
      if (timer) clearTimeout(timer);
      return result;
    } catch (err) {
      if (timer) clearTimeout(timer);
      throw err;
    }
  }

  return execution;
}

function extractResult(res: any): SharedDecodeResult {
  const formatNum = typeof res.getBarcodeFormat === 'function' ? res.getBarcodeFormat() : res.format;
  const toolkitFormat = toToolkitFormat(formatNum) || 'QR_CODE';

  const rawBytes = typeof res.getRawBytes === 'function' ? res.getRawBytes() : undefined;
  const numBits = typeof res.getNumBits === 'function' ? res.getNumBits() : undefined;

  let resultPoints: Array<{ x: number; y: number }> | undefined;
  if (typeof res.getResultPoints === 'function') {
    const points = res.getResultPoints();
    if (Array.isArray(points)) {
      resultPoints = points.map((p: any) => ({
        x: typeof p.getX === 'function' ? p.getX() : p.x,
        y: typeof p.getY === 'function' ? p.getY() : p.y
      }));
    }
  }

  let metadata: Record<string, unknown> | undefined;
  if (typeof res.getResultMetadata === 'function') {
    const rawMeta = res.getResultMetadata();
    if (rawMeta instanceof Map) {
      metadata = Object.fromEntries(rawMeta);
    } else if (rawMeta && typeof rawMeta === 'object') {
      metadata = { ...rawMeta };
    }
  }

  return {
    text: res.getText(),
    format: toolkitFormat,
    rawBytes,
    numBits,
    resultPoints,
    metadata
  };
}
