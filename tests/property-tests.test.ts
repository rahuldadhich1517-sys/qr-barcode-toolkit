import { describe, expect, it } from 'vitest';
import {
  calculateEanUpcChecksum,
  createBarcodeScanner,
  createQrScanner,
  generateBarcode,
  generateQrCode,
  InvalidInputError,
  readBarcode,
  readQrCode
} from '../src/index.js';

describe('Phase 13: Property-Based & Invariant Testing', () => {
  describe('QR Code Round-Trip Invariants', () => {
    // Deterministic pseudo-random string generator
    function generatePseudoRandomString(seed: number, length: number): string {
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[]{}|;:,.<>?';
      let result = '';
      let state = seed;
      for (let i = 0; i < length; i++) {
        state = (state * 9301 + 49297) % 233280;
        const index = Math.floor((state / 233280) * chars.length);
        result += chars[index];
      }
      return result;
    }

    it('preserves exact payload for varied lengths and character combinations', async () => {
      const testCases = [
        generatePseudoRandomString(1, 5),
        generatePseudoRandomString(2, 25),
        generatePseudoRandomString(3, 80),
        generatePseudoRandomString(4, 150),
        'Unicode-Invariant-測試-тест-اختبار-🚀',
        'Special chars: \t\n\r"\'&<>'
      ];

      for (const payload of testCases) {
        const png = await generateQrCode(payload, { output: 'png', width: 250, margin: 4 });
        const decoded = await readQrCode(png);
        expect(decoded).not.toBeNull();
        expect(decoded?.text).toBe(payload);
        expect(decoded?.format).toBe('QR_CODE');
      }
    });
  });

  describe('Barcode Round-Trip Invariants', () => {
    it('round-trips Code 128 across varied valid ASCII strings', async () => {
      const payloads = ['ABC-123', 'HELLO_WORLD_99', 'Code128-Invariant-Check-2026', '382947192847'];

      for (const payload of payloads) {
        const png = await generateBarcode(payload, {
          format: 'CODE_128',
          output: 'png',
          scale: 3,
          margin: 15
        });
        const decoded = await readBarcode(png, { formats: ['CODE_128'] });
        expect(decoded).not.toBeNull();
        expect(decoded?.text).toBe(payload);
        expect(decoded?.format).toBe('CODE_128');
      }
    });

    it('round-trips ITF across valid even-length digit strings', async () => {
      const itfPayloads = ['123456', '567890', '12345678', '998877665544'];

      for (const payload of itfPayloads) {
        const png = await generateBarcode(payload, {
          format: 'ITF',
          output: 'png',
          scale: 3,
          margin: 15
        });
        const decoded = await readBarcode(png, { formats: ['ITF'] });
        expect(decoded).not.toBeNull();
        expect(decoded?.text).toBe(payload);
        expect(decoded?.format).toBe('ITF');
      }
    });

    it('round-trips EAN-13 and UPC-A barcodes with auto-calculated check digits', async () => {
      const eanPayload = '978020137962'; // 12 digits, check digit will be calculated
      const eanPng = await generateBarcode(eanPayload, {
        format: 'EAN_13',
        output: 'png',
        scale: 3,
        margin: 15
      });
      const eanDecoded = await readBarcode(eanPng, { formats: ['EAN_13'] });
      expect(eanDecoded).not.toBeNull();
      expect(eanDecoded?.text).toBe('9780201379624');

      const upcPayload = '01234567890'; // 11 digits, check digit will be calculated
      const upcPng = await generateBarcode(upcPayload, {
        format: 'UPC_A',
        output: 'png',
        scale: 3,
        margin: 15
      });
      const upcDecoded = await readBarcode(upcPng, { formats: ['UPC_A'] });
      expect(upcDecoded).not.toBeNull();
      expect(upcDecoded?.text).toBe('012345678905');
    });
  });

  describe('Checksum Invariants', () => {
    it('produces valid check digit 0-9 for any numeric sequence', () => {
      for (let seed = 100; seed < 115; seed++) {
        const digits = String(seed * 8923471).slice(0, 11);
        const checkDigit = calculateEanUpcChecksum(digits);
        expect(checkDigit).toBeGreaterThanOrEqual(0);
        expect(checkDigit).toBeLessThanOrEqual(9);
        expect(Number.isInteger(checkDigit)).toBe(true);
      }
    });

    it('detects single-digit mutations in EAN-13 checksum verification', async () => {
      const validEan = '9780201379624'; // correct check digit is 4
      // Altering each position from index 0 to 11 should invalidate or change checksum
      for (let i = 0; i < 12; i++) {
        const originalDigit = Number.parseInt(validEan[i]!, 10);
        const mutatedDigit = (originalDigit + 1) % 10;
        const mutated = validEan.slice(0, i) + String(mutatedDigit) + validEan.slice(i + 1);

        // Mutated full 13-digit string must fail validation
        await expect(
          generateBarcode(mutated, { format: 'EAN_13' })
        ).rejects.toThrow(InvalidInputError);
      }
    });
  });

  describe('Leading Zeros Preservation Invariant', () => {
    it('preserves leading zeros in QR and barcode payloads without numeric coercion', async () => {
      const leadingZeroPayloads = ['001234', '000000', '007', '012345678905'];

      for (const payload of leadingZeroPayloads) {
        // QR Code
        const qrPng = await generateQrCode(payload, { output: 'png' });
        const qrDecoded = await readQrCode(qrPng);
        expect(qrDecoded?.text).toBe(payload);
        expect(qrDecoded?.text.startsWith('0')).toBe(true);

        // Code 128
        const barcodePng = await generateBarcode(payload, { format: 'CODE_128', output: 'png', scale: 3, margin: 15 });
        const barcodeDecoded = await readBarcode(barcodePng, { formats: ['CODE_128'] });
        expect(barcodeDecoded?.text).toBe(payload);
      }
    });
  });

  describe('Lifecycle Idempotency Invariants', () => {
    it('calling stop() repeatedly preserves stopped state', async () => {
      const scanner = createQrScanner({
        video: { readyState: 4, play: async () => {}, pause: () => {} } as unknown as HTMLVideoElement,
        onScan: () => {}
      });

      for (let i = 0; i < 5; i++) {
        await scanner.stop();
        expect(scanner.getState()).toBe('stopped');
      }
    });

    it('calling destroy() repeatedly preserves destroyed state', () => {
      const scanner = createBarcodeScanner({
        video: { readyState: 4, play: async () => {}, pause: () => {} } as unknown as HTMLVideoElement,
        onScan: () => {}
      });

      for (let i = 0; i < 5; i++) {
        scanner.destroy();
        expect(scanner.getState()).toBe('destroyed');
        expect(scanner.isDestroyed()).toBe(true);
      }
    });
  });

  describe('Input Immutability Invariants', () => {
    it('does not mutate caller options objects', async () => {
      const qrOpts = Object.freeze({
        width: 300,
        margin: 5,
        foregroundColor: '#000000',
        backgroundColor: '#ffffff',
        output: 'png' as const
      });
      // Object.freeze ensures that if internal code attempts to mutate, an error will be thrown in strict mode
      const png = await generateQrCode('immutable-test', qrOpts);
      expect(png).toBeDefined();

      const readOpts = Object.freeze({
        tryHarder: true
      });
      const result = await readQrCode(png, readOpts);
      expect(result?.text).toBe('immutable-test');
    });

    it('does not mutate caller input byte buffer', async () => {
      const qrPng = await generateQrCode('buffer-freeze-test', { output: 'png' });
      const copy = new Uint8Array(qrPng);

      await readQrCode(qrPng);

      // Verify original byte array is bit-for-bit identical
      expect(qrPng.length).toBe(copy.length);
      for (let i = 0; i < qrPng.length; i++) {
        expect(qrPng[i]).toBe(copy[i]);
      }
    });
  });
});
