import React, { useState, useRef } from 'react';
import {
  ShoppingCart,
  Plus,
  Trash2,
  CheckCircle,
  Truck,
  ArrowDownLeft,
  Calendar,
  DollarSign,
  AlertCircle,
  Camera,
  Upload,
  Eye,
  X,
  FileText,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { Purchase, PurchaseLine } from '../../types/inventory.ts';
import { useInventory } from '../../context/InventoryContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';

export const PurchasesView: React.FC = () => {
  const { purchases, items, suppliers, locations, registerPurchase, updatePurchaseDeliveryNote, reportDamageFromPurchase } = useInventory();
  const { userProfile, canManagePurchases } = useAuth();

  // Create Purchase Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const [orderNumber, setOrderNumber] = useState(
    `PED-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`
  );
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState('');
  const [deliveryNotePhotoUrl, setDeliveryNotePhotoUrl] = useState<string | null>(null);
  const [targetLocationId, setTargetLocationId] = useState(locations[0]?.id || '');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<PurchaseLine[]>([
    {
      itemId: items[0]?.id || '',
      itemName: items[0]?.name || '',
      itemCode: items[0]?.code || '',
      quantity: 1,
      unitPrice: items[0]?.purchasePrice || 0,
      totalPrice: items[0]?.purchasePrice || 0,
    },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Delivery Note Inspection Modal State
  const [inspectingPurchase, setInspectingPurchase] = useState<Purchase | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Damage reporting to SAT Modal State
  const [damageModalPurchase, setDamageModalPurchase] = useState<Purchase | null>(null);
  const [damageItemId, setDamageItemId] = useState<string>('');
  const [damageQuantity, setDamageQuantity] = useState<number>(1);
  const [damageDescription, setDamageDescription] = useState<string>('');
  const [isReportingDamage, setIsReportingDamage] = useState(false);
  const [damageSuccess, setDamageSuccess] = useState<string | null>(null);

  // Hidden file inputs for direct camera capture & disk upload
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachToPurchaseCameraRef = useRef<HTMLInputElement>(null);
  const [attachingToPurchaseId, setAttachingToPurchaseId] = useState<string | null>(null);

  const handleCapturePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setDeliveryNotePhotoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
    // Reset input so user can choose the same file again if desired
    e.target.value = '';
  };

  const handleAttachPhotoDirectly = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !attachingToPurchaseId) return;

    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === 'string') {
        await updatePurchaseDeliveryNote(attachingToPurchaseId, reader.result);
        setAttachingToPurchaseId(null);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAddLine = () => {
    const first = items[0];
    if (!first) return;
    setLines([
      ...lines,
      {
        itemId: first.id,
        itemName: first.name,
        itemCode: first.code,
        quantity: 1,
        unitPrice: first.purchasePrice || 0,
        totalPrice: first.purchasePrice || 0,
      },
    ]);
  };

  const handleRemoveLine = (idx: number) => {
    setLines(lines.filter((_, i) => i !== idx));
  };

  const handleLineChange = (idx: number, field: keyof PurchaseLine, val: any) => {
    const updated = [...lines];
    if (field === 'itemId') {
      const it = items.find((i) => i.id === val);
      if (it) {
        updated[idx].itemId = it.id;
        updated[idx].itemName = it.name;
        updated[idx].itemCode = it.code;
        updated[idx].unitPrice = it.purchasePrice || 0;
        updated[idx].totalPrice = (it.purchasePrice || 0) * updated[idx].quantity;
      }
    } else if (field === 'quantity') {
      const q = Math.max(1, Number(val));
      updated[idx].quantity = q;
      updated[idx].totalPrice = q * updated[idx].unitPrice;
    } else if (field === 'unitPrice') {
      const p = Math.max(0, Number(val));
      updated[idx].unitPrice = p;
      updated[idx].totalPrice = updated[idx].quantity * p;
    }
    setLines(updated);
  };

  const grandTotal = lines.reduce((acc, l) => acc + l.totalPrice, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lines.length === 0) {
      setError('Añade al menos un artículo a la recepción.');
      return;
    }
    if (submitting) return;

    try {
      setSubmitting(true);
      setError(null);

      const supp = suppliers.find((s) => s.id === supplierId);
      const loc = locations.find((l) => l.id === targetLocationId);

      await registerPurchase({
        orderNumber: orderNumber.trim(),
        deliveryNoteNumber: deliveryNoteNumber.trim() || undefined,
        deliveryNotePhotoUrl: deliveryNotePhotoUrl || undefined,
        supplierId,
        supplierName: supp ? supp.name : 'Proveedor General',
        date: new Date().toISOString(),
        totalAmount: grandTotal,
        targetLocationId,
        targetLocationName: loc ? `${loc.warehouse} - ${loc.zone}` : 'Nave Central',
        responsibleUser: userProfile?.name || 'Responsable de Compras',
        notes: notes.trim(),
        items: lines,
      });

      setIsModalOpen(false);
      setOrderNumber(`PED-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
      setDeliveryNoteNumber('');
      setDeliveryNotePhotoUrl(null);
      setNotes('');
    } catch (err: any) {
      setError(err.message || 'Error al procesar la compra.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Hidden native camera/file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCapturePhoto}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        onChange={handleCapturePhoto}
        className="hidden"
      />
      <input
        ref={attachToPurchaseCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleAttachPhotoDirectly}
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#30363d]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-amber-400" />
            Compras y Recepción de Mercancía
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono font-medium">
              {purchases.length} recepciones
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Recepción física con foto del albarán de entrega, control de números de serie y entrada inmediata en inventario.
          </p>
        </div>

        {canManagePurchases && (
          <button
            onClick={() => {
              setDeliveryNotePhotoUrl(null);
              setDeliveryNoteNumber('');
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Entrada / Albarán Compra</span>
          </button>
        )}
      </div>

      {/* History */}
      <div className="space-y-3">
        {purchases.length === 0 ? (
          <div className="text-center py-16 bg-[#161b22] border border-[#30363d] rounded-xl text-zinc-400">
            <ShoppingCart className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-zinc-200">No hay entradas de compra registradas</h3>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
              Registra los pedidos o facturas de proveedores para incorporar automáticamente las unidades al stock disponible con su albarán fotográfico.
            </p>
          </div>
        ) : (
          purchases.map((pur) => (
            <div
              key={pur.id}
              className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs transition hover:border-[#484f58]"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-bold text-amber-400 text-sm">{pur.orderNumber}</span>
                  {pur.deliveryNoteNumber && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono border border-zinc-700">
                      Albarán Prov: {pur.deliveryNoteNumber}
                    </span>
                  )}
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                    Recepción Confirmada
                  </span>

                  {pur.deliveryNotePhotoUrl ? (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 font-bold border border-cyan-800/60 flex items-center gap-1">
                      <Camera className="w-3 h-3 text-cyan-400" />
                      Albarán Fotografiado
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/40 text-amber-300 font-medium border border-amber-800/40">
                      Sin foto de albarán
                    </span>
                  )}
                </div>

                <div className="font-bold text-white text-sm">Proveedor: {pur.supplierName}</div>
                <div className="text-zinc-400">
                  Ubicación destino: <strong>{pur.targetLocationName}</strong> • Responsable:{' '}
                  <strong>{pur.responsibleUser}</strong>
                </div>
                {pur.notes && <div className="text-[11px] text-zinc-500 italic">{pur.notes}</div>}
              </div>

              <div className="flex flex-wrap items-center gap-5 border-t md:border-t-0 md:border-l border-[#30363d] pt-3 md:pt-0 md:pl-5">
                <div>
                  <span className="text-[10px] text-zinc-500 block uppercase font-mono">Fecha Entrada</span>
                  <span className="text-zinc-200 font-mono">
                    {new Date(pur.date).toLocaleDateString('es-ES')}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-500 block uppercase font-mono">Artículos</span>
                  <span className="text-white font-mono font-bold">
                    {pur.items.reduce((acc, i) => acc + i.quantity, 0)} uds
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-zinc-500 block uppercase font-mono">Importe Total</span>
                  <span className="text-emerald-400 font-mono font-bold text-sm">
                    {pur.totalAmount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                  </span>
                </div>

                {/* Delivery Note Action Button */}
                <div className="flex items-center gap-2">
                  {pur.deliveryNotePhotoUrl ? (
                    <button
                      onClick={() => {
                        setInspectingPurchase(pur);
                        setZoomLevel(1);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/50 hover:bg-cyan-900/60 border border-cyan-700/60 text-cyan-300 font-bold transition shadow-sm cursor-pointer"
                      title="Ver albarán de entrega fotografiado"
                    >
                      <Eye className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Ver Albarán</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setAttachingToPurchaseId(pur.id);
                        attachToPurchaseCameraRef.current?.click();
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-amber-500/30 font-semibold transition cursor-pointer"
                      title="Fotografiar el albarán físico con el móvil"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Echar Foto Albarán</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setDamageModalPurchase(pur);
                      setDamageItemId(pur.items[0]?.itemId || '');
                      setDamageQuantity(1);
                      setDamageDescription('');
                      setDamageSuccess(null);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold transition cursor-pointer"
                    title="Reportar material roto o dañado al recibir la compra"
                  >
                    <Wrench className="w-3.5 h-3.5 text-rose-400" />
                    <span>Reportar Avería</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Purchase Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-[#30363d] flex items-center justify-between">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-amber-400" />
                <span>Recepción de Material y Albarán de Llegada</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mx-5 mt-4 p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-5 text-xs flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">Nº Registro Interno *</label>
                  <input
                    type="text"
                    required
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">Proveedor / Fabricante *</label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">Ubicación de Almacenamiento *</label>
                  <select
                    value={targetLocationId}
                    onChange={(e) => setTargetLocationId(e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100"
                  >
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.warehouse} — {l.zone}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Delivery Note Section (Foto del Albarán de Llegada) */}
              <div className="p-4 rounded-xl bg-[#0d1117] border border-[#30363d] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="font-bold text-white text-xs flex items-center gap-2">
                      <Camera className="w-4 h-4 text-amber-400" />
                      <span>Albarán Físico de Llegada del Transportista</span>
                    </span>
                    <p className="text-[11px] text-zinc-400">
                      Fotografía directamente con la cámara del teléfono o sube el justificante de entrega.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-md transition cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Echar Foto al Albarán</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-[#30363d] font-semibold text-xs transition cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Subir Archivo</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-zinc-400 text-[11px] font-semibold mb-1">
                      Nº Albarán del Proveedor (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: ALB-EARPRO-94821"
                      value={deliveryNoteNumber}
                      onChange={(e) => setDeliveryNoteNumber(e.target.value)}
                      className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-1.5 text-zinc-100 font-mono"
                    />
                  </div>

                  <div>
                    {deliveryNotePhotoUrl ? (
                      <div className="p-2.5 rounded-lg bg-[#161b22] border border-emerald-500/40 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <img
                            src={deliveryNotePhotoUrl}
                            alt="Albarán capturado"
                            className="w-10 h-10 object-cover rounded border border-[#30363d] shrink-0"
                          />
                          <div className="truncate">
                            <span className="font-bold text-emerald-400 text-[11px] block truncate">
                              ✓ Albarán fotografiado
                            </span>
                            <span className="text-[10px] text-zinc-400 block truncate font-mono">
                              Listo para adjuntar
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const w = window.open('');
                              if (w) {
                                w.document.write(`<img src="${deliveryNotePhotoUrl}" style="max-width:100%;height:auto;"/>`);
                              }
                            }}
                            className="p-1.5 rounded hover:bg-zinc-700 text-zinc-300"
                            title="Ver ampliado"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeliveryNotePhotoUrl(null)}
                            className="p-1.5 rounded hover:bg-rose-950/60 text-zinc-400 hover:text-rose-400"
                            title="Eliminar foto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-lg bg-[#161b22] border border-dashed border-[#30363d] text-zinc-500 text-center flex items-center justify-center gap-2">
                        <FileText className="w-4 h-4 text-zinc-600" />
                        <span>Sin albarán adjunto todavía</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Items Lines */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white block">Artículos Recibidos:</span>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="flex items-center gap-1 text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Añadir Otra Línea</span>
                  </button>
                </div>

                <div className="border border-[#30363d] rounded-xl overflow-hidden bg-[#0d1117] divide-y divide-[#30363d]">
                  {lines.map((l, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <select
                          value={l.itemId}
                          onChange={(e) => handleLineChange(idx, 'itemId', e.target.value)}
                          className="w-full bg-[#161b22] border border-[#30363d] rounded px-2.5 py-1.5 text-zinc-100"
                        >
                          {items.map((i) => (
                            <option key={i.id} value={i.id}>
                              [{i.group || i.category}] {i.name} ({i.code})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-24">
                        <input
                          type="number"
                          min="1"
                          placeholder="Cantidad"
                          value={l.quantity}
                          onChange={(e) => handleLineChange(idx, 'quantity', e.target.value)}
                          className="w-full bg-[#161b22] border border-[#30363d] rounded px-2 py-1.5 text-center font-bold text-white"
                        />
                      </div>

                      <div className="w-28">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Precio €"
                          value={l.unitPrice}
                          onChange={(e) => handleLineChange(idx, 'unitPrice', e.target.value)}
                          className="w-full bg-[#161b22] border border-[#30363d] rounded px-2 py-1.5 text-right font-mono text-zinc-100"
                        />
                      </div>

                      <div className="w-28 text-right font-mono font-bold text-emerald-400">
                        {l.totalPrice.toFixed(2)} €
                      </div>

                      {lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="p-1 text-zinc-500 hover:text-rose-400 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2 text-sm font-bold">
                  <span className="text-zinc-400">Importe Total Compra:</span>
                  <span className="text-emerald-400 font-mono text-base">{grandTotal.toFixed(2)} €</span>
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Observaciones</label>
                <input
                  type="text"
                  placeholder="Transportista, estado del embalaje exterior, precintos, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100"
                />
              </div>

              <div className="pt-3 border-t border-[#30363d] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-[#30363d] text-zinc-400 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold flex items-center gap-1.5 shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  <span>{submitting ? 'Confirmando...' : 'Confirmar Entrada en Almacén'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inspect Delivery Note Photo Modal */}
      {inspectingPurchase && inspectingPurchase.deliveryNotePhotoUrl && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-4xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-[#30363d] flex items-center justify-between bg-[#0d1117]">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Camera className="w-5 h-5 text-amber-400" />
                  <span>Albarán de Llegada: {inspectingPurchase.orderNumber}</span>
                </h3>
                <p className="text-xs text-zinc-400">
                  Proveedor: <strong>{inspectingPurchase.supplierName}</strong>
                  {inspectingPurchase.deliveryNoteNumber && ` • Nº Albarán: ${inspectingPurchase.deliveryNoteNumber}`}
                  {' • '}Fecha: {new Date(inspectingPurchase.date).toLocaleDateString('es-ES')}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                  className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-[#30363d]"
                  title="Alejar"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                  className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-[#30363d]"
                  title="Acercar"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setZoomLevel(1)}
                  className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-[#30363d]"
                  title="Restablecer tamaño"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <a
                  href={inspectingPurchase.deliveryNotePhotoUrl}
                  download={`albaran-${inspectingPurchase.orderNumber}.jpg`}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition ml-2"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar</span>
                </a>

                <button
                  onClick={() => setInspectingPurchase(null)}
                  className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition ml-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 overflow-auto flex-1 flex items-center justify-center bg-zinc-950 min-h-[400px]">
              <div
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.15s ease-out',
                }}
                className="max-w-full max-h-full"
              >
                <img
                  src={inspectingPurchase.deliveryNotePhotoUrl}
                  alt="Albarán de llegada fotografiado"
                  className="max-h-[70vh] w-auto object-contain rounded-lg shadow-2xl border border-zinc-800"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Damage Report to SAT Modal */}
      {damageModalPurchase && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#30363d] pb-3">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-rose-400" />
                <h3 className="font-bold text-white text-base">Reportar Daño / Avería a Taller SAT</h3>
              </div>
              <button
                type="button"
                onClick={() => setDamageModalPurchase(null)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {damageSuccess && (
              <div className="p-3 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{damageSuccess}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <p className="text-zinc-400">
                Registra el material recibido roto o golpeado de la compra <strong>{damageModalPurchase.orderNumber}</strong> ({damageModalPurchase.supplierName}). El equipo se marcará como averiado y se abrirá una incidencia inmediata en el taller técnico.
              </p>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Artículo Dañado *</label>
                <select
                  value={damageItemId}
                  onChange={(e) => setDamageItemId(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-200"
                >
                  {damageModalPurchase.items.map((line) => (
                    <option key={line.itemId} value={line.itemId}>
                      [{line.itemCode}] {line.itemName} (Recibidas: {line.quantity})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Cantidad con Daños *</label>
                <input
                  type="number"
                  min="1"
                  max={damageModalPurchase.items.find((l) => l.itemId === damageItemId)?.quantity || 1}
                  value={damageQuantity}
                  onChange={(e) => setDamageQuantity(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-200"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Descripción del Daño / Rotura *</label>
                <textarea
                  required
                  rows={3}
                  value={damageDescription}
                  onChange={(e) => setDamageDescription(e.target.value)}
                  placeholder="Ej. Embalaje roto en transporte, potenciómetro partido o carcasa abollada..."
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-[#30363d] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDamageModalPurchase(null)}
                className="px-4 py-2 rounded-lg border border-[#30363d] text-zinc-400 hover:text-white text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isReportingDamage || !damageDescription.trim()}
                onClick={async () => {
                  try {
                    setIsReportingDamage(true);
                    await reportDamageFromPurchase(
                      damageModalPurchase.id,
                      damageItemId,
                      damageQuantity,
                      damageDescription.trim()
                    );
                    setDamageSuccess('✓ Incidencia abierta y equipo enviado a Taller SAT.');
                    setTimeout(() => {
                      setDamageModalPurchase(null);
                      setDamageSuccess(null);
                    }, 1800);
                  } catch (e: any) {
                    alert(e.message || 'Error al reportar avería');
                  } finally {
                    setIsReportingDamage(false);
                  }
                }}
                className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>{isReportingDamage ? 'Enviando a SAT...' : 'Abrir Incidencia en SAT'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
