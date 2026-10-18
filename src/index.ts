// Public Error Classes and Types
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
} from './internal/errors/index.js';

// Public Validation and Format Constants
export {
  type BarcodeFormat,
  SUPPORTED_BARCODE_FORMATS,
  DECODABLE_BARCODE_FORMATS,
  validateBarcodeFormat,
  validateBarcodeData,
  calculateEanUpcChecksum
} from './internal/validation/index.js';

// Image Input Types
export {
  type RawImageData,
  type SupportedImageInput,
  isRawImageData,
  parseImageInput
} from './internal/image-input/index.js';

// Scanner Lifecycle Types
export {
  type ScannerState,
  type BaseScanner
} from './internal/scanner-lifecycle/index.js';

// Utility 1: QR Reader
export {
  readQrCode,
  type QrReadResult,
  type QrReaderOptions
} from './qr-read/index.js';

// Utility 2: QR Generator
export {
  generateQrCode,
  type QrGeneratorOptions,
  type QrErrorCorrectionLevel,
  type QrOutputFormat
} from './qr-generator/index.js';

// Utility 3: QR Scanner
export {
  createQrScanner,
  type QrScanner,
  type QrScannerOptions,
  type QrScannerCameraOptions
} from './qr-scanner/index.js';

// Utility 4: Barcode Generator
export {
  generateBarcode,
  type BarcodeGeneratorOptions,
  type BarcodeOutputFormat
} from './barcode-generator/index.js';

// Utility 5: Barcode Scanner
export {
  readBarcode,
  createBarcodeScanner,
  type BarcodeScanner,
  type BarcodeReaderOptions,
  type BarcodeScannerOptions,
  type BarcodeReadResult
} from './barcode-scanner/index.js';
