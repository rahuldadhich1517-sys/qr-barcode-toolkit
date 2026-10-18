// Browser-specialized entrypoint
export {
  ToolkitError,
  InvalidInputError,
  InvalidOptionsError,
  UnsupportedFormatError,
  DecodeError,
  PermissionDeniedError,
  CameraUnavailableError,
  BrowserApiUnsupportedError,
  ScannerDestroyedError,
  TimeoutError,
  InitializationError,
  type ErrorCode
} from '../internal/errors/index.js';

export {
  type BarcodeFormat,
  SUPPORTED_BARCODE_FORMATS,
  DECODABLE_BARCODE_FORMATS,
  validateBarcodeFormat,
  validateBarcodeData,
  calculateEanUpcChecksum
} from '../internal/validation/index.js';

export {
  type RawImageData,
  type SupportedImageInput,
  isRawImageData,
  parseImageInput
} from '../internal/image-input/index.js';

export {
  type ScannerState,
  type BaseScanner
} from '../internal/scanner-lifecycle/index.js';

export {
  readQrCode,
  type QrReadResult,
  type QrReaderOptions
} from '../qr-read/index.js';

export {
  generateQrCode,
  type QrGeneratorOptions,
  type QrErrorCorrectionLevel,
  type QrOutputFormat
} from '../qr-generator/index.js';

export {
  createQrScanner,
  type QrScanner,
  type QrScannerOptions,
  type QrScannerCameraOptions
} from '../qr-scanner/index.js';

export {
  generateBarcode,
  type BarcodeGeneratorOptions,
  type BarcodeOutputFormat
} from '../barcode-generator/index.js';

export {
  readBarcode,
  createBarcodeScanner,
  type BarcodeScanner,
  type BarcodeReaderOptions,
  type BarcodeScannerOptions,
  type BarcodeReadResult
} from '../barcode-scanner/index.js';
