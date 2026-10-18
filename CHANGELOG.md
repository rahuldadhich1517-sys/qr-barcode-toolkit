# Changelog

All notable changes to `@rahul_dadhich15/qr-barcode-toolkit` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-10-18

### Added
- **`qr-generator`**: `generateQrCode(text, options?)`
  - High-performance QR code generator supporting plain text, HTTPS URLs, Unicode, emoji, and multiline text.
  - Configurable error correction levels (`L`, `M`, `Q`, `H`).
  - Supports SVG markup, PNG byte buffer (`Uint8Array`), and PNG data URLs.
  - Safe color and dimension validations with bounds enforcement.
- **`qr-read`**: `readQrCode(input, options?)`
  - Decodes QR codes from still images without requiring camera access.
  - Cross-platform support for Node buffers (`Uint8Array`/`Buffer`), raw pixel data (`RawImageData`), and browser elements (`HTMLImageElement`, `HTMLCanvasElement`, `Blob`, `File`, `ImageBitmap`).
  - Cancellation via `AbortSignal` and configurable timeout via `timeoutMs`.
- **`qr-scanner`**: `createQrScanner(options)`
  - Continuous camera scanning with robust lifecycle state machine (`start`, `pause`, `resume`, `stop`, `destroy`).
  - Device and facing mode selection (`user` / `environment`).
  - Frame throttling via `scanIntervalMs` and duplicate detection suppression via `duplicateDelayMs`.
  - Automatic stream track cleanup on stop/destroy and camera disconnect handling.
- **`barcode-generator`**: `generateBarcode(data, options)`
  - Generates 1D and 2D barcode symbologies in SVG and PNG formats.
  - Verified symbologies: `CODE_128`, `CODE_39`, `CODE_93`, `EAN_8`, `EAN_13`, `UPC_A`, `UPC_E`, `ITF`, `CODABAR`, `QR_CODE`, `DATA_MATRIX`, `PDF_417`, `AZTEC`.
  - Format-specific content and checksum validation (EAN-13, EAN-8, UPC-A, ITF parity, Code 39 character set, Codabar format).
- **`barcode-scanner`**: `readBarcode(input, options?)` and `createBarcodeScanner(options)`
  - Decode still barcode images with optional symbology filtering.
  - Continuous live camera barcode scanning sharing the unified scanner lifecycle infrastructure.
- **Architectural & Security Features**:
  - Unified error taxonomy (`InvalidInputError`, `InvalidOptionsError`, `UnsupportedFormatError`, `PermissionDeniedError`, `CameraUnavailableError`, `BrowserApiUnsupportedError`, `ScannerDestroyedError`, `TimeoutError`).
  - Universal and browser-specific entrypoints (`@rahul_dadhich15/qr-barcode-toolkit` and `@rahul_dadhich15/qr-barcode-toolkit/browser`).
  - 100% offline processing with zero outbound telemetry or logging of scanned payloads.
  - Full TypeScript declaration files (.d.ts and .d.mts) with strict typing.
