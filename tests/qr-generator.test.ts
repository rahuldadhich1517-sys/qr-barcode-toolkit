import { describe, expect, it } from 'vitest';
import { generateQrCode, InvalidInputError, InvalidOptionsError, readQrCode } from '../src/index.js';

describe('QR Generator (generateQrCode)', () => {
  describe('Phase 3.A: Input Scenarios', () => {
    it('generates valid SVG output for plain text by default', async () => {
      const svg = await generateQrCode('Hello, World!');
      expect(typeof svg).toBe('string');
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
    });

    it('generates valid SVG output for HTTPS URLs', async () => {
      const url = 'https://github.com/rahuldadhich1517-sys/qr-barcode-toolkit';
      const svg = await generateQrCode(url);
      expect(typeof svg).toBe('string');
      expect(svg).toContain('<svg');
    });

    it('generates valid SVG output for HTTP URLs with query parameters and anchors', async () => {
      const url = 'http://example.com/api/v1/search?q=optical+scan&filter=qr%20code&page=2#results';
      const svg = await generateQrCode(url);
      expect(typeof svg).toBe('string');
      expect(svg).toContain('<svg');
    });

    it('supports Unicode, emoji, multiline, tabs, and special characters', async () => {
      const payload = "Tabs:\tSpaces:   \nQuotes: 'single' & \"double\"\nAmpersand: & <angle> 🚀 🌍\nJapanese: 日本語\nCyrillic: Привет\nArabic: مرحبا\nDevanagari: नमस्ते\nChinese: 你好";
      const svg = await generateQrCode(payload);
      expect(typeof svg).toBe('string');
      expect(svg).toContain('<svg');
    });

    it('supports JSON payload as string', async () => {
      const jsonPayload = JSON.stringify({
        id: 'txn-998811',
        amount: 250.75,
        currency: 'USD',
        tags: ['pos', 'checkout']
      });
      const svg = await generateQrCode(jsonPayload);
      expect(svg).toContain('<svg');
    });

    it('treats shell commands and JavaScript snippets as plain data without execution', async () => {
      const shellPayload = 'rm -rf /; echo $HOME && cat /etc/passwd';
      const jsPayload = '<script>document.cookie="stolen"; alert(1);</script>';

      const svg1 = await generateQrCode(shellPayload);
      const svg2 = await generateQrCode(jsPayload);

      expect(svg1).toContain('<svg');
      expect(svg2).toContain('<svg');
      // Must not contain an unescaped literal executable script tag
      expect(svg2).not.toContain('<script>document.cookie');
    });

    it('supports whitespace-only string as valid data', async () => {
      const svg = await generateQrCode('   \t\n   ');
      expect(svg).toContain('<svg');
    });
  });

  describe('Phase 3.B: Error Correction Levels', () => {
    it('supports all error correction levels (L, M, Q, H)', async () => {
      for (const level of ['L', 'M', 'Q', 'H'] as const) {
        const svg = await generateQrCode('Level Test', { errorCorrectionLevel: level });
        expect(svg).toContain('<svg');
      }
    });

    it('rejects invalid error correction level with InvalidOptionsError', async () => {
      // @ts-expect-error testing runtime validation
      await expect(generateQrCode('test', { errorCorrectionLevel: 'X' })).rejects.toThrow(
        InvalidOptionsError
      );
      // @ts-expect-error testing runtime validation
      await expect(generateQrCode('test', { errorCorrectionLevel: 'low' })).rejects.toThrow(
        InvalidOptionsError
      );
    });
  });

  describe('Phase 3.C: Dimensions and Layout Boundaries', () => {
    it('accepts minimum width boundary of 16', async () => {
      const svg = await generateQrCode('Min Width', { width: 16 });
      expect(svg).toContain('<svg');
    });

    it('accepts maximum width boundary of 10000', async () => {
      const svg = await generateQrCode('Max Width', { width: 10000 });
      expect(svg).toContain('<svg');
    });

    it('rejects width values immediately outside acceptable range (15 and 10001)', async () => {
      await expect(generateQrCode('test', { width: 15 })).rejects.toThrow(InvalidOptionsError);
      await expect(generateQrCode('test', { width: 10001 })).rejects.toThrow(InvalidOptionsError);
    });

    it('rejects zero and negative widths', async () => {
      await expect(generateQrCode('test', { width: 0 })).rejects.toThrow(InvalidOptionsError);
      await expect(generateQrCode('test', { width: -50 })).rejects.toThrow(InvalidOptionsError);
    });

    it('rejects non-integer fractional dimensions', async () => {
      await expect(generateQrCode('test', { width: 250.5 })).rejects.toThrow(InvalidOptionsError);
    });

    it('accepts margin boundaries (0 and 100)', async () => {
      const svg0 = await generateQrCode('Margin 0', { margin: 0 });
      expect(svg0).toContain('<svg');

      const svg100 = await generateQrCode('Margin 100', { margin: 100 });
      expect(svg100).toContain('<svg');
    });

    it('rejects negative and excessively large margins (-1 and 101)', async () => {
      await expect(generateQrCode('test', { margin: -1 })).rejects.toThrow(InvalidOptionsError);
      await expect(generateQrCode('test', { margin: 101 })).rejects.toThrow(InvalidOptionsError);
    });
  });

  describe('Phase 3.D: Color Configurations', () => {
    it('supports 3-character hex, 6-character hex, and 8-character hex colors', async () => {
      const svg3 = await generateQrCode('Hex3', { foregroundColor: '#000', backgroundColor: '#fff' });
      expect(svg3).toContain('<svg');

      const svg6 = await generateQrCode('Hex6', { foregroundColor: '#112233', backgroundColor: '#aabbcc' });
      expect(svg6).toContain('<svg');

      const svg8 = await generateQrCode('Hex8', { foregroundColor: '#112233ff', backgroundColor: '#aabbccdd' });
      expect(svg8).toContain('<svg');
    });

    it('supports named colors and rgb/rgba formats', async () => {
      const svgNamed = await generateQrCode('Named', { foregroundColor: 'black', backgroundColor: 'white' });
      expect(svgNamed).toContain('<svg');

      const svgRgb = await generateQrCode('Rgb', { foregroundColor: 'rgb(0, 0, 0)', backgroundColor: 'rgb(255, 255, 255)' });
      expect(svgRgb).toContain('<svg');

      const svgRgba = await generateQrCode('Rgba', { foregroundColor: 'rgba(0, 0, 0, 1)', backgroundColor: 'rgba(255, 255, 255, 1)' });
      expect(svgRgba).toContain('<svg');
    });

    it('rejects empty or whitespace-only color strings', async () => {
      await expect(generateQrCode('test', { foregroundColor: '' })).rejects.toThrow(InvalidOptionsError);
      await expect(generateQrCode('test', { backgroundColor: '   ' })).rejects.toThrow(InvalidOptionsError);
    });

    it('rejects invalid or unsafe colors', async () => {
      await expect(generateQrCode('test', { foregroundColor: 'invalid<script>' })).rejects.toThrow(InvalidOptionsError);
      await expect(generateQrCode('test', { backgroundColor: 'javascript:alert(1)' })).rejects.toThrow(InvalidOptionsError);
      await expect(generateQrCode('test', { foregroundColor: 'url(http://evil.com)' })).rejects.toThrow(InvalidOptionsError);
      // @ts-expect-error non-string color
      await expect(generateQrCode('test', { foregroundColor: 12345 })).rejects.toThrow(InvalidOptionsError);
    });
  });

  describe('Phase 3.E: Output Correctness and Formats', () => {
    it('generates PNG byte buffer when output is "png"', async () => {
      const pngBytes = await generateQrCode('PNG Test', { output: 'png' });
      expect(pngBytes).toBeInstanceOf(Uint8Array);
      expect(pngBytes.length).toBeGreaterThan(0);
      // Verify PNG header signature: 0x89, 'P', 'N', 'G'
      expect(pngBytes[0]).toBe(0x89);
      expect(pngBytes[1]).toBe(0x50);
      expect(pngBytes[2]).toBe(0x4e);
      expect(pngBytes[3]).toBe(0x47);

      // Verify real decoder can read it
      const decoded = await readQrCode(pngBytes);
      expect(decoded?.text).toBe('PNG Test');
    });

    it('generates data URL when output is "data-url" and it can be decoded', async () => {
      const dataUrl = await generateQrCode('Data URL Test', { output: 'data-url' });
      expect(typeof dataUrl).toBe('string');
      expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);

      const base64Data = dataUrl.replace('data:image/png;base64,', '');
      const buffer = Buffer.from(base64Data, 'base64');
      const decoded = await readQrCode(buffer);
      expect(decoded?.text).toBe('Data URL Test');
    });

    it('rejects unsupported output format', async () => {
      // @ts-expect-error testing runtime validation
      await expect(generateQrCode('test', { output: 'jpeg' })).rejects.toThrow(InvalidOptionsError);
      // @ts-expect-error testing runtime validation
      await expect(generateQrCode('test', { output: 'webp' })).rejects.toThrow(InvalidOptionsError);
    });
  });

  describe('Phase 3.F: Invalid and Oversized Inputs', () => {
    it('rejects null or undefined input with InvalidInputError', async () => {
      // @ts-expect-error testing runtime validation
      await expect(generateQrCode(null)).rejects.toThrow(InvalidInputError);
      // @ts-expect-error testing runtime validation
      await expect(generateQrCode(undefined)).rejects.toThrow(InvalidInputError);
    });

    it('rejects non-string runtime inputs', async () => {
      // @ts-expect-error testing runtime validation
      await expect(generateQrCode(12345)).rejects.toThrow(InvalidInputError);
      // @ts-expect-error testing runtime validation
      await expect(generateQrCode({})).rejects.toThrow(InvalidInputError);
      // @ts-expect-error testing runtime validation
      await expect(generateQrCode(true)).rejects.toThrow(InvalidInputError);
    });

    it('rejects empty string input', async () => {
      await expect(generateQrCode('')).rejects.toThrow(InvalidInputError);
    });

    it('rejects input exceeding maximum QR capacity limit (7089 characters)', async () => {
      const hugeText = 'A'.repeat(7090);
      await expect(generateQrCode(hugeText)).rejects.toThrow(InvalidInputError);
    });

    it('rejects data that exceeds QR capacity for a high error correction level', async () => {
      // Capacity for H level is ~1273 bytes for binary or ~1800 alphanumeric
      const largePayload = 'A'.repeat(2500);
      await expect(
        generateQrCode(largePayload, { errorCorrectionLevel: 'H' })
      ).rejects.toThrow(InvalidInputError);
    });
  });
});
