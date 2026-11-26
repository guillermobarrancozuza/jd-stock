import React, { useEffect, useState } from 'react';
import { X, Printer, Download, Copy, Check, QrCode, Ruler, Layers } from 'lucide-react';
import QRCode from 'qrcode';
import { Item, ItemUnit, EquipmentKit, CableBox, QrStickerSize } from '../../types/inventory.ts';

interface QrBarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  item?: Item | null;
  unit?: ItemUnit | null;
  kit?: EquipmentKit | null;
  cableBox?: CableBox | null;
  defaultSize?: QrStickerSize;
}

interface StickerPreset {
  id: QrStickerSize;
  label: string;
  dimensionsLabel: string;
  usage: string;
  widthMm: number;
  heightMm: number;
}

const STICKER_PRESETS: StickerPreset[] = [
  {
    id: 'micro_20x20',
    label: 'Micros',
    dimensionsLabel: '20 × 20 mm',
    usage: 'Pegatina compacta para micrófonos y accesorios',
    widthMm: 20,
    heightMm: 20,
  },
  {
    id: 'flycase_17x7',
    label: 'Flycases',
    dimensionsLabel: '17 × 7 cm (170 × 70 mm)',
    usage: 'Etiqueta panorámica para flightcases, carros y cajas',
    widthMm: 170,
    heightMm: 70,
  },
  {
    id: 'truss_6x6',
    label: 'Trusses',
    dimensionsLabel: '6 × 6 cm (60 × 60 mm)',
    usage: 'Pegatina cuadrada resistente para tramos de truss y focos',
    widthMm: 60,
    heightMm: 60,
  },
];

