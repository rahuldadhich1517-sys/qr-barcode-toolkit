import { describe, expect, it } from 'vitest';
import {
  type BarcodeFormat,
  BrowserApiUnsupportedError,
  createBarcodeScanner,
  createQrScanner,
  DECODABLE_BARCODE_FORMATS,
  generateBarcode,
  generateQrCode,
  readBarcode,
  readQrCode
} from '../src/index.js';

describe('End-to-End Integration & Round-trip Workflows', () => {
  describe('Workflow 1: QR Code Round-trip', () => {
    const testCases = [
      'Simple ASCII text',
      'https://example.com/deep/path?query=1&item=special#anchor',
      'Unicode: 日本語, Español, Deutsch, 中文, العربية',
      'Emoji: 🚀🎉🔥💡📦',
      'Multiline payload:\nLine 1\nLine 2\nLine 3',
      JSON.stringify({ id: 101, name: 'Toolkit', active: true })
    ];

    for (const text of testCases) {
      it(`encodes and accurately recovers: "${text.slice(0, 30)}..."`, async () => {
        const pngBytes = await generateQrCode(text, {
          output: 'png',
          width: 300,
          margin: 4
        });

        const decoded = await readQrCode(pngBytes);
        expect(decoded).not.toBeNull();
        expect(decoded?.text).toBe(text);
        expect(decoded?.format).toBe('QR_CODE');
      });
    }
  });

  describe('Workflow 2 & 3: Barcode Symbology Round-trip', () => {
    const symbologyRoundTrips: Record<
      Exclude<BarcodeFormat, 'UPC_E'>,
      { payload: string; expectedText?: string; scale?: number; margin?: number }
    > = {
      CODE_128: { payload: 'TEST-CODE-128', scale: 3, margin: 15 },
      CODE_39: { payload: 'HELLO39', scale: 3, margin: 15 },
      CODE_93: { payload: 'HELLO93', scale: 3, margin: 15 },
      EAN_8: { payload: '90311017', scale: 3, margin: 15 },
      EAN_13: { payload: '9780201379624', scale: 3, margin: 15 },
      UPC_A: { payload: '012345678905', scale: 3, margin: 15 },
      ITF: { payload: '12345670', scale: 3, margin: 15 },
      CODABAR: { payload: 'A12345B', scale: 3, margin: 15 },
      QR_CODE: { payload: 'QR_ROUNDTRIP_TEST', scale: 3, margin: 15 },
      DATA_MATRIX: { payload: 'DATAMATRIX_TEST', scale: 3, margin: 15 },
      PDF_417: { payload: 'PDF417_TEST', scale: 3, margin: 15 },
      AZTEC: { payload: 'AZTEC_TEST', scale: 3, margin: 15 }
    };

    it('verifies all decodable formats match the verified list', () => {
      expect(DECODABLE_BARCODE_FORMATS.length).toBe(12);
    });

    for (const [format, config] of Object.entries(symbologyRoundTrips)) {
      it(`roundtrips ${format}: generates PNG and decodes accurately`, async () => {
        const fmt = format as BarcodeFormat;
        const png = await generateBarcode(config.payload, {
          format: fmt,
          output: 'png',
          scale: config.scale ?? 3,
          margin: config.margin ?? 15
        });

        const result = await readBarcode(png, {
          formats: [fmt],
          tryHarder: true
        });

        expect(result).not.toBeNull();
        expect(result?.text).toBe(config.expectedText ?? config.payload);
        expect(result?.format).toBe(fmt);
      });
    }
  });

  describe('Workflow 4: Universal Import & Node Compatibility', () => {
    it('universal imports do not access window, document, or navigator on import', () => {
      // In this Node environment, window and document are undefined by default
      expect(typeof window).toBe('undefined');
      expect(typeof document).toBe('undefined');

      // Functions should exist and be callable
      expect(typeof generateQrCode).toBe('function');
      expect(typeof readQrCode).toBe('function');
      expect(typeof generateBarcode).toBe('function');
      expect(typeof readBarcode).toBe('function');
      expect(typeof createQrScanner).toBe('function');
      expect(typeof createBarcodeScanner).toBe('function');
    });

    it('camera methods throw BrowserApiUnsupportedError clearly when called in Node without browser APIs', async () => {
      const qrScanner = createQrScanner({ onScan: () => {} });
      await expect(qrScanner.start()).rejects.toThrow(BrowserApiUnsupportedError);

      const barcodeScanner = createBarcodeScanner({ onScan: () => {} });
      await expect(barcodeScanner.start()).rejects.toThrow(BrowserApiUnsupportedError);
    });
  });
});
