import jsQR from 'jsqr';
import { Item, ItemUnit } from '../types/inventory.ts';

/**
 * Result of matching a scanned QR / barcode string against inventory
 */
export interface ScannedMatchResult {
  rawText: string;
  unit: ItemUnit | null;
  item: Item | null;
  serialNumber: string;
  isDirectMatch: boolean;
  matchType: 'unit_sn' | 'unit_qrcode' | 'item_code' | 'item_qrcode' | 'barcode' | 'raw_text';
}

/**
 * Decodes a QR code from an HTMLImageElement or Canvas using jsQR and native BarcodeDetector if available
 */
export async function decodeQrFromImage(
  img: HTMLImageElement | HTMLCanvasElement
): Promise<string | null> {
  // 1. Try native BarcodeDetector API if supported (fast on Chromium & Android)
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      const barcodeDetector = new (window as any).BarcodeDetector({
        formats: ['qr_code', 'code_128', 'ean_13', 'code_39'],
      });
      const barcodes = await barcodeDetector.detect(img);
      if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
        return barcodes[0].rawValue.trim();
      }
    } catch {
      // Fallback to jsQR
    }
  }

  // 2. Decode using jsQR on Canvas
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  const width = img instanceof HTMLImageElement ? img.naturalWidth || img.width : img.width;
  const height = img instanceof HTMLImageElement ? img.naturalHeight || img.height : img.height;

  if (width === 0 || height === 0) return null;

  // Multi-pass scanning: First test scaled version (fast, handles smartphone photos of 12MP+), then original
  const maxDim = 1200;
  let targetW = width;
  let targetH = height;

  if (targetW > maxDim || targetH > maxDim) {
    const ratio = Math.min(maxDim / targetW, maxDim / targetH);
    targetW = Math.round(targetW * ratio);
    targetH = Math.round(targetH * ratio);
  }

  canvas.width = targetW;
  canvas.height = targetH;
  ctx.drawImage(img, 0, 0, targetW, targetH);

  try {
    const imgData = ctx.getImageData(0, 0, targetW, targetH);
    const code = jsQR(imgData.data, targetW, targetH, {
      inversionAttempts: 'attemptBoth',
    });

    if (code && code.data) {
      return code.data.trim();
    }
  } catch (err) {
    console.warn('Error running jsQR on scaled canvas:', err);
  }

  // If not found and image was resized, try full resolution as fallback
  if (targetW !== width || targetH !== height) {
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);
    try {
      const fullImgData = ctx.getImageData(0, 0, width, height);
      const fullCode = jsQR(fullImgData.data, width, height, {
        inversionAttempts: 'attemptBoth',
      });
      if (fullCode && fullCode.data) {
        return fullCode.data.trim();
      }
    } catch {
      // ignore
    }
  }

  return null;
}

/**
 * Searches inventory for a matching unit and item based on the scanned QR code or barcode text
 */
export function findUnitOrItemByCode(
  rawText: string,
  itemUnits: ItemUnit[],
  items: Item[]
): ScannedMatchResult {
  const clean = rawText.trim();
  const upper = clean.toUpperCase();
  const withoutQr = upper.replace(/^QR-/, '').trim();

  // 1. Direct match with ItemUnit serialNumber
  const unitBySn = itemUnits.find(
    (u) =>
      u.serialNumber.trim().toUpperCase() === upper ||
      u.serialNumber.trim().toUpperCase() === withoutQr
  );
  if (unitBySn) {
    const item = items.find((i) => i.id === unitBySn.itemId) || null;
    return {
      rawText: clean,
      unit: unitBySn,
      item,
      serialNumber: unitBySn.serialNumber,
      isDirectMatch: true,
      matchType: 'unit_sn',
    };
  }

  // 2. Direct match with ItemUnit qrCode
  const unitByQr = itemUnits.find(
    (u) =>
      (u.qrCode && u.qrCode.trim().toUpperCase() === upper) ||
      (u.qrCode && u.qrCode.trim().toUpperCase() === `QR-${upper}`)
  );
  if (unitByQr) {
    const item = items.find((i) => i.id === unitByQr.itemId) || null;
    return {
      rawText: clean,
      unit: unitByQr,
      item,
      serialNumber: unitByQr.serialNumber,
      isDirectMatch: true,
      matchType: 'unit_qrcode',
    };
  }

  // 3. Match with Unit ID
  const unitById = itemUnits.find((u) => u.id === clean);
  if (unitById) {
    const item = items.find((i) => i.id === unitById.itemId) || null;
    return {
      rawText: clean,
      unit: unitById,
      item,
      serialNumber: unitById.serialNumber,
      isDirectMatch: true,
      matchType: 'unit_sn',
    };
  }

  // 4. Match with Item code or qrCode
  const itemByCode = items.find(
    (i) =>
      i.code.toUpperCase() === upper ||
      i.code.toUpperCase() === withoutQr ||
      (i.qrCode && i.qrCode.toUpperCase() === upper)
  );
  if (itemByCode) {
    // Check if there is only 1 unit or find first unit
    const unitsOfItem = itemUnits.filter((u) => u.itemId === itemByCode.id);
    const unit = unitsOfItem.length === 1 ? unitsOfItem[0] : null;
    return {
      rawText: clean,
      unit,
      item: itemByCode,
      serialNumber: unit ? unit.serialNumber : withoutQr,
      isDirectMatch: true,
      matchType: 'item_code',
    };
  }

  // 5. Match with Item barcode
  const itemByBarcode = items.find((i) => i.barcode === clean);
  if (itemByBarcode) {
    const unitsOfItem = itemUnits.filter((u) => u.itemId === itemByBarcode.id);
    const unit = unitsOfItem.length === 1 ? unitsOfItem[0] : null;
    return {
      rawText: clean,
      unit,
      item: itemByBarcode,
      serialNumber: unit ? unit.serialNumber : '',
      isDirectMatch: true,
      matchType: 'barcode',
    };
  }

  // 6. No direct match found, treat the decoded string as the serial number
  return {
    rawText: clean,
    unit: null,
    item: null,
    serialNumber: withoutQr || clean,
    isDirectMatch: false,
    matchType: 'raw_text',
  };
}
