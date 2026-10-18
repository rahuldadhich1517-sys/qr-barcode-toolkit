# @rahul_dadhich15/qr-barcode-toolkit

A modern, production-ready TypeScript toolkit for QR code generation, still-image QR decoding, continuous camera QR scanning, 1D/2D barcode generation, and live barcode scanning across Browser and Node.js environments.

[![CI](https://github.com/rahuldadhich1517-sys/qr-barcode-toolkit/actions/workflows/ci.yml/badge.svg)](https://github.com/rahuldadhich1517-sys/qr-barcode-toolkit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org/)
[![Node.js Version](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-green.svg)](https://nodejs.org/)

---

## Table of Contents

- [1. Overview](#1-overview)
- [2. Features](#2-features)
- [3. Installation](#3-installation)
- [4. Environment Compatibility](#4-environment-compatibility)
- [5. Quick Start](#5-quick-start)
- [6. QR Code Generation (`qr-generator`)](#6-qr-code-generation-qr-generator)
- [7. QR Image Decoding (`qr-read`)](#7-qr-image-decoding-qr-read)
- [8. Live QR Scanning (`qr-scanner`)](#8-live-qr-scanning-qr-scanner)
- [9. Barcode Generation (`barcode-generator`)](#9-barcode-generation-barcode-generator)
- [10. Barcode Scanning (`barcode-scanner`)](#10-barcode-scanning-barcode-scanner)
- [11. Verified Supported Symbologies](#11-verified-supported-symbologies)
- [12. Supported Output Formats](#12-supported-output-formats)
- [13. Configuration Options](#13-configuration-options)
- [14. Scanner Lifecycle and Cleanup](#14-scanner-lifecycle-and-cleanup)
- [15. Camera Permissions & HTTPS Requirements](#15-camera-permissions--https-requirements)
- [16. Security and Privacy](#16-security-and-privacy)
- [17. Error Handling & Taxonomy](#17-error-handling--taxonomy)
- [18. TypeScript Examples](#18-typescript-examples)
- [19. API Reference](#19-api-reference)
- [20. Supported Node & Browser APIs](#20-supported-node--browser-apis)
- [21. Known Limitations](#21-known-limitations)
- [22. Development and Testing](#22-development-and-testing)
- [23. Building and Verifying](#23-building-and-verifying)
- [24. Contributing](#24-contributing)
- [25. License and Changelog](#25-license-and-changelog)

---

## 1. Overview

`@rahul_dadhich15/qr-barcode-toolkit` provides five modular, strongly typed utilities for handling optical codes. Designed with strict security boundaries, robust lifecycle resource management, and unified decoding architecture, it bridges the gap between browser media hardware and server-side byte processing.

---

## 2. Features

- **Five Focused Utilities**: Separate, clear entry points for `qr-generator`, `qr-read`, `qr-scanner`, `barcode-generator`, and `barcode-scanner`.
- **Shared Architecture**: Unified internal decoding and lifecycle control to eliminate redundant code paths.
- **Universal & Browser Endpoints**: Zero-cost universal import that avoids touching browser DOM globals during initialization, alongside a dedicated browser entrypoint.
- **Robust Lifecycle Control**: Finite state machine (`idle` → `starting` → `scanning` → `paused` → `stopped` → `destroyed`) guaranteeing track disposal and event listener teardown.
- **Strict TypeScript & Declarations**: Full `.d.ts` and `.d.mts` support with compile-time return type inference based on requested output format.
- **100% Offline & Private**: Zero remote telemetry, zero automatic image uploads, and never logs decoded payloads by default.

---

## 3. Installation

```bash
npm install @rahul_dadhich15/qr-barcode-toolkit
```

Or using pnpm / yarn:

```bash
pnpm add @rahul_dadhich15/qr-barcode-toolkit
# or
yarn add @rahul_dadhich15/qr-barcode-toolkit
```

---

## 4. Environment Compatibility

| Environment | Generation (SVG/PNG) | Image Decoding | Camera Live Scanning |
| :--- | :---: | :---: | :---: |
| **Node.js (>= 18)** | ✅ | ✅ (PNG Buffer, `RawImageData`) | ❌ *(Throws `BrowserApiUnsupportedError`)* |
| **Modern Browsers** | ✅ | ✅ (`Canvas`, `Blob`, `File`, `ImageBitmap`) | ✅ (`MediaDevices` / `getUserMedia`) |
| **Web Workers** | ✅ | ✅ (`OffscreenCanvas`, `Uint8Array`) | ❌ *(Direct camera requires DOM/Window)* |

---

## 5. Quick Start

### Universal / Node.js Quick Start

```ts
import { generateQrCode, readQrCode, generateBarcode, readBarcode } from '@rahul_dadhich15/qr-barcode-toolkit';

// 1. Generate QR Code
const qrPng = await generateQrCode('https://example.com', { output: 'png' });

// 2. Decode QR Code from bytes
const qrResult = await readQrCode(qrPng);
console.log(qrResult?.text); // "https://example.com"

// 3. Generate Code 128 Barcode
const barcodeSvg = await generateBarcode('PACKAGE-9901', {
  format: 'CODE_128',
  output: 'svg'
});
```

### Browser Camera Quick Start

```ts
import { createQrScanner } from '@rahul_dadhich15/qr-barcode-toolkit/browser';

const scanner = createQrScanner({
  video: document.querySelector<HTMLVideoElement>('#preview')!,
  onScan: (result) => {
    console.log('Decoded QR payload:', result.text);
  },
  onError: (err) => {
    console.error('Scan error:', err);
  }
});

// Explicit caller-initiated start
await scanner.start();
```

---

## 6. QR Code Generation (`qr-generator`)

Function signature:
```ts
generateQrCode(text: string, options?: QrGeneratorOptions): Promise<string | Uint8Array>
```

Output formats supported:
- `'svg'` (default): Returns SVG XML markup string.
- `'png'`: Returns `Uint8Array` containing raw PNG bytes.
- `'data-url'`: Returns base64 data URL (`data:image/png;base64,...`).

```ts
// SVG Generation
const svg = await generateQrCode('Hello World', {
  output: 'svg',
  errorCorrectionLevel: 'H',
  width: 300,
  margin: 4,
  foregroundColor: '#003366',
  backgroundColor: '#ffffff'
});

// PNG Buffer Generation
const pngBytes = await generateQrCode('Secure Token', {
  output: 'png',
  width: 400
});
```

---

## 7. QR Image Decoding (`qr-read`)

Function signature:
```ts
readQrCode(input: SupportedImageInput, options?: QrReaderOptions): Promise<QrReadResult | null>
```

Supported inputs:
- Node: `Buffer`, `Uint8Array` (PNG bytes), `RawImageData` (`{ data, width, height }`).
- Browser: `Blob`, `File`, `HTMLCanvasElement`, `HTMLImageElement`, `ImageBitmap`, `HTMLVideoElement`.

```ts
const result = await readQrCode(imageBuffer, {
  tryHarder: true,
  timeoutMs: 5000
});

if (result) {
  console.log('Text:', result.text);
  console.log('Format:', result.format); // 'QR_CODE'
  console.log('Corner Points:', result.resultPoints);
} else {
  console.log('No QR code detected in image.');
}
```

---

## 8. Live QR Scanning (`qr-scanner`)

Function signature:
```ts
createQrScanner(options: QrScannerOptions): QrScanner
```

Manages continuous QR scanning from a browser camera or video element.

```ts
const scanner = createQrScanner({
  video: videoElement,
  camera: { facingMode: 'environment' },
  scanIntervalMs: 120,      // Scan every 120ms
  duplicateDelayMs: 2000,   // Throttle repeated reads of the same QR
  onScan: (res) => alert(`Found: ${res.text}`),
  onError: (err) => console.error(err)
});

await scanner.start();

// Lifecycle controls
scanner.pause();
scanner.resume();
await scanner.stop();
scanner.destroy();
```

---

## 9. Barcode Generation (`barcode-generator`)

Function signature:
```ts
generateBarcode(data: string, options: BarcodeGeneratorOptions): Promise<string | Uint8Array>
```

Generates 1D and 2D barcode formats with format-specific data and checksum validation.

```ts
// Generate EAN-13 (12 or 13 digits)
const ean13Svg = await generateBarcode('9780201379624', {
  format: 'EAN_13',
  output: 'svg',
  displayValue: true
});

// Generate Data Matrix PNG
const dmPng = await generateBarcode('MATRIX-SERIAL-10029', {
  format: 'DATA_MATRIX',
  output: 'png',
  scale: 4
});
```

---

## 10. Barcode Scanning (`barcode-scanner`)

Public functions:
```ts
readBarcode(input: SupportedImageInput, options?: BarcodeReaderOptions): Promise<BarcodeReadResult | null>
createBarcodeScanner(options: BarcodeScannerOptions): BarcodeScanner
```

Decode still images or attach continuous scanning for all verified symbologies or a specified subset:

```ts
// Still image decode
const barcode = await readBarcode(imageFile, {
  formats: ['CODE_128', 'EAN_13']
});

// Live camera barcode scanner
const scanner = createBarcodeScanner({
  formats: ['CODE_128', 'CODE_39', 'EAN_13', 'UPC_A'],
  onScan: (result) => {
    console.log(`Detected ${result.format}: ${result.text}`);
  }
});
await scanner.start();
```

---

## 11. Verified Supported Symbologies

Every supported format has undergone end-to-end round-trip generation and decoding tests:

| Format Code | Symbology Type | Generation Supported | Still & Live Decoding | Round-Trip Verified |
| :--- | :--- | :---: | :---: | :---: |
| `CODE_128` | 1D Barcode | ✅ | ✅ | ✅ |
| `CODE_39` | 1D Barcode | ✅ | ✅ | ✅ |
| `CODE_93` | 1D Barcode | ✅ | ✅ | ✅ |
| `EAN_8` | 1D Barcode (8 digits) | ✅ | ✅ | ✅ |
| `EAN_13` | 1D Barcode (13 digits) | ✅ | ✅ | ✅ |
| `UPC_A` | 1D Barcode (12 digits) | ✅ | ✅ | ✅ |
| `ITF` | 1D Interleaved 2 of 5 | ✅ | ✅ | ✅ |
| `CODABAR` | 1D Barcode | ✅ | ✅ | ✅ |
| `QR_CODE` | 2D Matrix | ✅ | ✅ | ✅ |
| `DATA_MATRIX` | 2D Matrix | ✅ | ✅ | ✅ |
| `PDF_417` | 2D Stacked Barcode | ✅ | ✅ | ✅ |
| `AZTEC` | 2D Matrix | ✅ | ✅ | ✅ |
| `UPC_E` | 1D Barcode | ✅ | ⚠️ *(See Limitations)* | ❌ *(Upstream ZXing decoder defect)* |

---

## 12. Supported Output Formats

- **`svg`**: Vector output, sharp at any scale. Fully sanitized against SVG markup injection.
- **`png`**: Binary bytes (`Uint8Array`) containing lossless PNG image data.
- **`data-url`** *(QR Generator)*: Base64 URI suitable for direct binding to `<img src="...">`.

---

## 13. Configuration Options

### `QrGeneratorOptions`
- `errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'` (Default: `'M'`)
- `width?: number` (Between 16 and 10,000)
- `margin?: number` (Quiet zone in modules, 0 to 100, default: 4)
- `foregroundColor?: string` (Hex or CSS color, default: `'#000000'`)
- `backgroundColor?: string` (Hex or CSS color, default: `'#ffffff'`)
- `output?: 'svg' | 'png' | 'data-url'` (Default: `'svg'`)

### `BarcodeGeneratorOptions`
- `format: BarcodeFormat` *(Required)*
- `output?: 'svg' | 'png'` (Default: `'svg'`)
- `scale?: number` (Integer 1 to 20, default: 2)
- `margin?: number` (Quiet zone padding, default: 10)
- `height?: number` (Height in mm/units)
- `width?: number` (Width in mm/units)
- `displayValue?: boolean` (Render human-readable text under barcode, default: false)
- `foregroundColor?: string` (Default: `'#000000'`)
- `backgroundColor?: string` (Default: `'#ffffff'`)

### `QrScannerOptions` / `BarcodeScannerOptions`
- `video?: HTMLVideoElement` (Optional DOM video element)
- `camera?: { deviceId?: string; facingMode?: 'user' | 'environment' }`
- `scanIntervalMs?: number` (Throttle interval between frame decodes, default: 150ms)
- `duplicateDelayMs?: number` (Window to suppress repeated detections of same text, default: 1000ms)
- `onScan: (result: QrReadResult | BarcodeReadResult) => void` *(Required)*
- `onError?: (error: Error) => void`

---

## 14. Scanner Lifecycle and Cleanup

The scanner controller follows an explicit finite state machine:

```
[idle] ──start()──► [starting] ──► [scanning]
                          │             │  ▲
                          │     pause() │  │ resume()
                          │             ▼  │
                          ▼          [paused]
                      [stopped] ◄──stop()──┘
                          │
                      destroy()
                          │
                          ▼
                     [destroyed]
```

### Resource Cleanup Guarantees:
- **Media Tracks**: Every active `MediaStreamTrack` has `.stop()` called immediately upon `stop()` or `destroy()`.
- **Event Listeners**: Internal listeners on `video` elements and stream tracks are unbound.
- **Timers & Animation Frames**: Active scheduling frames and loops are cancelled.
- **DOM Elements**: If an internal video element was instantiated, it is detached from the DOM upon destruction.
- **Destroy Guards**: Invoking operations on a destroyed scanner reliably throws `ScannerDestroyedError`.

---

## 15. Camera Permissions & HTTPS Requirements

- **Browser Security Context**: Browser camera access via `navigator.mediaDevices.getUserMedia` requires a Secure Context (`https://` or `localhost`).
- **User Permission**: Never requested upon library import. Permission prompt is triggered exclusively when `scanner.start()` is invoked.
- **Rejection & Error Handling**: Permission denial is mapped directly to `PermissionDeniedError` instead of generic errors.

---

## 16. Security and Privacy

1. **Local Processing Only**: All generation and decoding occurs entirely in-memory on the client or server. No frames or strings are ever sent over network connections.
2. **Untrusted Data Policy**: Decoded barcode content is strictly treated as untrusted text. The library never executes `eval()`, never performs automatic navigation, and never performs background HTTP requests on parsed URLs.
3. **No Default Logging**: Decoded payloads and raw frames are never printed to `console.log` or telemetry channels.
4. **SVG Sanitization**: Color values and input options undergo strict validation to prevent SVG injection and cross-site scripting (XSS).
5. **Memory Bomb Safeguards**: Dimensions are capped (maximum 10,000px) to prevent algorithmic complexity and out-of-memory DoS attacks.

---

## 17. Error Handling & Taxonomy

All package errors derive from `ToolkitError`:

```ts
import {
  ToolkitError,
  InvalidInputError,
  InvalidOptionsError,
  UnsupportedFormatError,
  DecodeError,
  PermissionDeniedError,
  CameraUnavailableError,
  BrowserApiUnsupportedError,
  ScannerDestroyedError,
  TimeoutError
} from '@rahul_dadhich15/qr-barcode-toolkit';

try {
  await readBarcode(invalidBuffer);
} catch (err) {
  if (err instanceof InvalidInputError) {
    console.error('Invalid image buffer:', err.message);
  } else if (err instanceof TimeoutError) {
    console.error('Decode timed out');
  }
}
```

| Error Class | Code | Cause |
| :--- | :--- | :--- |
| `InvalidInputError` | `INVALID_INPUT` | Empty/malformed data, bad check digits, invalid bytes |
| `InvalidOptionsError` | `INVALID_OPTIONS` | Unsafe colors, out-of-range dimensions |
| `UnsupportedFormatError` | `UNSUPPORTED_FORMAT` | Format not in supported list |
| `PermissionDeniedError` | `PERMISSION_DENIED` | Camera permission rejected by user/OS |
| `CameraUnavailableError` | `CAMERA_UNAVAILABLE` | Camera device not found or already in use |
| `BrowserApiUnsupportedError` | `BROWSER_API_UNSUPPORTED` | Calling camera APIs in Node.js or unsupported browser |
| `ScannerDestroyedError` | `SCANNER_DESTROYED` | Attempting to operate on a destroyed scanner |
| `TimeoutError` | `OPERATION_TIMEOUT` | Operation exceeded `timeoutMs` or was aborted |

---

## 18. TypeScript Examples

### Strict Type Inference with Output Overloads
```ts
// Compiler infers string
const svgOutput = await generateQrCode('Test', { output: 'svg' });

// Compiler infers Uint8Array
const pngOutput = await generateQrCode('Test', { output: 'png' });

// Compiler infers string
const dataUrl = await generateQrCode('Test', { output: 'data-url' });
```

---

## 19. API Reference

### Core Exports
- `generateQrCode(text, options?)`
- `readQrCode(input, options?)`
- `createQrScanner(options)`
- `generateBarcode(data, options)`
- `readBarcode(input, options?)`
- `createBarcodeScanner(options)`
- `calculateEanUpcChecksum(digits)`
- `validateBarcodeFormat(format)`
- `validateBarcodeData(format, data)`
- `SUPPORTED_BARCODE_FORMATS`
- `DECODABLE_BARCODE_FORMATS`

---

## 20. Supported Node & Browser APIs

- **Node.js**: `Buffer`, `Uint8Array`, `ArrayBuffer`, synchronous PNG extraction via `pngjs`.
- **Browser**: `HTMLCanvasElement`, `OffscreenCanvas`, `ImageData`, `ImageBitmap`, `HTMLImageElement`, `HTMLVideoElement`, `Blob`, `File`, `navigator.mediaDevices.getUserMedia`.

---

## 21. Known Limitations

1. **UPC-E Decoding**: UPC-E generation is supported via `generateBarcode()`. However, UPC-E decoding is currently unavailable due to an upstream issue in `@zxing/library`'s `UPCEReader` implementation. Other formats (`UPC_A`, `EAN_13`, `EAN_8`, `CODE_128`, etc.) are fully verified for round-trip decoding.
2. **Camera Hardware in CI / Headless**: Camera scanning requires physical hardware or synthetic browser media streams. Automated unit tests mock media stream tracks for predictable CI execution.

---

## 22. Development and Testing

```bash
# Clone the repository
git clone https://github.com/rahuldadhich1517-sys/qr-barcode-toolkit.git

# Install dependencies
npm install

# Run TypeScript typecheck
npm run typecheck

# Run test suite
npm run test:run

# Run test coverage
npm run test:coverage
```

---

## 23. Building and Verifying

```bash
# Build CommonJS, ESM, and TypeScript declarations
npm run build

# Verify packaging contents
npm pack --dry-run
```

---

## 24. Contributing

Contributions are welcome! Please open an issue or pull request on GitHub:
https://github.com/rahuldadhich1517-sys/qr-barcode-toolkit

---

## 25. License and Changelog

- **License**: [MIT](LICENSE) © 2026 Rahul Dadhich
- **Changelog**: See [CHANGELOG.md](CHANGELOG.md) for version release notes.