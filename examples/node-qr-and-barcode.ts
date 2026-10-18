import {
  generateBarcode,
  generateQrCode,
  readBarcode,
  readQrCode
} from '../src/index.js';

async function main() {
  console.log('=== QR Code Workflow ===');
  // 1. Generate QR code as SVG
  const qrSvg = await generateQrCode('https://example.com', {
    output: 'svg',
    width: 250,
    margin: 4
  });
  console.log('Generated QR SVG length:', qrSvg.length);

  // 2. Generate QR code as PNG buffer
  const qrPng = await generateQrCode('https://example.com', {
    output: 'png',
    width: 300,
    margin: 4
  });
  console.log('Generated QR PNG bytes:', qrPng.length);

  // 3. Decode QR code from PNG buffer
  const qrResult = await readQrCode(qrPng);
  console.log('Decoded QR Text:', qrResult?.text);

  console.log('\n=== Barcode Workflow ===');
  // 4. Generate Code 128 Barcode as PNG
  const barcodePng = await generateBarcode('PACKAGE-12345', {
    format: 'CODE_128',
    output: 'png',
    scale: 3,
    margin: 10
  });
  console.log('Generated Code 128 PNG bytes:', barcodePng.length);

  // 5. Decode Barcode from PNG buffer
  const barcodeResult = await readBarcode(barcodePng, {
    formats: ['CODE_128']
  });
  console.log('Decoded Barcode Text:', barcodeResult?.text, 'Format:', barcodeResult?.format);
}

main().catch(console.error);
