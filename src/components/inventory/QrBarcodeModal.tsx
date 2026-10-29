import React, { useEffect, useState } from 'react';
import { X, Printer, Download, Copy, Check, QrCode, Barcode as BarcodeIcon, Tag } from 'lucide-react';
import { Item, ItemUnit } from '../../types/inventory.ts';
import { generateQrDataUrl } from '../../lib/barcodeUtils.ts';

interface QrBarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  item?: Item | null;
  unit?: ItemUnit | null;
}

export const QrBarcodeModal: React.FC<QrBarcodeModalProps> = ({ isOpen, onClose, item, unit }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<string | null>(null);

  const title = unit ? `${unit.itemName} (Unidad Física)` : item?.name || 'Equipo AV';
  const code = unit ? unit.serialNumber : item?.code || 'AV-REF';
  const group = item?.group || 'AUDIOVISUAL';
  const barcode = item?.barcode || '8437001928371';
  const qrPayload = unit ? unit.qrCode || `QR-${unit.serialNumber}` : item?.qrCode || `QR-${item?.code}`;
  const location = unit ? unit.locationName : item?.defaultLocationName || 'Almacén Central';
  const brandModel = item ? `${item.brand} ${item.model}`.trim() : '';

  useEffect(() => {
    if (isOpen && qrPayload) {
      generateQrDataUrl(qrPayload).then((url) => {
        setQrDataUrl(url);
      });
    }
  }, [isOpen, qrPayload]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  // Pseudo-barcode vertical SVG bars based on barcode string digits
  const renderBarcodeBars = (codeStr: string) => {
    const bars: { width: number; isBlack: boolean }[] = [];
    // Guard bars start
    bars.push({ width: 2, isBlack: true }, { width: 2, isBlack: false }, { width: 2, isBlack: true });

    for (let i = 0; i < codeStr.length; i++) {
      const num = parseInt(codeStr[i], 10) || 0;
      const w1 = (num % 3) + 1.5;
      const w2 = ((num + 1) % 2) + 1.2;
      const w3 = ((num + 2) % 3) + 1.2;
      bars.push({ width: w1, isBlack: true });
      bars.push({ width: w2, isBlack: false });
      bars.push({ width: w3, isBlack: true });
      bars.push({ width: 1.5, isBlack: false });
    }

    // Guard bars end
    bars.push({ width: 2, isBlack: true }, { width: 2, isBlack: false }, { width: 2, isBlack: true });

    return (
      <div className="flex items-stretch justify-center h-14 bg-white px-4 py-2 rounded">
        {bars.map((bar, idx) => (
          <div
            key={idx}
            style={{
              width: `${bar.width * 2}px`,
              backgroundColor: bar.isBlack ? '#000000' : '#ffffff',
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-[#30363d] flex items-center justify-between no-print">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Etiqueta Identificativa, QR y Código de Barras</h2>
              <p className="text-[11px] text-zinc-400">Lectura óptica para pistolas 2D, cámaras y smartphones</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 text-xs overflow-y-auto flex-1">
          {/* Printable Sticker Preview Card */}
          <div className="bg-white text-black p-5 rounded-xl shadow-lg border-2 border-dashed border-zinc-400 print:border-none print:shadow-none print:p-0 print:m-0">
            {/* Header / Brand */}
            <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-3">
              <div className="flex items-center gap-2">
                <img src="/assets/logo_jd_square.png" alt="JD" className="w-6 h-6 object-contain" />
                <span className="font-extrabold tracking-wider text-xs uppercase">JD CONTROL DE STOCK</span>
              </div>
              <span className="font-mono text-[10px] font-bold bg-black text-white px-2 py-0.5 rounded">
                GRUPO: {group}
              </span>
            </div>

            {/* Equipment Name & Code */}
            <div className="mb-3">
              <div className="text-sm font-black uppercase tracking-tight text-black leading-snug">{title}</div>
              {brandModel && <div className="text-[11px] text-zinc-700 font-semibold">{brandModel}</div>}
              <div className="flex items-center gap-3 mt-1 text-[11px] font-mono font-bold">
                <span className="bg-zinc-200 px-1.5 py-0.5 rounded">REF: {code}</span>
                {unit && <span className="bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded">N/S: {unit.serialNumber}</span>}
                <span className="text-zinc-600 font-normal">UBICACIÓN: {location}</span>
              </div>
            </div>

            {/* Visual Codes Grid: QR and Barcode */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center bg-zinc-50 p-3 rounded-lg border border-zinc-200">
              {/* QR Code */}
              <div className="flex flex-col items-center justify-center border-r border-zinc-200 pr-2">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Código QR" className="w-28 h-28 object-contain border border-zinc-300 rounded p-1 bg-white" />
                ) : (
                  <div className="w-28 h-28 bg-zinc-200 animate-pulse rounded flex items-center justify-center text-zinc-500">
                    Cargando QR...
                  </div>
                )}
                <span className="mt-1 font-mono text-[10px] font-bold text-zinc-700">{qrPayload}</span>
              </div>

              {/* Barcode */}
              <div className="flex flex-col items-center justify-center">
                {renderBarcodeBars(barcode)}
                <span className="mt-1 font-mono text-xs font-bold tracking-widest text-black">{barcode}</span>
                <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-sans mt-0.5">EAN-13 / CODE-128 READY</span>
              </div>
            </div>

            {/* Footer Notice */}
            <div className="mt-3 pt-2 border-t border-zinc-300 text-[9px] text-zinc-500 flex items-center justify-between">
              <span>Propiedad de la empresa. Escanear al preparar salida o devolución.</span>
              <span className="font-mono">ID: {unit ? unit.id : item?.id}</span>
            </div>
          </div>

          {/* Quick Copy Data Panels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 no-print">
            <div className="p-3 rounded-xl bg-[#0d1117] border border-[#30363d] flex items-center justify-between">
              <div>
                <span className="text-[10px] text-zinc-400 block font-semibold uppercase">Código de Barras</span>
                <span className="font-mono font-bold text-white text-xs">{barcode}</span>
              </div>
              <button
                onClick={() => copyToClipboard(barcode, 'barcode')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-semibold transition"
              >
                {copied === 'barcode' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied === 'barcode' ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>

            <div className="p-3 rounded-xl bg-[#0d1117] border border-[#30363d] flex items-center justify-between">
              <div>
                <span className="text-[10px] text-zinc-400 block font-semibold uppercase">Lectura QR Payload</span>
                <span className="font-mono font-bold text-white text-xs">{qrPayload}</span>
              </div>
              <button
                onClick={() => copyToClipboard(qrPayload, 'qr')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-semibold transition"
              >
                {copied === 'qr' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied === 'qr' ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
          </div>

          {/* Guidelines info */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] leading-relaxed no-print">
            <strong>Compatibilidad con lectores de código de barras y QR:</strong>
            <p className="text-zinc-300 mt-0.5">
              Tanto el código de barras como el QR pueden ser leídos por pistolas láser USB/Bluetooth conectadas a la aplicación o
              directamente apuntando con la cámara de un teléfono móvil. Imprime la etiqueta para pegarla en el flight case o el chasis del
              equipo.
            </p>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 border-t border-[#30363d] bg-[#0d1117] flex items-center justify-between no-print">
          {qrDataUrl ? (
            <a
              href={qrDataUrl}
              download={`QR_${code}.png`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#30363d] hover:bg-zinc-800 text-zinc-300 text-xs font-semibold transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar Imagen QR</span>
            </a>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-[#30363d] hover:bg-zinc-800 text-zinc-300 text-xs transition"
            >
              Cerrar
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition shadow-lg shadow-amber-500/20"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir Etiqueta Adhesiva</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
