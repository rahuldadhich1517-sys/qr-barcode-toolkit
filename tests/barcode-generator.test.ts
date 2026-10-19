import { describe, expect, it } from 'vitest';
import {
  type BarcodeFormat,
  generateBarcode,
  InvalidInputError,
  InvalidOptionsError,
  SUPPORTED_BARCODE_FORMATS,
  UnsupportedFormatError
} from '../src/index.js';

describe('Barcode Generator (generateBarcode)', () => {
  const validPayloads: Record<BarcodeFormat, string> = {
    CODE_128: 'CODE-128-TEST',
    CODE_39: 'CODE39TEST',
    CODE_93: 'CODE93TEST',
    EAN_8: '90311017',
    EAN_13: '9780201379624',
    UPC_A: '012345678905',
    UPC_E: '01234565',
    ITF: '12345670',
    CODABAR: 'A123456B',
    QR_CODE: 'https://example.com/qr',
    DATA_MATRIX: 'DATAMATRIX_PAYLOAD',
    PDF_417: 'PDF417_PAYLOAD',
    AZTEC: 'AZTEC_PAYLOAD'
  };

  it('verifies that all target formats are listed in SUPPORTED_BARCODE_FORMATS', () => {
    expect(SUPPORTED_BARCODE_FORMATS.length).toBe(13);
  });

  describe('Generates valid SVG and PNG for each supported format', () => {
    for (const format of SUPPORTED_BARCODE_FORMATS) {
      it(`generates SVG and PNG for format ${format}`, async () => {
        const payload = validPayloads[format];

        // 1. SVG
        const svg = await generateBarcode(payload, {
          format,
          output: 'svg'
        });
        expect(typeof svg).toBe('string');
        expect(svg).toContain('<svg');
        expect(svg).toContain('</svg>');

        // 2. PNG
        const png = await generateBarcode(payload, {
          format,
          output: 'png'
        });
        expect(png).toBeInstanceOf(Uint8Array);
        expect(png.length).toBeGreaterThan(0);
        // PNG header check
        expect(png[0]).toBe(0x89);
        expect(png[1]).toBe(0x50);
        expect(png[2]).toBe(0x4e);
        expect(png[3]).toBe(0x47);
      });
    }
  });

  describe('Validation of format-specific content rules', () => {
    it('validates EAN-13 check digit and length', async () => {
      // 12 digits: valid (check digit calculated by generator)
      const valid12 = await generateBarcode('978020137962', { format: 'EAN_13' });
      expect(valid12).toContain('<svg');

      // 13 digits with correct check digit: valid
      const valid13 = await generateBarcode('9780201379624', { format: 'EAN_13' });
      expect(valid13).toContain('<svg');

      // 13 digits with wrong check digit: throws InvalidInputError
      await expect(
        generateBarcode('9780201379629', { format: 'EAN_13' })
      ).rejects.toThrow(InvalidInputError);

      // Non-numeric or wrong length: throws InvalidInputError
      await expect(
        generateBarcode('97802013796A', { format: 'EAN_13' })
      ).rejects.toThrow(InvalidInputError);
      await expect(
        generateBarcode('12345', { format: 'EAN_13' })
      ).rejects.toThrow(InvalidInputError);
    });

    it('validates EAN-8 check digit and length', async () => {
      // 7 digits: valid
      const valid7 = await generateBarcode('9031101', { format: 'EAN_8' });
      expect(valid7).toContain('<svg');

      // 8 digits with correct check digit: valid
      const valid8 = await generateBarcode('90311017', { format: 'EAN_8' });
      expect(valid8).toContain('<svg');

      // 8 digits with wrong check digit: throws InvalidInputError
      await expect(
        generateBarcode('90311010', { format: 'EAN_8' })
      ).rejects.toThrow(InvalidInputError);
    });

    it('validates UPC-A check digit and length', async () => {
      // 11 digits: valid
      const valid11 = await generateBarcode('01234567890', { format: 'UPC_A' });
      expect(valid11).toContain('<svg');

      // 12 digits with correct check digit: valid
      const valid12 = await generateBarcode('012345678905', { format: 'UPC_A' });
      expect(valid12).toContain('<svg');

      // 12 digits with wrong check digit: throws InvalidInputError
      await expect(
        generateBarcode('012345678909', { format: 'UPC_A' })
      ).rejects.toThrow(InvalidInputError);
    });

    it('validates ITF requires an even number of digits', async () => {
      // Even number: valid
      const validEven = await generateBarcode('123456', { format: 'ITF' });
      expect(validEven).toContain('<svg');

      // Odd number: throws InvalidInputError
      await expect(
        generateBarcode('12345', { format: 'ITF' })
      ).rejects.toThrow(InvalidInputError);

      // Non-digit: throws InvalidInputError
      await expect(
        generateBarcode('12345A', { format: 'ITF' })
      ).rejects.toThrow(InvalidInputError);
    });

    it('validates Code 39 allowed characters', async () => {
      // Valid chars: 0-9, A-Z, space, - . $ / + %
      const valid = await generateBarcode('CODE 39-$', { format: 'CODE_39' });
      expect(valid).toContain('<svg');

      // Lowercase or special disallowed char: throws InvalidInputError
      await expect(
        generateBarcode('code39lowercase', { format: 'CODE_39' })
      ).rejects.toThrow(InvalidInputError);
      await expect(
        generateBarcode('CODE39#INVALID', { format: 'CODE_39' })
      ).rejects.toThrow(InvalidInputError);
    });

    it('validates Codabar allowed characters', async () => {
      const valid = await generateBarcode('A12345B', { format: 'CODABAR' });
      expect(valid).toContain('<svg');

      await expect(
        generateBarcode('INVALID_CHARS!', { format: 'CODABAR' })
      ).rejects.toThrow(InvalidInputError);
    });

    it('validates standard ASCII for Code 128 and Code 93', async () => {
      const valid128 = await generateBarcode('ValidAscii128', { format: 'CODE_128' });
      expect(valid128).toContain('<svg');

      // Non-ASCII character (code > 127) throws InvalidInputError
      await expect(
        generateBarcode('Invalid_日本語', { format: 'CODE_128' })
      ).rejects.toThrow(InvalidInputError);
      await expect(
        generateBarcode('Invalid_日本語', { format: 'CODE_93' })
      ).rejects.toThrow(InvalidInputError);
    });
  });

  describe('Options and Error handling', () => {
    it('throws UnsupportedFormatError for unknown symbologies', async () => {
      // @ts-expect-error testing invalid format
      await expect(generateBarcode('12345', { format: 'UNKNOWN_FORMAT' })).rejects.toThrow(
        UnsupportedFormatError
      );
    });

    it('throws InvalidInputError for empty string data', async () => {
      await expect(generateBarcode('', { format: 'CODE_128' })).rejects.toThrow(InvalidInputError);
    });

    it('throws InvalidOptionsError for invalid options structure', async () => {
      // @ts-expect-error testing invalid options
      await expect(generateBarcode('12345', null)).rejects.toThrow(InvalidOptionsError);
    });

    it('supports custom colors and displayValue', async () => {
      const svg = await generateBarcode('123456', {
        format: 'CODE_128',
        foregroundColor: '#333333',
        backgroundColor: '#f0f0f0',
        displayValue: true
      });
      expect(svg).toContain('<svg');
    });

    it('supports 3-char hex colors and named CSS colors', async () => {
      const svgHex = await generateBarcode('123456', {
        format: 'CODE_128',
        foregroundColor: '#f00',
        backgroundColor: '#fff'
      });
      expect(svgHex).toContain('<svg');

      const svgNamed = await generateBarcode('123456', {
        format: 'CODE_128',
        foregroundColor: 'red',
        backgroundColor: 'white'
      });
      expect(svgNamed).toContain('<svg');

      // PNG with named colors
      const pngNamed = await generateBarcode('123456', {
        format: 'CODE_128',
        foregroundColor: 'blue',
        backgroundColor: 'yellow',
        output: 'png'
      });
      expect(pngNamed).toBeInstanceOf(Uint8Array);
    });

    it('rejects invalid color strings with InvalidOptionsError', async () => {
      await expect(
        generateBarcode('123456', { format: 'CODE_128', foregroundColor: '#zzz' })
      ).rejects.toThrow(InvalidOptionsError);

      await expect(
        generateBarcode('123456', { format: 'CODE_128', backgroundColor: 'not-a-color' })
      ).rejects.toThrow(InvalidOptionsError);

      await expect(
        generateBarcode('123456', { format: 'CODE_128', foregroundColor: '' })
      ).rejects.toThrow(InvalidOptionsError);

      // @ts-expect-error non-string color
      await expect(
        generateBarcode('123456', { format: 'CODE_128', foregroundColor: 12345 })
      ).rejects.toThrow(InvalidOptionsError);
    });

    it('validates dimension boundaries (height, scale, margin, width)', async () => {
      // Valid boundary values
      const validSvg = await generateBarcode('123456', {
        format: 'CODE_128',
        height: 1,
        scale: 1,
        margin: 0,
        width: 10
      });
      expect(validSvg).toContain('<svg');

      const validMax = await generateBarcode('123456', {
        format: 'CODE_128',
        height: 10000,
        scale: 20,
        margin: 200
      });
      expect(validMax).toContain('<svg');

      // Invalid height
      await expect(
        generateBarcode('123456', { format: 'CODE_128', height: 0 })
      ).rejects.toThrow(InvalidOptionsError);
      await expect(
        generateBarcode('123456', { format: 'CODE_128', height: 10001 })
      ).rejects.toThrow(InvalidOptionsError);
      await expect(
        generateBarcode('123456', { format: 'CODE_128', height: -5 })
      ).rejects.toThrow(InvalidOptionsError);
      await expect(
        generateBarcode('123456', { format: 'CODE_128', height: 2.5 })
      ).rejects.toThrow(InvalidOptionsError);

      // Invalid scale
      await expect(
        generateBarcode('123456', { format: 'CODE_128', scale: 0 })
      ).rejects.toThrow(InvalidOptionsError);
      await expect(
        generateBarcode('123456', { format: 'CODE_128', scale: 21 })
      ).rejects.toThrow(InvalidOptionsError);
      await expect(
        generateBarcode('123456', { format: 'CODE_128', scale: 1.5 })
      ).rejects.toThrow(InvalidOptionsError);

      // Invalid margin
      await expect(
        generateBarcode('123456', { format: 'CODE_128', margin: -1 })
      ).rejects.toThrow(InvalidOptionsError);
      await expect(
        generateBarcode('123456', { format: 'CODE_128', margin: 201 })
      ).rejects.toThrow(InvalidOptionsError);
      await expect(
        generateBarcode('123456', { format: 'CODE_128', margin: 5.5 })
      ).rejects.toThrow(InvalidOptionsError);

      // Invalid width
      await expect(
        generateBarcode('123456', { format: 'CODE_128', width: 0 })
      ).rejects.toThrow(InvalidOptionsError);
      await expect(
        generateBarcode('123456', { format: 'CODE_128', width: 10001 })
      ).rejects.toThrow(InvalidOptionsError);
    });

    it('rejects unsupported output format strings', async () => {
      // @ts-expect-error invalid output format
      await expect(
        generateBarcode('123456', { format: 'CODE_128', output: 'gif' })
      ).rejects.toThrow(InvalidOptionsError);
    });

    it('rejects non-string payload data with InvalidInputError', async () => {
      // @ts-expect-error non-string data
      await expect(generateBarcode(123456, { format: 'CODE_128' })).rejects.toThrow(InvalidInputError);
      // @ts-expect-error null data
      await expect(generateBarcode(null, { format: 'CODE_128' })).rejects.toThrow(InvalidInputError);
      // @ts-expect-error object data
      await expect(generateBarcode({ code: '123' }, { format: 'CODE_128' })).rejects.toThrow(
        InvalidInputError
      );
    });

    it('rejects payload exceeding maximum length limit', async () => {
      const excessive = 'A'.repeat(7090);
      await expect(generateBarcode(excessive, { format: 'CODE_128' })).rejects.toThrow(InvalidInputError);
    });

    it('validates UPC-E length and character rules', async () => {
      // 7 or 8 digits valid
      const upc7 = await generateBarcode('0123456', { format: 'UPC_E' });
      expect(upc7).toContain('<svg');
      const upc8 = await generateBarcode('01234565', { format: 'UPC_E' });
      expect(upc8).toContain('<svg');

      // Disallowed lengths: 6 or 9
      await expect(generateBarcode('012345', { format: 'UPC_E' })).rejects.toThrow(InvalidInputError);
      await expect(generateBarcode('123456789', { format: 'UPC_E' })).rejects.toThrow(InvalidInputError);

      // Non-numeric
      await expect(generateBarcode('012345A', { format: 'UPC_E' })).rejects.toThrow(InvalidInputError);
    });

    it('validates 2D barcode generation: DataMatrix, Aztec, PDF417', async () => {
      const dm = await generateBarcode('DataMatrix-12345-Test', { format: 'DATA_MATRIX', output: 'png' });
      expect(dm).toBeInstanceOf(Uint8Array);

      const aztec = await generateBarcode('Aztec-999-Test', { format: 'AZTEC', output: 'png' });
      expect(aztec).toBeInstanceOf(Uint8Array);

      const pdf = await generateBarcode('PDF417-MultiLine-Payload\nSecondLine', {
        format: 'PDF_417',
        output: 'png'
      });
      expect(pdf).toBeInstanceOf(Uint8Array);
    });
  });
});
