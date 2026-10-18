export type ErrorCode =
  | 'INVALID_INPUT'
  | 'INVALID_OPTIONS'
  | 'UNSUPPORTED_FORMAT'
  | 'DECODE_ERROR'
  | 'PERMISSION_DENIED'
  | 'CAMERA_UNAVAILABLE'
  | 'BROWSER_API_UNSUPPORTED'
  | 'SCANNER_DESTROYED'
  | 'OPERATION_TIMEOUT'
  | 'INITIALIZATION_FAILED';

export class ToolkitError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(message: string, code: ErrorCode, details?: unknown) {
    super(message);
    this.name = 'ToolkitError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidInputError extends ToolkitError {
  constructor(message: string, details?: unknown) {
    super(message, 'INVALID_INPUT', details);
    this.name = 'InvalidInputError';
  }
}

export class InvalidOptionsError extends ToolkitError {
  constructor(message: string, details?: unknown) {
    super(message, 'INVALID_OPTIONS', details);
    this.name = 'InvalidOptionsError';
  }
}

export class UnsupportedFormatError extends ToolkitError {
  constructor(message: string, details?: unknown) {
    super(message, 'UNSUPPORTED_FORMAT', details);
    this.name = 'UnsupportedFormatError';
  }
}

export class DecodeError extends ToolkitError {
  constructor(message: string, details?: unknown) {
    super(message, 'DECODE_ERROR', details);
    this.name = 'DecodeError';
  }
}

export class PermissionDeniedError extends ToolkitError {
  constructor(message: string, details?: unknown) {
    super(message, 'PERMISSION_DENIED', details);
    this.name = 'PermissionDeniedError';
  }
}

export class CameraUnavailableError extends ToolkitError {
  constructor(message: string, details?: unknown) {
    super(message, 'CAMERA_UNAVAILABLE', details);
    this.name = 'CameraUnavailableError';
  }
}

export class BrowserApiUnsupportedError extends ToolkitError {
  constructor(message: string, details?: unknown) {
    super(message, 'BROWSER_API_UNSUPPORTED', details);
    this.name = 'BrowserApiUnsupportedError';
  }
}

export class ScannerDestroyedError extends ToolkitError {
  constructor(message: string = 'Scanner has been destroyed and cannot perform further operations', details?: unknown) {
    super(message, 'SCANNER_DESTROYED', details);
    this.name = 'ScannerDestroyedError';
  }
}

export class TimeoutError extends ToolkitError {
  constructor(message: string = 'Operation timed out', details?: unknown) {
    super(message, 'OPERATION_TIMEOUT', details);
    this.name = 'TimeoutError';
  }
}

export class InitializationError extends ToolkitError {
  constructor(message: string, details?: unknown) {
    super(message, 'INITIALIZATION_FAILED', details);
    this.name = 'InitializationError';
  }
}
