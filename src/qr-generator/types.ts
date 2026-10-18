export type QrErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

export type QrOutputFormat = 'svg' | 'png' | 'data-url';

export interface QrGeneratorOptions {
  /**
   * Error correction level.
   * L: ~7% recovery
   * M: ~15% recovery (default)
   * Q: ~25% recovery
   * H: ~30% recovery
   */
  errorCorrectionLevel?: QrErrorCorrectionLevel;

  /**
   * Width/height in pixels of the output QR code.
   * Must be between 16 and 10000.
   */
  width?: number;

  /**
   * Margin around the QR code in modules.
   * Default is 4.
   */
  margin?: number;

  /**
   * Foreground color (e.g. "#000000").
   * Default is "#000000".
   */
  foregroundColor?: string;

  /**
   * Background color (e.g. "#ffffff").
   * Default is "#ffffff".
   */
  backgroundColor?: string;

  /**
   * Desired output format: 'svg' | 'png' | 'data-url'.
   * Default is 'svg'.
   */
  output?: QrOutputFormat;
}
