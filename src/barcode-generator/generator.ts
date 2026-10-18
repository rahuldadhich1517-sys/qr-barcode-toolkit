import bwipjs from 'bwip-js';
import { InvalidInputError, InvalidOptionsError } from '../internal/errors/index.js';
import {
  type BarcodeFormat,
  validateBarcodeData,
  validateBarcodeFormat,
  validateColor,
  validateDimension
} from '../internal/validation/index.js';
import { generateQrCode } from '../qr-generator/generator.js';
import type { BarcodeGeneratorOptions, BarcodeOutputFormat } from './types.js';

const BARCODE_BCID_MAP: Record<BarcodeFormat, string> = {
  CODE_128: 'code128',
  CODE_39: 'code39',
  CODE_93: 'code93',
  EAN_8: 'ean8',
  EAN_13: 'ean13',
  UPC_A: 'upca',
  UPC_E: 'upce',
  ITF: 'interleaved2of5',
  CODABAR: 'rationalizedCodabar',
  QR_CODE: 'qrcode',
  DATA_MATRIX: 'datamatrix',
  PDF_417: 'pdf417',
  AZTEC: 'azteccode'
};

const VALID_OUTPUT_FORMATS: ReadonlySet<string> = new Set(['svg', 'png']);

function formatColorForBwip(colorStr: string): string {
  if (colorStr.startsWith('#')) {
    return colorStr.slice(1);
  }
  return colorStr;
}

export function generateBarcode(
  data: string,
  options: BarcodeGeneratorOptions & { output: 'png' }
): Promise<Uint8Array>;
export function generateBarcode(
  data: string,
  options: BarcodeGeneratorOptions & { output?: 'svg' }
): Promise<string>;
export function generateBarcode(data: string, options: BarcodeGeneratorOptions): Promise<string | Uint8Array>;
export async function generateBarcode(
  data: string,
  options: BarcodeGeneratorOptions
): Promise<string | Uint8Array> {
  if (!options || typeof options !== 'object') {
    throw new InvalidOptionsError('BarcodeGenerator options must be provided as an object');
  }

  validateBarcodeFormat(options.format);
  const validatedData = validateBarcodeData(options.format, data);

  const outputFormat: BarcodeOutputFormat = options.output ?? 'svg';
  if (!VALID_OUTPUT_FORMATS.has(outputFormat)) {
    throw new InvalidOptionsError(
      `Invalid output format: "${options.output}". Valid formats are 'svg' and 'png'`
    );
  }

  // Reuse QR generator for QR_CODE format
  if (options.format === 'QR_CODE') {
    if (outputFormat === 'png') {
      return generateQrCode(validatedData, {
        width: options.width,
        margin: options.margin,
        foregroundColor: options.foregroundColor,
        backgroundColor: options.backgroundColor,
        output: 'png'
      });
    }
    return generateQrCode(validatedData, {
      width: options.width,
      margin: options.margin,
      foregroundColor: options.foregroundColor,
      backgroundColor: options.backgroundColor,
      output: 'svg'
    });
  }

  const fgColor = validateColor(options.foregroundColor, 'foregroundColor');
  const bgColor = validateColor(options.backgroundColor, 'backgroundColor');

  const width = validateDimension(options.width, 'width', 1, 10000);
  const height = validateDimension(options.height, 'height', 1, 10000);
  const scale = validateDimension(options.scale, 'scale', 1, 20) ?? 2;
  const margin = validateDimension(options.margin, 'margin', 0, 200) ?? 10;

  const bcid = BARCODE_BCID_MAP[options.format];
  const bwipOptions: bwipjs.RenderOptions = {
    bcid,
    text: validatedData,
    scale,
    padding: margin,
    includetext: Boolean(options.displayValue),
    barcolor: formatColorForBwip(fgColor),
    backgroundcolor: formatColorForBwip(bgColor)
  };

  if (height !== undefined) {
    bwipOptions.height = height;
  }
  if (width !== undefined) {
    bwipOptions.width = width;
  }

  // Code 93 requires checksum encoding
  if (options.format === 'CODE_93') {
    bwipOptions.includecheck = true;
  }

  try {
    if (outputFormat === 'svg') {
      const svg = bwipjs.toSVG(bwipOptions);
      return svg;
    }

    // outputFormat === 'png'
    const pngBuffer = await bwipjs.toBuffer(bwipOptions);
    return new Uint8Array(pngBuffer.buffer, pngBuffer.byteOffset, pngBuffer.byteLength);
  } catch (err) {
    if (err instanceof Error) {
      throw new InvalidInputError(`Failed to generate barcode (${options.format}): ${err.message}`, err);
    }
    throw new InvalidInputError(`Failed to generate barcode (${options.format})`, err);
  }
}
