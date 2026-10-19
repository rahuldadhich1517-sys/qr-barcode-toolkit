import { InvalidInputError, InvalidOptionsError, UnsupportedFormatError } from '../errors/index.js';

export type BarcodeFormat =
  | 'CODE_128'
  | 'CODE_39'
  | 'CODE_93'
  | 'EAN_8'
  | 'EAN_13'
  | 'UPC_A'
  | 'UPC_E'
  | 'ITF'
  | 'CODABAR'
  | 'QR_CODE'
  | 'DATA_MATRIX'
  | 'PDF_417'
  | 'AZTEC';

export const SUPPORTED_BARCODE_FORMATS: readonly BarcodeFormat[] = Object.freeze([
  'CODE_128',
  'CODE_39',
  'CODE_93',
  'EAN_8',
  'EAN_13',
  'UPC_A',
  'UPC_E',
  'ITF',
  'CODABAR',
  'QR_CODE',
  'DATA_MATRIX',
  'PDF_417',
  'AZTEC'
]);

// Decodable formats verified with real round-trip tests
export const DECODABLE_BARCODE_FORMATS: readonly BarcodeFormat[] = Object.freeze([
  'CODE_128',
  'CODE_39',
  'CODE_93',
  'EAN_8',
  'EAN_13',
  'UPC_A',
  'ITF',
  'CODABAR',
  'QR_CODE',
  'DATA_MATRIX',
  'PDF_417',
  'AZTEC'
]);

export function calculateEanUpcChecksum(digits: string): number {
  if (typeof digits !== 'string' || !/^\d+$/.test(digits)) {
    throw new InvalidInputError(`Cannot calculate checksum for non-numeric digits: "${String(digits)}"`);
  }
  const len = digits.length;
  let sum = 0;
  for (let i = 0; i < len; i++) {
    const digit = Number.parseInt(digits[i]!, 10);
    // Working from right to left (excluding check digit)
    const weight = (len - i) % 2 === 1 ? 3 : 1;
    sum += digit * weight;
  }
  return (10 - (sum % 10)) % 10;
}

export function validateBarcodeFormat(format: unknown): asserts format is BarcodeFormat {
  if (typeof format !== 'string' || !SUPPORTED_BARCODE_FORMATS.includes(format as BarcodeFormat)) {
    throw new UnsupportedFormatError(
      `Unsupported barcode format: "${String(format)}". Supported formats: ${SUPPORTED_BARCODE_FORMATS.join(', ')}`
    );
  }
}

const STANDARD_NAMED_COLORS: Readonly<Record<string, string>> = Object.freeze({
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  yellow: '#ffff00',
  cyan: '#00ffff',
  magenta: '#ff00ff',
  gray: '#808080',
  grey: '#808080',
  silver: '#c0c0c0',
  maroon: '#800000',
  olive: '#808000',
  purple: '#800080',
  teal: '#008080',
  navy: '#000080',
  orange: '#ffa500'
});

export function validateColor(color: unknown, fieldName: string): string {
  if (color === undefined || color === null) {
    return fieldName === 'foregroundColor' ? '#000000' : '#ffffff';
  }
  if (typeof color !== 'string') {
    throw new InvalidOptionsError(`${fieldName} must be a valid CSS color string`);
  }
  const trimmed = color.trim();
  if (trimmed.length === 0) {
    throw new InvalidOptionsError(`${fieldName} cannot be empty`);
  }

  const lower = trimmed.toLowerCase();
  if (STANDARD_NAMED_COLORS[lower]) {
    return STANDARD_NAMED_COLORS[lower]!;
  }

  // Parse rgb(r, g, b) or rgba(r, g, b, a) into hex
  const rgbMatch = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    const r = Math.min(255, Math.max(0, parseInt(rgbMatch[1]!, 10))).toString(16).padStart(2, '0');
    const g = Math.min(255, Math.max(0, parseInt(rgbMatch[2]!, 10))).toString(16).padStart(2, '0');
    const b = Math.min(255, Math.max(0, parseInt(rgbMatch[3]!, 10))).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }

  const hexPattern = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
  const funcPattern = /^(hsl|hsla)\(\s*[\d.%\s,/-]+\s*\)$/i;

  if (!hexPattern.test(trimmed) && !funcPattern.test(trimmed)) {
    throw new InvalidOptionsError(`${fieldName} contains invalid or unsafe characters: "${trimmed}"`);
  }
  return trimmed;
}

