import { describe, expect, it } from 'vitest';
import * as BrowserEntry from '../src/browser/index.js';
import * as UniversalEntry from '../src/index.js';

describe('Browser Entrypoint (src/browser/index.ts)', () => {
  it('exports all utilities, functions, and error classes matching universal entrypoint', () => {
    expect(typeof BrowserEntry.generateQrCode).toBe('function');
    expect(typeof BrowserEntry.readQrCode).toBe('function');
    expect(typeof BrowserEntry.createQrScanner).toBe('function');
    expect(typeof BrowserEntry.generateBarcode).toBe('function');
    expect(typeof BrowserEntry.readBarcode).toBe('function');
    expect(typeof BrowserEntry.createBarcodeScanner).toBe('function');

    expect(BrowserEntry.SUPPORTED_BARCODE_FORMATS).toEqual(UniversalEntry.SUPPORTED_BARCODE_FORMATS);
    expect(BrowserEntry.DECODABLE_BARCODE_FORMATS).toEqual(UniversalEntry.DECODABLE_BARCODE_FORMATS);

    expect(BrowserEntry.ToolkitError).toBeDefined();
    expect(BrowserEntry.InvalidInputError).toBeDefined();
    expect(BrowserEntry.InvalidOptionsError).toBeDefined();
    expect(BrowserEntry.UnsupportedFormatError).toBeDefined();
    expect(BrowserEntry.PermissionDeniedError).toBeDefined();
    expect(BrowserEntry.CameraUnavailableError).toBeDefined();
    expect(BrowserEntry.BrowserApiUnsupportedError).toBeDefined();
    expect(BrowserEntry.ScannerDestroyedError).toBeDefined();
    expect(BrowserEntry.TimeoutError).toBeDefined();
    expect(BrowserEntry.InitializationError).toBeDefined();
  });
});
