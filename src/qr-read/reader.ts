import { decodeShared } from '../internal/decoder/index.js';
import { parseImageInput, type SupportedImageInput } from '../internal/image-input/index.js';
import type { QrReaderOptions, QrReadResult } from './types.js';

export async function readQrCode(
  input: SupportedImageInput,
  options: QrReaderOptions = {}
): Promise<QrReadResult | null> {
  const rawImage = await parseImageInput(input);

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
}
