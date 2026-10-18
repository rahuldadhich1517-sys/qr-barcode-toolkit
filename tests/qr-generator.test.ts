import { describe, expect, it } from 'vitest';
import { generateQrCode, InvalidInputError, InvalidOptionsError } from '../src/index.js';

describe('QR Generator (generateQrCode)', () => {
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

  it('supports Unicode, emoji, multiline, and special characters', async () => {
    const payload = 'Hello 🌍!\nLine 2: 🚀 & <special> "chars" 日本語';
    const svg = await generateQrCode(payload);
    expect(typeof svg).toBe('string');
    expect(svg).toContain('<svg');
  });

  it('generates PNG byte buffer when output is "png"', async () => {
    const pngBytes = await generateQrCode('PNG Test', { output: 'png' });
    expect(pngBytes).toBeInstanceOf(Uint8Array);
    expect(pngBytes.length).toBeGreaterThan(0);
    // Verify PNG header signature: 0x89, 'P', 'N', 'G'
    expect(pngBytes[0]).toBe(0x89);
    expect(pngBytes[1]).toBe(0x50);
    expect(pngBytes[2]).toBe(0x4e);
    expect(pngBytes[3]).toBe(0x47);
  });

  it('generates data URL when output is "data-url"', async () => {
    const dataUrl = await generateQrCode('Data URL Test', { output: 'data-url' });
    expect(typeof dataUrl).toBe('string');
    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('supports all error correction levels (L, M, Q, H)', async () => {
    for (const level of ['L', 'M', 'Q', 'H'] as const) {
      const svg = await generateQrCode('Level Test', { errorCorrectionLevel: level });
      expect(svg).toContain('<svg');
    }
  });

  it('supports custom dimensions and margin', async () => {
    const svg = await generateQrCode('Dimension Test', {
      width: 400,
      margin: 2
    });
    expect(typeof svg).toBe('string');
    expect(svg).toContain('<svg');
  });

  it('supports custom valid colors', async () => {
    const svg = await generateQrCode('Color Test', {
      foregroundColor: '#123456',
      backgroundColor: '#abcdef'
    });
    expect(typeof svg).toBe('string');
    expect(svg.toLowerCase()).toContain('#123456');
    expect(svg.toLowerCase()).toContain('#abcdef');
  });

  it('rejects null or undefined input', async () => {
    // @ts-expect-error testing runtime validation
    await expect(generateQrCode(null)).rejects.toThrow(InvalidInputError);
    // @ts-expect-error testing runtime validation
    await expect(generateQrCode(undefined)).rejects.toThrow(InvalidInputError);
  });

  it('rejects empty string input', async () => {
    await expect(generateQrCode('')).rejects.toThrow(InvalidInputError);
  });

  it('rejects input exceeding maximum QR capacity', async () => {
    const hugeText = 'A'.repeat(7090);
    await expect(generateQrCode(hugeText)).rejects.toThrow(InvalidInputError);
  });

  it('rejects invalid error correction level', async () => {
    // @ts-expect-error testing runtime validation
    await expect(generateQrCode('test', { errorCorrectionLevel: 'X' })).rejects.toThrow(
      InvalidOptionsError
    );
  });

  it('rejects invalid dimensions and margins', async () => {
    await expect(generateQrCode('test', { width: -10 })).rejects.toThrow(InvalidOptionsError);
    await expect(generateQrCode('test', { width: 0 })).rejects.toThrow(InvalidOptionsError);
    await expect(generateQrCode('test', { width: 100000 })).rejects.toThrow(InvalidOptionsError);
    await expect(generateQrCode('test', { margin: -1 })).rejects.toThrow(InvalidOptionsError);
    await expect(generateQrCode('test', { margin: 500 })).rejects.toThrow(InvalidOptionsError);
  });

  it('rejects invalid or unsafe colors', async () => {
    await expect(
      generateQrCode('test', { foregroundColor: 'invalid<script>' })
    ).rejects.toThrow(InvalidOptionsError);

    await expect(
      generateQrCode('test', { backgroundColor: 'javascript:alert(1)' })
    ).rejects.toThrow(InvalidOptionsError);
  });

  it('rejects unsupported output format', async () => {
    // @ts-expect-error testing runtime validation
    await expect(generateQrCode('test', { output: 'jpeg' })).rejects.toThrow(InvalidOptionsError);
  });
});