function inferDefaultSize(
  item?: Item | null,
  unit?: ItemUnit | null,
  kit?: EquipmentKit | null,
  cableBox?: CableBox | null
): QrStickerSize {
  if (kit || cableBox) return 'flycase_17x7';
  const hay = `${item?.group || ''} ${item?.category || ''} ${item?.name || ''} ${unit?.itemName || ''}`.toLowerCase();
  if (hay.includes('micro') || hay.includes('sm58') || hay.includes('sm57') || hay.includes('petaca')) {
    return 'micro_20x20';
  }
  if (hay.includes('truss') || hay.includes('estructura')) {
    return 'truss_6x6';
  }
  return 'flycase_17x7';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const QrBarcodeModal: React.FC<QrBarcodeModalProps> = ({
  isOpen,
  onClose,
  item,
  unit,
  kit,
  cableBox,
  defaultSize,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<QrStickerSize>(() =>
    defaultSize || inferDefaultSize(item, unit, kit, cableBox)
  );
  const [printMode, setPrintMode] = useState<'exact' | 'a4_sheet'>('exact');
  const [copies, setCopies] = useState<number>(1);

  useEffect(() => {
    if (isOpen) {
      setSelectedSize(defaultSize || inferDefaultSize(item, unit, kit, cableBox));
      setCopies(1);
    }
  }, [isOpen, defaultSize, item, unit, kit, cableBox]);

  const title = kit
    ? kit.name
    : cableBox
    ? cableBox.name
    : unit
    ? `${unit.itemName} (N/S)`
    : item?.name || 'Equipo AV';

  const code = kit
    ? kit.code
    : cableBox
    ? cableBox.code
    : unit
    ? unit.serialNumber
    : item?.code || 'AV-REF';

  const badgeLabel = kit
    ? `QR CONJUNTO · ${kit.section.toUpperCase()}`
    : cableBox
    ? `CAJA CABLES · ${cableBox.currentQuantity}/${cableBox.initialQuantity} UDS`
    : item?.group || 'AUDIOVISUAL';

  const qrPayload = kit
    ? kit.qrCode || `QR-${kit.code}`
    : cableBox
    ? cableBox.qrCode || `QR-${cableBox.code}`
    : unit
    ? unit.qrCode || `QR-${unit.serialNumber}`
    : item?.qrCode || `QR-${item?.code}`;

  const location = kit
    ? kit.locationName
    : cableBox
    ? cableBox.locationName
    : unit
    ? unit.locationName
    : item?.defaultLocationName || 'Almacén Central';

  const subtitle = kit
    ? kit.components.map((c) => `${c.quantity}× ${c.name}`).join(' · ')
    : cableBox
    ? `${cableBox.cableType}${cableBox.cableLength ? ` (${cableBox.cableLength})` : ''} — Contiene ${cableBox.currentQuantity} uds útiles`
    : item
    ? `${item.brand} ${item.model}`.trim()
    : '';

  const barcode = item?.barcode || '';
  const preset = STICKER_PRESETS.find((p) => p.id === selectedSize) || STICKER_PRESETS[1];

  useEffect(() => {
    if (isOpen && qrPayload) {
      QRCode.toDataURL(qrPayload, {
        width: 480,
        margin: 1,
        errorCorrectionLevel: selectedSize === 'micro_20x20' ? 'M' : 'H',
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch(() => setQrDataUrl(''));
    }
  }, [isOpen, qrPayload, selectedSize]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  // Build exact-millimeter HTML sticker markup for hidden iframe printing (zero window.open popups)
  const buildStickerHtml = (): string => {
    const safeTitle = escapeHtml(title);
    const safeCode = escapeHtml(code);
    const safeBadge = escapeHtml(badgeLabel);
    const safePayload = escapeHtml(qrPayload);
    const safeLoc = escapeHtml(location);
    const safeSub = escapeHtml(subtitle);

    if (selectedSize === 'micro_20x20') {
      return `
        <div class="sticker micro">
          <img src="${qrDataUrl}" alt="QR" class="qr-img" />
          <div class="micro-code">${safeCode}</div>
        </div>
      `;
    }

    if (selectedSize === 'truss_6x6') {
      return `
        <div class="sticker truss">
          <div class="truss-header">
            <span>JD STOCK</span>
            <span>${safeCode}</span>
          </div>
          <img src="${qrDataUrl}" alt="QR" class="qr-img" />
          <div class="truss-title">${safeTitle}</div>
          <div class="truss-payload">${safePayload}</div>
        </div>
      `;
    }

    // flycase_17x7 (170mm x 70mm)
    return `
      <div class="sticker flycase">
        <div class="flycase-qr-col">
          <img src="${qrDataUrl}" alt="QR" class="qr-img" />
          <div class="flycase-payload">${safePayload}</div>
        </div>
        <div class="flycase-info-col">
          <div class="flycase-top">
            <span class="brand">JD CONTROL DE STOCK</span>
            <span class="badge">${safeBadge}</span>
          </div>
          <div class="flycase-title">${safeTitle}</div>
          ${safeSub ? `<div class="flycase-sub">${safeSub}</div>` : ''}
          <div class="flycase-meta">
            <span><strong>REF:</strong> ${safeCode}</span>
            <span><strong>UBIC:</strong> ${safeLoc}</span>
          </div>
        </div>
      </div>
    `;
  };

  const handlePrintExact = () => {
    if (!qrDataUrl) return;
    const count = Math.max(1, Math.min(24, copies));
    const stickerMarkup = buildStickerHtml();
    const tiles = Array.from({ length: count })
      .map(() => stickerMarkup)
      .join('');

    const isExactPage = printMode === 'exact';
    const pageRule = isExactPage
      ? `@page { size: ${preset.widthMm}mm ${preset.heightMm}mm; margin: 0; }`
      : `@page { size: A4 portrait; margin: 8mm; }`;

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Etiqueta QR ${escapeHtml(code)} (${preset.dimensionsLabel})</title>
  <style>
    ${pageRule}
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      background: #ffffff;
      color: #000000;
      font-family: Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet {
      display: ${isExactPage ? 'block' : 'flex'};
      flex-wrap: wrap;
      gap: ${isExactPage ? '0' : '3mm'};
      align-items: flex-start;
    }
    .sticker {
      background: #ffffff;
      color: #000000;
      overflow: hidden;
      page-break-inside: avoid;
      break-inside: avoid;
      ${isExactPage ? 'page-break-after: always;' : 'border: 0.3mm dashed #666666;'}
    }
    .sticker:last-child {
      page-break-after: auto;
    }
    .qr-img {
      image-rendering: pixelated;
      display: block;
    }
    /* MICRO 20x20 mm */
    .sticker.micro {
      width: 20mm;
      height: 20mm;
      padding: 0.8mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
    }
    .sticker.micro .qr-img {
      width: 15.2mm;
      height: 15.2mm;
    }
    .sticker.micro .micro-code {
      font-family: monospace;
      font-size: 4.5pt;
      font-weight: 800;
      line-height: 1;
      max-width: 18.4mm;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      text-align: center;
    }
    /* TRUSS 60x60 mm (6x6 cm) */
    .sticker.truss {
      width: 60mm;
      height: 60mm;
      padding: 2.5mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      border-radius: 1mm;
    }
    .sticker.truss .truss-header {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 6.5pt;
      font-weight: 900;
      border-bottom: 0.4mm solid #000000;
      padding-bottom: 1mm;
    }
    .sticker.truss .qr-img {
      width: 37mm;
      height: 37mm;
    }
    .sticker.truss .truss-title {
      font-size: 7.5pt;
      font-weight: 800;
      text-transform: uppercase;
      text-align: center;
      line-height: 1.1;
      max-width: 55mm;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .sticker.truss .truss-payload {
      font-family: monospace;
      font-size: 6pt;
      font-weight: 700;
      color: #222222;
    }
    /* FLYCASE 170x70 mm (17x7 cm) */
    .sticker.flycase {
      width: 170mm;
      height: 70mm;
      padding: 3.5mm;
      display: flex;
      flex-direction: row;
      align-items: stretch;
      gap: 4mm;
    }
    .sticker.flycase .flycase-qr-col {
      width: 56mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border-right: 0.4mm solid #cccccc;
      padding-right: 3mm;
    }
    .sticker.flycase .qr-img {
      width: 50mm;
      height: 50mm;
    }
    .sticker.flycase .flycase-payload {
      margin-top: 1.5mm;
      font-family: monospace;
      font-size: 7pt;
      font-weight: 800;
      text-align: center;
      word-break: break-all;
    }
    .sticker.flycase .flycase-info-col {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-width: 0;
    }
    .sticker.flycase .flycase-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 0.6mm solid #000000;
      padding-bottom: 1.5mm;
      gap: 2mm;
    }
    .sticker.flycase .brand {
      font-size: 9pt;
      font-weight: 900;
      letter-spacing: 0.5px;
    }
    .sticker.flycase .badge {
      background: #000000;
      color: #ffffff;
      font-family: monospace;
      font-size: 6.5pt;
      font-weight: 800;
      padding: 0.8mm 2mm;
      border-radius: 0.8mm;
      white-space: nowrap;
    }
    .sticker.flycase .flycase-title {
      font-size: 13pt;
      font-weight: 900;
      text-transform: uppercase;
      line-height: 1.15;
      margin-top: 1.5mm;
    }
    .sticker.flycase .flycase-sub {
      font-size: 8pt;
      color: #222222;
      line-height: 1.25;
      margin-top: 1mm;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .sticker.flycase .flycase-meta {
      display: flex;
      justify-content: space-between;
      font-family: monospace;
      font-size: 7.5pt;
      border-top: 0.3mm solid #999999;
      padding-top: 1.5mm;
      margin-top: auto;
    }
  </style>
</head>
<body>
  <div class="sheet">${tiles}</div>
</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        setTimeout(() => {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        }, 1200);
      }
    }, 250);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto no-print">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-2xl max-h-[94vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-[#30363d] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Pegatinas QR con Medidas Reales (mm / cm)</h2>
              <p className="text-[11px] text-zinc-400">
                Micros (20×20 mm), Flycases (17×7 cm) y Trusses (6×6 cm) listas para imprimir
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 text-xs overflow-y-auto flex-1">
          {/* Exact Dimension Selector */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
              <Ruler className="w-3.5 h-3.5 text-amber-400" />
              Selecciona la Medida Física de la Pegatina QR
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {STICKER_PRESETS.map((p) => {
                const active = selectedSize === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedSize(p.id)}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      active
                        ? 'bg-amber-500/15 border-amber-400 text-white shadow-md shadow-amber-500/10'
                        : 'bg-[#0d1117] border-[#30363d] text-zinc-300 hover:border-zinc-500'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className={`font-bold text-xs ${active ? 'text-amber-300' : 'text-white'}`}>
                        {p.label}
                      </span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/50 text-amber-400 border border-amber-500/30">
                        {p.widthMm}×{p.heightMm}mm
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-1 leading-snug">{p.usage}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Print Layout & Copies */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-[#0d1117] border border-[#30363d]">
            <div>
              <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-1.5">
                Formato de Impresión
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setPrintMode('exact')}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
                    printMode === 'exact'
                      ? 'bg-amber-500 text-black border-amber-400'
                      : 'bg-[#161b22] text-zinc-300 border-[#30363d] hover:border-zinc-500'
                  }`}
                >
                  Etiqueta Exacta
                </button>
                <button
                  type="button"
                  onClick={() => setPrintMode('a4_sheet')}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
                    printMode === 'a4_sheet'
                      ? 'bg-amber-500 text-black border-amber-400'
                      : 'bg-[#161b22] text-zinc-300 border-[#30363d] hover:border-zinc-500'
                  }`}
                >
                  Hoja A4 (Recortar)
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1.5">
                Número de Copias ({printMode === 'exact' ? 'etiquetas' : 'en hoja A4'})
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={copies}
                  onChange={(e) => setCopies(Math.max(1, Math.min(24, Number(e.target.value) || 1)))}
                  className="w-20 bg-[#161b22] border border-[#30363d] rounded-lg px-2.5 py-1.5 text-white font-mono font-bold text-xs focus:outline-none focus:border-amber-500"
                />
                <span className="text-[10px] text-zinc-400">
                  Tamaño real al imprimir: <strong className="text-amber-300">{preset.dimensionsLabel}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Scaled Live Preview */}
          <div className="p-5 rounded-xl bg-[#0d1117] border border-[#30363d] flex flex-col items-center justify-center gap-3">
            <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
              Vista previa proporcional — {preset.label}: {preset.dimensionsLabel}
            </div>

            {selectedSize === 'micro_20x20' && (
              <div className="bg-white text-black w-32 h-32 p-2 rounded-lg border-2 border-dashed border-amber-400 shadow-lg flex flex-col items-center justify-between">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR Micro" className="w-24 h-24 object-contain" style={{ imageRendering: 'pixelated' }} />
                ) : (
                  <div className="w-24 h-24 bg-zinc-200 animate-pulse rounded" />
                )}
                <span className="font-mono text-[10px] font-black truncate max-w-full leading-none">
                  {code}
                </span>
              </div>
            )}

            {selectedSize === 'truss_6x6' && (
              <div className="bg-white text-black w-52 h-52 p-3 rounded-lg border-2 border-dashed border-amber-400 shadow-lg flex flex-col items-center justify-between">
                <div className="w-full flex items-center justify-between border-b border-black pb-1 text-[9px] font-black">
                  <span>JD STOCK</span>
                  <span className="font-mono">{code}</span>
                </div>
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR Truss" className="w-32 h-32 object-contain" style={{ imageRendering: 'pixelated' }} />
                ) : (
                  <div className="w-32 h-32 bg-zinc-200 animate-pulse rounded" />
                )}
                <div className="text-center w-full">
                  <div className="text-[10px] font-black uppercase truncate">{title}</div>
                  <div className="font-mono text-[8px] text-zinc-600 truncate">{qrPayload}</div>
                </div>
              </div>
            )}

            {selectedSize === 'flycase_17x7' && (
              <div className="bg-white text-black w-full max-w-[520px] aspect-[17/7] p-3.5 rounded-lg border-2 border-dashed border-amber-400 shadow-lg flex items-stretch gap-3.5">
                <div className="w-1/3 border-r border-zinc-300 pr-3 flex flex-col items-center justify-center">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="QR Flycase" className="w-28 h-28 object-contain" style={{ imageRendering: 'pixelated' }} />
                  ) : (
                    <div className="w-28 h-28 bg-zinc-200 animate-pulse rounded" />
                  )}
                  <span className="font-mono text-[9px] font-bold mt-1 text-center break-all leading-tight">
                    {qrPayload}
                  </span>
                </div>
                <div className="flex-1 flex flex-col justify-between min-w-0">
                  <div className="flex items-center justify-between gap-2 border-b-2 border-black pb-1">
                    <span className="font-black text-[11px] tracking-wide">JD CONTROL DE STOCK</span>
                    <span className="bg-black text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded truncate max-w-[160px]">
                      {badgeLabel}
                    </span>
                  </div>
                  <div className="my-1">
                    <div className="text-sm font-black uppercase leading-tight line-clamp-2">{title}</div>
                    {subtitle && (
                      <div className="text-[10px] text-zinc-700 mt-1 line-clamp-3 leading-snug">
                        {subtitle}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between font-mono text-[10px] border-t border-zinc-300 pt-1">
                    <span>
                      <strong>REF:</strong> {code}
                    </span>
                    <span className="truncate max-w-[180px]">
                      <strong>UBIC:</strong> {location}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Copy Data Panels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-[#0d1117] border border-[#30363d] flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <span className="text-[10px] text-zinc-400 block font-semibold uppercase">Código QR</span>
                <span className="font-mono font-bold text-amber-300 text-xs truncate block">{qrPayload}</span>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(qrPayload, 'qr')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-semibold transition shrink-0 cursor-pointer"
              >
                {copied === 'qr' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied === 'qr' ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>

            {barcode ? (
              <div className="p-3 rounded-xl bg-[#0d1117] border border-[#30363d] flex items-center justify-between">
                <div className="min-w-0 pr-2">
                  <span className="text-[10px] text-zinc-400 block font-semibold uppercase">Código de Barras</span>
                  <span className="font-mono font-bold text-white text-xs truncate block">{barcode}</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(barcode, 'barcode')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-semibold transition shrink-0 cursor-pointer"
                >
                  {copied === 'barcode' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied === 'barcode' ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-[#0d1117] border border-[#30363d] flex items-center gap-2 text-[11px] text-zinc-400">
                <Layers className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Escanea este QR con cámara o pistola para abrir la ficha en pantalla.</span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 border-t border-[#30363d] bg-[#0d1117] flex flex-wrap items-center justify-between gap-2">
          {qrDataUrl ? (
            <a
              href={qrDataUrl}
              download={`QR_${code}_${preset.id}.png`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#30363d] hover:bg-zinc-800 text-zinc-300 text-xs font-semibold transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar PNG</span>
            </a>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-[#30363d] hover:bg-zinc-800 text-zinc-300 text-xs transition cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handlePrintExact}
              disabled={!qrDataUrl}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>
                Imprimir {preset.label} ({preset.widthMm}×{preset.heightMm} mm)
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