export function validateDimension(value: unknown, name: string, min = 1, max = 10000): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw new InvalidOptionsError(`${name} must be an integer between ${min} and ${max}`);
  }
  if (value < min || value > max) {
    throw new InvalidOptionsError(`${name} must be between ${min} and ${max}, got ${value}`);
  }
  return value;
}

export function validateBarcodeData(format: BarcodeFormat, data: unknown): string {
  if (typeof data !== 'string') {
    throw new InvalidInputError(`Barcode data must be a string, got ${typeof data}`);
  }
  if (data.length === 0) {
    throw new InvalidInputError('Barcode data cannot be empty');
  }

  // Length safeguards
  if (data.length > 7089) {
    throw new InvalidInputError(`Barcode data exceeds maximum allowed length (7089 chars, got ${data.length})`);
  }

  switch (format) {
    case 'EAN_13': {
      if (!/^\d{12,13}$/.test(data)) {
        throw new InvalidInputError(`EAN-13 data must be 12 or 13 digits, got "${data}"`);
      }
      if (data.length === 13) {
        const expected = calculateEanUpcChecksum(data.slice(0, 12));
        const actual = Number.parseInt(data[12]!, 10);
        if (expected !== actual) {
          throw new InvalidInputError(`EAN-13 checksum mismatch: expected ${expected}, got ${actual}`);
        }
      }
      break;
    }
    case 'EAN_8': {
      if (!/^\d{7,8}$/.test(data)) {
        throw new InvalidInputError(`EAN-8 data must be 7 or 8 digits, got "${data}"`);
      }
      if (data.length === 8) {
        const expected = calculateEanUpcChecksum(data.slice(0, 7));
        const actual = Number.parseInt(data[7]!, 10);
        if (expected !== actual) {
          throw new InvalidInputError(`EAN-8 checksum mismatch: expected ${expected}, got ${actual}`);
        }
      }
      break;
    }
    case 'UPC_A': {
      if (!/^\d{11,12}$/.test(data)) {
        throw new InvalidInputError(`UPC-A data must be 11 or 12 digits, got "${data}"`);
      }
      if (data.length === 12) {
        const expected = calculateEanUpcChecksum(data.slice(0, 11));
        const actual = Number.parseInt(data[11]!, 10);
        if (expected !== actual) {
          throw new InvalidInputError(`UPC-A checksum mismatch: expected ${expected}, got ${actual}`);
        }
      }
      break;
    }
    case 'UPC_E': {
      if (!/^\d{7,8}$/.test(data)) {
        throw new InvalidInputError(`UPC-E data must be 7 or 8 digits, got "${data}"`);
      }
      break;
    }
    case 'ITF': {
      if (!/^\d+$/.test(data)) {
        throw new InvalidInputError(`ITF data must contain only digits, got "${data}"`);
      }
      if (data.length % 2 !== 0) {
        throw new InvalidInputError(`ITF data must have an even number of digits, got length ${data.length}`);
      }
      break;
    }
    case 'CODE_39': {
      const code39Regex = /^[0-9A-Z\-. $/+%]+$/;
      if (!code39Regex.test(data)) {
        throw new InvalidInputError(
          `Code 39 data contains invalid characters. Supported characters are 0-9, A-Z, space, and "- . $ / + %"`
        );
      }
      break;
    }
    case 'CODABAR': {
      const codabarRegex = /^[A-Da-d]?[0-9\-$:/.+]+[A-Da-d]?$/;
      if (!codabarRegex.test(data)) {
        throw new InvalidInputError(
          `Codabar data contains invalid characters. Supported characters are 0-9, "- $ : / . +", with optional start/stop characters A-D`
        );
      }
      break;
    }
    case 'CODE_128':
    case 'CODE_93': {
      // standard ASCII range
      for (let i = 0; i < data.length; i++) {
        if (data.charCodeAt(i) > 127) {
          throw new InvalidInputError(
            `${format} requires standard ASCII characters (0-127), found code ${data.charCodeAt(i)} at index ${i}`
          );
        }
      }
      break;
    }
    case 'QR_CODE':
    case 'DATA_MATRIX':
    case 'PDF_417':
    case 'AZTEC': {
      // 2D matrix symbologies support UTF-8 strings
      break;
    }
  }

  return data;
}
