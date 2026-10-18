import QRCode from 'qrcode';
import { InvalidInputError, InvalidOptionsError } from '../internal/errors/index.js';
import { validateColor, validateDimension } from '../internal/validation/index.js';
import type { QrErrorCorrectionLevel, QrGeneratorOptions, QrOutputFormat } from './types.js';

const VALID_ERROR_CORRECTION_LEVELS: ReadonlySet<string> = new Set(['L', 'M', 'Q', 'H']);
const VALID_OUTPUT_FORMATS: ReadonlySet<string> = new Set(['svg', 'png', 'data-url']);

export function generateQrCode(text: string, options: QrGeneratorOptions & { output: 'png' }): Promise<Uint8Array>;
export function generateQrCode(text: string, options: QrGeneratorOptions & { output: 'data-url' }): Promise<string>;
export function generateQrCode(text: string, options?: QrGeneratorOptions & { output?: 'svg' }): Promise<string>;
export function generateQrCode(text: string, options?: QrGeneratorOptions): Promise<string | Uint8Array>;
export async function generateQrCode(text: string, options: QrGeneratorOptions = {}): Promise<string | Uint8Array> {
  if (text === null || text === undefined) {
    throw new InvalidInputError('QR code text input cannot be null or undefined');
  }
  if (typeof text !== 'string') {
    throw new InvalidInputError(`QR code text input must be a string, got ${typeof text}`);
  }
  if (text.length === 0) {
    throw new InvalidInputError('QR code text input cannot be empty');
  }
  if (text.length > 7089) {
    throw new InvalidInputError(`QR code payload exceeds maximum capacity (7089 characters, got ${text.length})`);
  }

  // Validate error correction level
  const ecLevel: QrErrorCorrectionLevel = options.errorCorrectionLevel ?? 'M';
  if (!VALID_ERROR_CORRECTION_LEVELS.has(ecLevel)) {
    throw new InvalidOptionsError(
      `Invalid error correction level: "${options.errorCorrectionLevel}". Valid levels are L, M, Q, H`
    );
  }

  // Validate dimensions
  const width = validateDimension(options.width, 'width', 16, 10000);
  const margin = validateDimension(options.margin, 'margin', 0, 100) ?? 4;

  // Validate colors
  const fgColor = validateColor(options.foregroundColor, 'foregroundColor');
  const bgColor = validateColor(options.backgroundColor, 'backgroundColor');

  // Validate output format
  const outputFormat: QrOutputFormat = options.output ?? 'svg';
  if (!VALID_OUTPUT_FORMATS.has(outputFormat)) {
    throw new InvalidOptionsError(
      `Invalid output format: "${options.output}". Valid formats are 'svg', 'png', 'data-url'`
    );
  }

  const qrOptions: QRCode.QRCodeToStringOptions = {
    errorCorrectionLevel: ecLevel,
    margin,
    width,
    color: {
      dark: fgColor,
      light: bgColor
    }
  };

  try {
    if (outputFormat === 'svg') {
      const svg = await QRCode.toString(text, {
        ...qrOptions,
        type: 'svg'
      });
      return svg;
    }

    if (outputFormat === 'data-url') {
      const dataUrl = await QRCode.toDataURL(text, {
        ...qrOptions,
        type: 'image/png'
      });
      return dataUrl;
    }

    // outputFormat === 'png'
    const buffer = await QRCode.toBuffer(text, {
      ...qrOptions,
      type: 'png'
    });
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.includes('amount of data') || err.message.includes('too big')) {
        throw new InvalidInputError(
          `Payload data is too large for the selected QR configuration (${ecLevel} error correction): ${err.message}`,
          err
        );
      }
      throw new InvalidOptionsError(`Failed to generate QR code: ${err.message}`, err);
    }
    throw new InvalidOptionsError('Failed to generate QR code', err);
  }
}
