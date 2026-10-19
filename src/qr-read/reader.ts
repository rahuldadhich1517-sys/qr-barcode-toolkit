import { decodeShared } from '../internal/decoder/index.js';
import { parseImageInput, type SupportedImageInput } from '../internal/image-input/index.js';
import { InvalidOptionsError, TimeoutError } from '../internal/errors/index.js';
import type { QrReaderOptions, QrReadResult } from './types.js';

export async function readQrCode(
  input: SupportedImageInput,
  options: QrReaderOptions = {}
): Promise<QrReadResult | null> {
  if (options && typeof options !== 'object') {
    throw new InvalidOptionsError('QrReader options must be an object');
  }
  if (options.timeoutMs !== undefined) {
    if (typeof options.timeoutMs !== 'number' || !Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
      throw new InvalidOptionsError('timeoutMs must be a positive number');
    }
  }

  const { signal, timeoutMs } = options;
  if (signal?.aborted) {
    throw new TimeoutError('Decoding was aborted');
  }

  const execute = async (): Promise<QrReadResult | null> => {
    const rawImage = await parseImageInput(input);
    if (signal?.aborted) {
      throw new TimeoutError('Decoding was aborted');
    }

    const result = await decodeShared(rawImage, {
      formats: ['QR_CODE'],
      tryHarder: options.tryHarder,
      signal: options.signal,
      timeoutMs: options.timeoutMs
    });

    if (!result || result.format !== 'QR_CODE') {
      return null;
    }

    return {
      text: result.text,
      format: 'QR_CODE',
      rawBytes: result.rawBytes,
      numBits: result.numBits,
      resultPoints: result.resultPoints,
      metadata: result.metadata
    };
  };

  if (!timeoutMs && !signal) {
    return execute();
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  let abortHandler: (() => void) | undefined;

  const controlPromise = new Promise<never>((_, reject) => {
    if (timeoutMs) {
      timer = setTimeout(() => {
        reject(new TimeoutError(`Decoding timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }
    if (signal) {
      abortHandler = () => reject(new TimeoutError('Decoding was aborted'));
      signal.addEventListener('abort', abortHandler, { once: true });
    }
  });

  try {
    return await Promise.race([execute(), controlPromise]);
  } finally {
    if (timer) clearTimeout(timer);
    if (signal && abortHandler) {
      signal.removeEventListener('abort', abortHandler);
    }
  }
}

