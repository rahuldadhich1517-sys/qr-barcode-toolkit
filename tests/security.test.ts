import { describe, expect, it, vi } from 'vitest';
import {
  generateBarcode,
  generateQrCode,
  InvalidOptionsError,
  readQrCode
} from '../src/index.js';

describe('Security & Privacy Guarantees', () => {
  it('does not execute scripts or trigger URL navigation on malicious payloads', async () => {
    const maliciousPayload = '<script>window.__pwned = true;</script>';
    const pngBytes = await generateQrCode(maliciousPayload, { output: 'png' });

    // Ensure global is not polluted before decoding
    // @ts-expect-error test property
    delete globalThis.__pwned;

    const result = await readQrCode(pngBytes);
    expect(result?.text).toBe(maliciousPayload);

    // Assert script was NOT executed
    // @ts-expect-error test property
    expect(globalThis.__pwned).toBeUndefined();
  });

  it('safely serializes and escapes SVG markup without script injection', async () => {
    const xssPayload = '"><script>alert(1)</script>';
    const svg = await generateQrCode(xssPayload, { output: 'svg' });

    // The SVG must not contain unescaped raw <script> tag
    expect(svg).not.toContain('<script>alert(1)</script>');
  });

  it('rejects unreasonable dimensions to prevent memory exhaustion / DoS', async () => {
    await expect(
      generateQrCode('test', { width: 1_000_000 })
    ).rejects.toThrow(InvalidOptionsError);

    await expect(
      generateBarcode('test', { format: 'CODE_128', width: 1_000_000 })
    ).rejects.toThrow(InvalidOptionsError);

    await expect(
      generateBarcode('test', { format: 'CODE_128', scale: 100 })
    ).rejects.toThrow(InvalidOptionsError);
  });

  it('operates 100% offline without initiating any network requests', async () => {
    const originalFetch = globalThis.fetch;
    const fetchSpy = vi.fn();
    // @ts-expect-error mock fetch
    globalThis.fetch = fetchSpy;

    try {
      const png = await generateQrCode('Offline test', { output: 'png' });
      await readQrCode(png);

      const barcodePng = await generateBarcode('OFFLINE128', {
        format: 'CODE_128',
        output: 'png'
      });
      expect(barcodePng.length).toBeGreaterThan(0);

      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('does not log decoded text to console by default', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    try {
      const secret = 'TOP_SECRET_PASSPHRASE_12345';
      const pngBytes = await generateQrCode(secret, { output: 'png' });
      await readQrCode(pngBytes);

      for (const call of [...logSpy.mock.calls, ...infoSpy.mock.calls]) {
        for (const arg of call) {
          expect(String(arg)).not.toContain(secret);
        }
      }
    } finally {
      logSpy.mockRestore();
      infoSpy.mockRestore();
    }
  });
});
