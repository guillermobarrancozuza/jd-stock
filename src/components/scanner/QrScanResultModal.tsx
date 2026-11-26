import React, { useState } from 'react';
import {
  X,
  QrCode,
  Boxes,
  Cable,
  Package,
  FileSignature,
  MapPin,
  Minus,
  RotateCcw,
  Truck,
  Wrench,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Camera,
  Copy,
  Check,
  Droplets,
  ShoppingCart,
  Plus,
} from 'lucide-react';
import { ScannedMatchResult } from '../../lib/qrScannerUtils.ts';
import { useInventory } from '../../context/InventoryContext.tsx';
import { QrBarcodeModal } from '../inventory/QrBarcodeModal.tsx';

interface QrScanResultModalProps {
  result: ScannedMatchResult | null;
  onClose: () => void;
  onScanAgain: () => void;
  onNavigate: (view: string) => void;
}

export const QrScanResultModal: React.FC<QrScanResultModalProps> = ({
  result,
  onClose,
  onScanAgain,
  onNavigate,
}) => {
  const {
    equipmentKits,
    cableBoxes,
    consumables,
    items,
    itemUnits,
    adjustCableBoxQuantity,
    adjustConsumableQuantity,
  } = useInventory();
  const [showPrintSticker, setShowPrintSticker] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!result) return null;

  // Read live versions from context so immediate deductions or edits reflect right on screen
  const liveKit = result.kit
    ? equipmentKits.find((k) => k.id === result.kit?.id) || result.kit
    : null;
  const liveBox = result.cableBox
    ? cableBoxes.find((b) => b.id === result.cableBox?.id) || result.cableBox
    : null;
  const liveConsumable = result.consumable
    ? consumables.find((c) => c.id === result.consumable?.id) || result.consumable
    : null;
  const liveUnit = result.unit
    ? itemUnits.find((u) => u.id === result.unit?.id) || result.unit
    : null;
  const liveItem = result.item
    ? items.find((i) => i.id === result.item?.id) || result.item
    : null;
  const contract = result.contract || null;

  const handleCableAdjust = async (type: 'broken' | 'lost' | 'restocked') => {
    if (!liveBox) return;
    const updated = await adjustCableBoxQuantity(liveBox.id, type, 1);
    if (updated) {
      setFeedback(
        type === 'broken'
          ? `Descontado 1 cable roto. Quedan ${updated.currentQuantity}/${updated.initialQuantity} en la caja.`
          : type === 'lost'
          ? `Descontado 1 cable perdido. Quedan ${updated.currentQuantity}/${updated.initialQuantity} en la caja.`
          : `Repuesto +1 cable. Ahora hay ${updated.currentQuantity}/${updated.initialQuantity} en la caja.`
      );
      setTimeout(() => setFeedback(null), 3500);
    }
  };

  const handleConsumableAdjust = async (type: 'consumed' | 'restocked') => {
    if (!liveConsumable) return;
    const updated = await adjustConsumableQuantity(liveConsumable.id, type, 1);
    if (updated) {
      const needsBuy = updated.currentQuantity <= updated.minStock;
      setFeedback(
        type === 'consumed'
          ? `Gastado 1 ${updated.unit}. Quedan ${updated.currentQuantity} ${updated.unit} — ${
              needsBuy ? '⚠️ HAY QUE COMPRAR' : '✓ NO HACE FALTA COMPRAR'
            }.`
          : `Repuesto +1 ${updated.unit}. Ahora hay ${updated.currentQuantity} ${updated.unit} — ${
              needsBuy ? 'Sigue bajo mínimo (hay que comprar)' : '✓ Stock OK'
            }.`
      );
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto no-print">
        <div className="bg-[#161b22] border border-amber-500/50 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in">
          {/* Header */}
          <div className="p-4 border-b border-[#30363d] bg-gradient-to-r from-amber-500/15 via-[#161b22] to-[#161b22] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0">
                {liveKit ? (
                  <Boxes className="w-5 h-5" />
                ) : liveBox ? (
                  <Cable className="w-5 h-5 text-cyan-400" />
                ) : liveConsumable ? (
                  <Droplets className="w-5 h-5 text-emerald-400" />
                ) : contract ? (
                  <FileSignature className="w-5 h-5" />
                ) : (
                  <Package className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {liveKit
                      ? 'QR CONJUNTO / CARRO'
                      : liveBox
                      ? 'QR CAJA DE CABLES'
                      : liveConsumable
                      ? 'QR CONSUMIBLE'
                      : liveUnit
                      ? 'UNIDAD FÍSICA N/S'
                      : liveItem
                      ? 'ARTÍCULO CATÁLOGO'
                      : contract
                      ? 'CONTRATO'
                      : 'CÓDIGO ESCANEADO'}
                  </span>
                  {result.isDirectMatch && (
                    <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Identificado
                    </span>
                  )}
                </div>
                <h2 className="text-base font-bold text-white truncate mt-0.5">
                  {liveKit?.name ||
                    liveBox?.name ||
                    liveConsumable?.name ||
                    (liveUnit ? `${liveUnit.itemName} (${liveUnit.serialNumber})` : '') ||
                    liveItem?.name ||
                    (contract ? `${contract.code} — ${contract.eventName}` : result.rawText)}
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4 text-xs max-h-[70vh] overflow-y-auto">
            {feedback && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{feedback}</span>
              </div>
            )}

            {/* CASE 1: COMPOSITE EQUIPMENT KIT */}
            {liveKit && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-[#0d1117] border border-[#30363d]">
                  <div>
                    <span className="text-[10px] text-zinc-500 block">Código QR Conjunto</span>
                    <span className="font-mono font-bold text-amber-300">{liveKit.qrCode}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block">Apartado</span>
                    <span className="font-bold text-cyan-300">{liveKit.section}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block">Ubicación</span>
                    <span className="text-zinc-200 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-zinc-500" />
                      {liveKit.locationName}
                    </span>
                  </div>
                </div>

                {liveKit.description && (
                  <p className="text-zinc-300 bg-[#0d1117] p-3 rounded-xl border border-[#30363d]">
                    {liveKit.description}
                  </p>
                )}

                <div className="p-3.5 rounded-xl bg-[#0d1117] border border-amber-500/30 space-y-2">
                  <div className="flex items-center justify-between font-bold text-amber-300 text-[11px] uppercase tracking-wider border-b border-[#30363d] pb-1.5">
                    <span>Equipos que lleva este QR Conjunto</span>
                    <span className="font-mono">
                      {liveKit.components.reduce((acc, c) => acc + c.quantity, 0)} piezas
                    </span>
                  </div>
                  <ul className="space-y-1.5">
                    {liveKit.components.map((c) => (
                      <li key={c.id} className="flex items-center justify-between text-xs text-zinc-100">
                        <span className="flex items-center gap-2">
                          <span className="font-mono font-black text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded">
                            {c.quantity}×
                          </span>
                          <span>{c.name}</span>
                        </span>
                        {c.itemCode && (
                          <span className="font-mono text-[10px] text-zinc-500">{c.itemCode}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* CASE 2: CABLE BOX WITH DIRECT DEDUCTION */}
            {liveBox && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center font-mono">
                  <div className="p-3 rounded-xl bg-[#0d1117] border border-cyan-500/40">
                    <span className="text-[10px] text-zinc-400 block">Cables en Caja</span>
                    <span className="text-xl font-black text-cyan-300">
                      {liveBox.currentQuantity}
                      <span className="text-xs text-zinc-500">/{liveBox.initialQuantity}</span>
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#0d1117] border border-rose-500/30">
                    <span className="text-[10px] text-rose-400 block">Rotos</span>
                    <span className="text-xl font-black text-rose-300">{liveBox.brokenCount}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#0d1117] border border-amber-500/30">
                    <span className="text-[10px] text-amber-400 block">Perdidos</span>
                    <span className="text-xl font-black text-amber-300">{liveBox.lostCount}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/30 space-y-2.5">
                  <div className="text-[11px] font-bold text-cyan-300">
                    Descontar cables rotos o perdidos directamente desde este QR:
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      disabled={liveBox.currentQuantity <= 0}
                      onClick={() => handleCableAdjust('broken')}
                      className="flex items-center justify-center gap-1 py-2.5 px-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 font-bold transition cursor-pointer disabled:opacity-40"
                    >
                      <Minus className="w-4 h-4" />
                      <span>1 Roto</span>
                    </button>
                    <button
                      type="button"
                      disabled={liveBox.currentQuantity <= 0}
                      onClick={() => handleCableAdjust('lost')}
                      className="flex items-center justify-center gap-1 py-2.5 px-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 font-bold transition cursor-pointer disabled:opacity-40"
                    >
                      <Minus className="w-4 h-4" />
                      <span>1 Perdido</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCableAdjust('restocked')}
                      className="flex items-center justify-center gap-1 py-2.5 px-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 font-bold transition cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>+1 Reponer</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1">
                  <span>
                    Tipo: <strong className="text-zinc-200">{liveBox.cableType} {liveBox.cableLength}</strong>
                  </span>
                  <span>Ubicación: {liveBox.locationName}</span>
                </div>
              </div>
            )}

            {/* CASE 2B: CONSUMABLE WITH BUY / NO-BUY VERDICT */}
            {liveConsumable && (() => {
              const isOut = liveConsumable.currentQuantity === 0;
              const needsBuy = liveConsumable.currentQuantity <= liveConsumable.minStock;
              return (
                <div className="space-y-3">
                  {/* Prominent Buy / No-Buy Verdict Banner */}
                  <div
                    className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                      isOut
                        ? 'bg-rose-500/15 border-rose-500/50 text-rose-200'
                        : needsBuy
                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                        : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {needsBuy ? (
                        <ShoppingCart className={`w-5 h-5 shrink-0 ${isOut ? 'text-rose-400' : 'text-amber-400'}`} />
                      ) : (
                        <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
                      )}
                      <div>
                        <div className="text-xs font-black uppercase tracking-wide">
                          {isOut
                            ? 'SIN STOCK — HAY QUE COMPRAR YA'
                            : needsBuy
                            ? 'HAY QUE COMPRAR REPOSICIÓN'
                            : 'NO HACE FALTA COMPRAR — STOCK OK'}
                        </div>
                        <div className="text-[11px] opacity-90">
                          {needsBuy
                            ? `Quedan ${liveConsumable.currentQuantity} ${liveConsumable.unit} (mínimo: ${liveConsumable.minStock}).${
                                liveConsumable.recommendedOrderQty
                                  ? ` Recomendado pedir: ${liveConsumable.recommendedOrderQty} ${liveConsumable.unit}.`
                                  : ''
                              }`
                            : `Tienes ${liveConsumable.currentQuantity} ${liveConsumable.unit} (aviso de compra a partir de ${liveConsumable.minStock}).`}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center font-mono">
                    <div className="p-3 rounded-xl bg-[#0d1117] border border-[#30363d]">
                      <span className="text-[10px] text-zinc-400 block">Stock Actual</span>
                      <span
                        className={`text-xl font-black ${
                          isOut ? 'text-rose-400' : needsBuy ? 'text-amber-300' : 'text-emerald-400'
                        }`}
                      >
                        {liveConsumable.currentQuantity}
                      </span>
                      <span className="text-[10px] text-zinc-400 block">{liveConsumable.unit}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-[#0d1117] border border-amber-500/30">
                      <span className="text-[10px] text-amber-400 block">Mínimo Aviso</span>
                      <span className="text-xl font-black text-amber-300">{liveConsumable.minStock}</span>
                      <span className="text-[10px] text-zinc-400 block">comprar si ≤ {liveConsumable.minStock}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-[#0d1117] border border-cyan-500/30">
                      <span className="text-[10px] text-cyan-400 block">Pedido Sugerido</span>
                      <span className="text-xl font-black text-cyan-300">
                        {liveConsumable.recommendedOrderQty || Math.max(2, liveConsumable.minStock * 2)}
                      </span>
                      <span className="text-[10px] text-zinc-400 block">{liveConsumable.unit}</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-2.5">
                    <div className="text-[11px] font-bold text-emerald-300">
                      Registrar gasto o compra directamente desde este QR:
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={liveConsumable.currentQuantity <= 0}
                        onClick={() => handleConsumableAdjust('consumed')}
                        className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 font-bold transition cursor-pointer disabled:opacity-40"
                      >
                        <Minus className="w-4 h-4" />
                        <span>-1 Gastado</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleConsumableAdjust('restocked')}
                        className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 font-bold transition cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>+1 Comprado</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400 px-1">
                    <span>
                      Categoría: <strong className="text-zinc-200">{liveConsumable.category}</strong>
                    </span>
                    {liveConsumable.supplier && (
                      <span>
                        Proveedor: <strong className="text-zinc-200">{liveConsumable.supplier}</strong>
                      </span>
                    )}
                    <span>Ubicación: {liveConsumable.locationName}</span>
                  </div>
                </div>
              );
            })()}

            {/* CASE 3: ITEM UNIT OR CATALOG ITEM */}
            {!liveKit && !liveBox && !liveConsumable && (liveUnit || liveItem) && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[#0d1117] border border-[#30363d]">
                  <div>
                    <span className="text-[10px] text-zinc-500 block">Referencia / QR</span>
                    <span className="font-mono font-bold text-amber-300">
                      {liveUnit ? liveUnit.qrCode : liveItem?.qrCode}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block">Ubicación Actual</span>
                    <span className="text-zinc-200 font-semibold">
                      {liveUnit ? liveUnit.locationName : liveItem?.defaultLocationName}
                    </span>
                  </div>
                  {liveUnit && (
                    <>
                      <div>
                        <span className="text-[10px] text-zinc-500 block">Número de Serie</span>
                        <span className="font-mono font-bold text-white">{liveUnit.serialNumber}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 block">Estado Unidad</span>
                        <span className="font-bold uppercase text-emerald-400">{liveUnit.status}</span>
                      </div>
                    </>
                  )}
                </div>

                {liveItem && (
                  <div className="grid grid-cols-4 gap-2 text-center font-mono">
                    <div className="p-2.5 rounded-xl bg-[#0d1117] border border-[#30363d]">
                      <span className="text-[10px] text-zinc-500 block">Total</span>
                      <span className="font-bold text-white text-sm">{liveItem.totalQuantity}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#0d1117] border border-emerald-500/30">
                      <span className="text-[10px] text-emerald-400 block">Disp.</span>
                      <span className="font-bold text-emerald-300 text-sm">{liveItem.availableQuantity}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#0d1117] border border-purple-500/30">
                      <span className="text-[10px] text-purple-400 block">Fuera</span>
                      <span className="font-bold text-purple-300 text-sm">{liveItem.outQuantity}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#0d1117] border border-emerald-500/30">
                      <span className="text-[10px] text-zinc-400 block">Alquiler</span>
                      <span className="font-bold text-amber-300 text-sm">{(liveItem.rentalPrice ?? 0).toFixed(0)}€</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CASE 4: CONTRACT */}
            {contract && (
              <div className="p-3.5 rounded-xl bg-[#0d1117] border border-[#30363d] space-y-2">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Cliente:</span>
                  <strong className="text-white">{contract.clientName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Fecha Evento:</span>
                  <strong className="text-white">{new Date(contract.eventDate).toLocaleDateString('es-ES')}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Total Contrato:</span>
                  <strong className="text-emerald-400 font-mono">{contract.totalAmount.toFixed(2)} €</strong>
                </div>
              </div>
            )}

            {/* CASE 5: UNRECOGNIZED CODE */}
            {!result.isDirectMatch && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                <div className="flex items-center gap-2 text-amber-300 font-bold">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Código QR leído pero no registrado aún en el inventario</span>
                </div>
                <div className="flex items-center justify-between bg-[#0d1117] p-2.5 rounded-lg border border-[#30363d]">
                  <span className="font-mono text-white break-all">{result.rawText}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(result.rawText);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                    className="p-1.5 text-zinc-400 hover:text-white cursor-pointer"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Quick Navigation Actions */}
            {result.isDirectMatch && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-[#30363d]">
                {(liveKit || liveBox || liveConsumable || liveUnit || liveItem) && (
                  <button
                    type="button"
                    onClick={() => setShowPrintSticker(true)}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 font-bold cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Etiqueta QR</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigate('dispatches');
                  }}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 font-bold cursor-pointer"
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Ir a Albaranes</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigate(liveKit || liveBox || liveConsumable ? 'kits_cables' : 'maintenance');
                  }}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-[#30363d] font-bold cursor-pointer"
                >
                  {liveKit || liveBox || liveConsumable ? (
                    <QrCode className="w-3.5 h-3.5" />
                  ) : (
                    <Wrench className="w-3.5 h-3.5 text-rose-400" />
                  )}
                  <span>
                    {liveConsumable ? 'Ver Consumibles' : liveKit || liveBox ? 'Ver Conjuntos' : 'Parte SAT'}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3.5 border-t border-[#30363d] bg-[#0d1117] flex items-center justify-between">
            <button
              type="button"
              onClick={onScanAgain}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Escanear Otro QR</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#30363d] hover:bg-zinc-800 text-zinc-300 text-xs font-semibold cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* Print Sticker Modal right from the scanned screen */}
      {showPrintSticker && (
        <QrBarcodeModal
          isOpen={showPrintSticker}
          onClose={() => setShowPrintSticker(false)}
          item={liveItem}
          unit={liveUnit}
          kit={liveKit}
          cableBox={liveBox}
          consumable={liveConsumable}
        />
      )}
    </>
  );
};
