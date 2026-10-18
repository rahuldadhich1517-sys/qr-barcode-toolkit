import type { BarcodeFormat } from '../internal/validation/index.js';

export type { BarcodeFormat };

export type BarcodeOutputFormat = 'svg' | 'png';

export interface BarcodeGeneratorOptions {
  /**
   * Symbology to generate.
   */
  format: BarcodeFormat;

  /**
   * Barcode width in pixels / units (optional).
   */
  width?: number;

  /**
   * Barcode height in mm / pixels (optional).
   */
  height?: number;

  /**
   * Scaling factor (e.g. 1, 2, 3). Default is 2.
   */
  scale?: number;

  /**
   * Margin / quiet zone padding around the barcode. Default is 10.
   */
  margin?: number;

  /**
   * Foreground / bar color (e.g. "#000000").
   */
  foregroundColor?: string;

  /**
   * Background color (e.g. "#ffffff").
   */
  backgroundColor?: string;

  /**
   * Output format: 'svg' or 'png'. Default is 'svg'.
   */
  output?: BarcodeOutputFormat;

  /**
   * Whether to render the human-readable text under the barcode. Default is false.
   */
  displayValue?: boolean;
}
