import React, { useState } from 'react';
import {
  Truck,
  Plus,
  Printer,
  Calendar,
  CheckCircle,
  AlertTriangle,
  QrCode,
  FileText,
  User,
  Clock,
  Boxes,
  Camera,
  Trash2,
  PenTool,
  CheckCircle2,
  ShieldCheck,
  Search,
  PackagePlus,
  RotateCcw,
  Wrench,
} from 'lucide-react';
import { DispatchNote, Item, ItemUnit } from '../../types/inventory.ts';
import { useInventory } from '../../context/InventoryContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { TabletSignatureModal } from './TabletSignatureModal.tsx';
import { QrPhotoScannerModal } from '../maintenance/QrPhotoScannerModal.tsx';
import { DirectDamageReportModal } from '../maintenance/DirectDamageReportModal.tsx';

interface DispatchesViewProps {
  initialEventId?: string | null;
  onClearInitialEvent?: () => void;
}

export const DispatchesView: React.FC<DispatchesViewProps> = ({
  initialEventId,
  onClearInitialEvent,
}) => {
  const {
    events,
    eventItems,
    items,
    itemUnits,
    dispatches,
    processDispatch,
    saveDispatchSignature,
    removeItemFromDispatch,
    addItemToDispatch,
  } = useInventory();
  const { userProfile, canAuthorizeDispatches } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(Boolean(initialEventId));
  const [selectedEventId, setSelectedEventId] = useState(
    initialEventId || events.filter((e) => ['confirmed', 'preparing', 'prepared'].includes(e.status))[0]?.id || ''
  );

  const [preparedBy, setPreparedBy] = useState(userProfile?.name || 'Técnico Almacén');
  const [authorizedBy, setAuthorizedBy] = useState('Administrador (Jefe de Almacén)');
  const [notes, setNotes] = useState('');

  // Dispatch lines can contain items from event rider AND extra scanned/added items!
  const [dispatchLines, setDispatchLines] = useState<
    Record<
      string,
      {
        itemId: string;
        itemName: string;
        itemCode: string;
        quantity: number;
        unitSerialNumbers: string[];
        isExtra?: boolean;
      }
    >
  >({});
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [scanSuccessMessage, setScanSuccessMessage] = useState<string | null>(null);

  // Extra item manual adder
  const [extraItemId, setExtraItemId] = useState<string>('');

  // Modals state
  const [noteToPrint, setNoteToPrint] = useState<DispatchNote | null>(null);
  const [signatureDispatch, setSignatureDispatch] = useState<DispatchNote | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isDamageModalOpen, setIsDamageModalOpen] = useState(false);

  // Manage existing dispatch items modal
  const [manageDispatch, setManageDispatch] = useState<DispatchNote | null>(null);

  const selectedEvent = events.find((e) => e.id === selectedEventId);
  const selectedEventLines = eventItems.filter((l) => l.eventId === selectedEventId);

  // Initialize or update dispatch quantities when event changes
  const handleEventChange = (evId: string) => {
    setSelectedEventId(evId);
    const targetLines = eventItems.filter((l) => l.eventId === evId);
    const initialLines: typeof dispatchLines = {};

    targetLines.forEach((l) => {
      const it = items.find((i) => i.id === l.itemId);
      const remainingToShip = Math.max(0, l.quantityRequested - l.quantityDispatched);
      const matchingUnits = itemUnits
        .filter((u) => u.itemId === l.itemId && (u.status === 'available' || u.status === 'reserved'))
        .slice(0, remainingToShip)
        .map((u) => u.serialNumber);

      initialLines[l.itemId] = {
        itemId: l.itemId,
        itemName: l.itemName,
        itemCode: l.itemCode,
        quantity: remainingToShip,
        unitSerialNumbers: matchingUnits,
        isExtra: false,
      };
    });

    setDispatchLines(initialLines);
  };

  const handleOpenDispatchModal = (evId?: string) => {
    const target = evId || selectedEventId;
    handleEventChange(target);
    setIsModalOpen(true);
  };

  // Add extra material manually
  const handleAddExtraItem = () => {
    if (!extraItemId) return;
    const it = items.find((i) => i.id === extraItemId);
    if (!it) return;

    setDispatchLines((prev) => {
      const existing = prev[it.id];
      const newQty = existing ? existing.quantity + 1 : 1;
      return {
        ...prev,
        [it.id]: {
          itemId: it.id,
          itemName: it.name,
          itemCode: it.code,
          quantity: newQty,
          unitSerialNumbers: existing ? existing.unitSerialNumbers : [],
          isExtra: true,
        },
      };
    });

    setExtraItemId('');
    setScanSuccessMessage(`✓ Añadido material extra: ${it.name}`);
    setTimeout(() => setScanSuccessMessage(null), 3000);
  };

  // Handle scanned QR/Barcode item
  const handleScanUnitResult = (result: {
    unit: ItemUnit | null;
    item: Item | null;
    serialNumber: string;
  }) => {
    const targetItem = result.item || items.find((i) => i.id === result.unit?.itemId);
    if (!targetItem) {
      setDispatchError('Código QR escaneado no coincide con ningún artículo del catálogo.');
      return;
    }

    setDispatchLines((prev) => {
      const existing = prev[targetItem.id];
      const newQty = (existing?.quantity || 0) + 1;
      const serials = existing ? [...existing.unitSerialNumbers] : [];

      if (result.serialNumber && !serials.includes(result.serialNumber)) {
        serials.push(result.serialNumber);
      }

      return {
        ...prev,
        [targetItem.id]: {
          itemId: targetItem.id,
          itemName: targetItem.name,
          itemCode: targetItem.code,
          quantity: newQty,
          unitSerialNumbers: serials,
          isExtra: !selectedEventLines.some((l) => l.itemId === targetItem.id),
        },
      };
    });

    setScanSuccessMessage(
      `✓ Escaneado con éxito: ${targetItem.name} ${result.serialNumber ? `(N/S: ${result.serialNumber})` : ''} añadido al albarán.`
    );
    setTimeout(() => setScanSuccessMessage(null), 4000);
    setIsScannerOpen(false);
  };

  // Remove line from dispatch preparation
  const handleRemoveLineFromDispatch = (itemId: string) => {
    setDispatchLines((prev) => {
      const copy = { ...prev };
      delete copy[itemId];
      return copy;
    });
  };

  const handleExecuteDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;

    try {
      setDispatchError(null);

      const preparedItems = Object.values(dispatchLines).map((data) => ({
        itemId: data.itemId,
        quantity: data.quantity,
        unitSerialNumbers: data.unitSerialNumbers,
      }));

      const totalShipped = preparedItems.reduce((acc, p) => acc + p.quantity, 0);
      if (totalShipped <= 0) {
        setDispatchError('Debes indicar al menos una unidad a retirar para generar la salida.');
        return;
      }

      const note = await processDispatch(
        selectedEvent.id,
        preparedItems,
        preparedBy,
        authorizedBy,
        notes
      );

      setIsModalOpen(false);
      if (onClearInitialEvent) onClearInitialEvent();
      setNoteToPrint(note);
    } catch (err: any) {
      setDispatchError(err.message || 'Error al procesar la salida de material.');
    }
  };

  // Handle signature save
  const handleSaveSignature = async (
    signatureDataUrl: string,
    signerName: string,
    signerDni?: string
  ) => {
    if (!signatureDispatch) return;
    await saveDispatchSignature(
      signatureDispatch.id,
      signatureDataUrl,
      signerName,
      signerDni || ''
    );

    // Update local state if currently viewing note
    if (noteToPrint && noteToPrint.id === signatureDispatch.id) {
      setNoteToPrint({
        ...noteToPrint,
        clientSignatureUrl: signatureDataUrl,
        signerName,
        signerDni,
        signedAt: new Date().toISOString(),
      });
    }

    setSignatureDispatch(null);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#30363d] no-print">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Truck className="w-6 h-6 text-amber-400" />
            <span>Salidas de Almacén y Albaranes Oficiales</span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            Picking físico, escaneo de material con cámara, firma en tablet y emisión de albaranes de salida.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsDamageModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 font-bold text-xs transition cursor-pointer"
            title="Reportar material roto o dañado durante la expedición directamente a Averías / SAT"
          >
            <Wrench className="w-4 h-4 text-rose-400" />
            <span>Reportar Avería a SAT</span>
          </button>

          <button
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-bold text-xs transition cursor-pointer"
            title="Escanear material con cámara QR para añadir a albaranes"
          >
            <Camera className="w-4 h-4" />
            <span>Escanear Material con Cámara</span>
          </button>

          {canAuthorizeDispatches && (
            <button
              onClick={() => handleOpenDispatchModal()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Preparar Salida</span>
            </button>
          )}
        </div>
      </div>

      {/* Dispatches List */}
      <div className="space-y-3 no-print">
        {dispatches.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 bg-[#161b22] border border-[#30363d] rounded-2xl">
            <Truck className="w-10 h-10 mx-auto text-zinc-600 mb-2" />
            <p className="font-semibold text-zinc-300">No hay salidas registradas todavía</p>
            <p className="text-xs mt-1">
              Las salidas se generan automáticamente al confirmar contratos o pulsando "Preparar Salida".
            </p>
          </div>
        ) : (
          dispatches.map((disp) => (
            <div
              key={disp.id}
              className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-zinc-500 transition"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-xs shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-amber-400 text-sm">{disp.code}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase font-mono ${
                        disp.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {disp.status === 'completed' ? 'Expedido / Completado' : 'Pendiente de Salida'}
                    </span>
                    {disp.clientSignatureUrl && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-blue-400" />
                        <span>Firmado en Tablet ({disp.signerName})</span>
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-white text-sm mt-0.5">{disp.eventName}</h3>
                  <div className="text-xs text-zinc-400 flex flex-wrap items-center gap-2 mt-1">
                    <span>Cliente: {disp.clientName}</span>
                    <span>•</span>
                    <span>
                      Fecha:{' '}
                      {new Date(disp.dispatchDate).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    <span>•</span>
                    <span>Preparado por: {disp.preparedBy}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-zinc-500 block uppercase font-mono">Bultos / Unidades</span>
                  <span className="text-white font-mono font-bold">
                    {disp.items.reduce((acc, i) => acc + i.quantity, 0)} uds
                  </span>
                </div>

                {disp.status === 'preparing' && (
                  <button
                    onClick={() => handleOpenDispatchModal(disp.eventId)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold transition shadow-sm cursor-pointer"
                    title="Realizar picking de material y registrar salida física"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>Preparar Salida</span>
                  </button>
                )}

                {/* Tablet Signature Button */}
                <button
                  onClick={() => setSignatureDispatch(disp)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    disp.clientSignatureUrl
                      ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40'
                      : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                  }`}
                  title="Firmar albarán digitalmente en tablet"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>{disp.clientSignatureUrl ? 'Re-firmar en Tablet' : 'Firmar en Tablet'}</span>
                </button>

                {/* Manage / Return Items Button */}
                <button
                  onClick={() => setManageDispatch(disp)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-[#30363d] text-xs font-semibold cursor-pointer"
                  title="Gestionar o retirar material del albarán"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                  <span>Retirar Material</span>
                </button>

                <button
                  onClick={() => setNoteToPrint(disp)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-[#30363d] font-semibold transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-400" />
                  <span>Ver Albarán</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Prepare Dispatch Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-[#30363d] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-bold text-white">Preparar y Expedir Salida de Almacén</h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExecuteDispatch} className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
              {dispatchError && (
                <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{dispatchError}</span>
                </div>
              )}

              {scanSuccessMessage && (
                <div className="p-3 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-2 font-semibold animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{scanSuccessMessage}</span>
                </div>
              )}

              {/* Event selection */}
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Evento de Destino *</label>
                <select
                  value={selectedEventId}
                  onChange={(e) => handleEventChange(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 font-semibold"
                >
                  {events
                    .filter((e) => !['closed', 'cancelled'].includes(e.status))
                    .map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        [{ev.code}] {ev.name} — {ev.clientName} (Salida: {new Date(ev.dispatchDate).toLocaleDateString()})
                      </option>
                    ))}
                </select>
              </div>

              {/* Barcode / QR Scan Button inside Dispatch */}
              <div className="p-3 rounded-xl bg-linear-to-r from-cyan-950/30 to-amber-950/20 border border-cyan-500/30 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-white text-xs block flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-cyan-400" />
                    ¿Quieres escanear material directamente con la cámara?
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    Añade cualquier equipo o número de serie escaneando el código QR, incluso si no estaba en el rider inicial.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs flex items-center gap-1.5 transition shrink-0 cursor-pointer shadow-md"
                >
                  <Camera className="w-4 h-4" />
                  <span>Abrir Escáner QR</span>
                </button>
              </div>

              {/* Extra item manual selector */}
              <div className="p-3 rounded-xl bg-[#0d1117] border border-[#30363d] space-y-2">
                <span className="text-[11px] text-zinc-300 font-semibold block">
                  Añadir material extra de almacén al albarán:
                </span>
                <div className="flex gap-2">
                  <select
                    value={extraItemId}
                    onChange={(e) => setExtraItemId(e.target.value)}
                    className="flex-1 bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-1.5 text-zinc-200 text-xs"
                  >
                    <option value="">Selecciona un equipo de almacén...</option>
                    {items
                      .filter((i) => i.totalQuantity - i.outQuantity - i.damagedQuantity > 0)
                      .map((it) => (
                        <option key={it.id} value={it.id}>
                          [{it.code}] {it.name} (Disp: {it.totalQuantity - it.outQuantity - it.damagedQuantity})
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddExtraItem}
                    disabled={!extraItemId}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Añadir
                  </button>
                </div>
              </div>

              {/* Material Lines Selection */}
              <div className="space-y-2">
                <span className="font-bold text-white block">
                  Material Seleccionado para Salida ({Object.keys(dispatchLines).length} líneas):
                </span>

                {Object.keys(dispatchLines).length === 0 ? (
                  <p className="text-zinc-500 py-3 text-center bg-[#0d1117] rounded-lg border border-[#30363d]">
                    No hay material seleccionado. Utiliza el botón de escaneo con cámara o selecciona un artículo extra.
                  </p>
                ) : (
                  <div className="border border-[#30363d] rounded-xl overflow-hidden bg-[#0d1117] divide-y divide-[#30363d]">
                    {Object.values(dispatchLines).map((line) => {
                      const item = items.find((i) => i.id === line.itemId);
                      const maxPossible = Math.max(
                        0,
                        (item?.totalQuantity || 0) - (item?.outQuantity || 0) - (item?.damagedQuantity || 0)
                      );
                      const serializedUnits = itemUnits.filter(
                        (u) => u.itemId === line.itemId && (u.status === 'available' || u.status === 'reserved')
                      );

                      return (
                        <div key={line.itemId} className="p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-mono text-amber-400 font-bold">{line.itemCode}</span>
                              <span className="text-white font-semibold ml-2">{line.itemName}</span>
                              {line.isExtra && (
                                <span className="text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.5 rounded ml-2 font-bold">
                                  Extra / Escaneado
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-zinc-400">Cantidad:</span>
                              <input
                                type="number"
                                min="0"
                                max={maxPossible}
                                value={line.quantity}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setDispatchLines({
                                    ...dispatchLines,
                                    [line.itemId]: {
                                      ...line,
                                      quantity: val,
                                    },
                                  });
                                }}
                                className="w-16 bg-[#161b22] border border-[#30363d] rounded px-2 py-1 text-center font-bold text-white"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveLineFromDispatch(line.itemId)}
                                className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded transition cursor-pointer"
                                title="Retirar este artículo de la salida"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Serial Numbers assignment if serialized */}
                          {item?.hasSerialNumbers && serializedUnits.length > 0 && line.quantity > 0 && (
                            <div className="pt-2 border-t border-[#30363d]/50 flex flex-wrap items-center gap-2">
                              <span className="text-[11px] text-zinc-400 font-semibold flex items-center gap-1">
                                <QrCode className="w-3.5 h-3.5 text-amber-400" />
                                N/S Asignados ({line.unitSerialNumbers.length}/{line.quantity}):
                              </span>
                              {serializedUnits.map((u) => {
                                const isSelected = line.unitSerialNumbers.includes(u.serialNumber);
                                return (
                                  <button
                                    key={u.id}
                                    type="button"
                                    onClick={() => {
                                      const updated = isSelected
                                        ? line.unitSerialNumbers.filter((s) => s !== u.serialNumber)
                                        : [...line.unitSerialNumbers, u.serialNumber].slice(0, line.quantity);

                                      setDispatchLines({
                                        ...dispatchLines,
                                        [line.itemId]: {
                                          ...line,
                                          unitSerialNumbers: updated,
                                        },
                                      });
                                    }}
                                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition cursor-pointer ${
                                      isSelected
                                        ? 'bg-amber-500 text-black border border-amber-400'
                                        : 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:border-zinc-500'
                                    }`}
                                  >
                                    {u.serialNumber}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Responsibles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">Técnico que Prepara el Material *</label>
                  <input
                    type="text"
                    required
                    value={preparedBy}
                    onChange={(e) => setPreparedBy(e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">Autorizado por (Jefe de Almacén) *</label>
                  <input
                    type="text"
                    required
                    value={authorizedBy}
                    onChange={(e) => setAuthorizedBy(e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Observaciones en Albarán</label>
                <input
                  type="text"
                  placeholder="Transportista, matrícula camión, muelle de carga..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100"
                />
              </div>

              <div className="pt-3 border-t border-[#30363d] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[#30363d] text-zinc-300 hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={Object.keys(dispatchLines).length === 0}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold shadow-lg shadow-amber-500/20 transition cursor-pointer"
                >
                  <Truck className="w-4 h-4" />
                  <span>Confirmar Salida y Expedir Albarán</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Retirar Material Modal for Issued Dispatches */}
      {manageDispatch && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#30363d] pb-3">
              <div>
                <h3 className="font-bold text-white text-sm">
                  Retirar Material del Albarán {manageDispatch.code}
                </h3>
                <span className="text-[11px] text-zinc-400">
                  El material retirado volverá inmediatamente al stock disponible de almacén.
                </span>
              </div>
              <button
                onClick={() => setManageDispatch(null)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto divide-y divide-[#30363d]">
              {manageDispatch.items.map((item) => (
                <div key={item.itemId} className="pt-2 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-white block">{item.itemName}</span>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      Ref: {item.itemCode} • En albarán: {item.quantity} uds
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await removeItemFromDispatch(manageDispatch.id, item.itemId, 1);
                        setManageDispatch((prev) =>
                          prev
                            ? {
                                ...prev,
                                items: prev.items
                                  .map((i) =>
                                    i.itemId === item.itemId ? { ...i, quantity: i.quantity - 1 } : i
                                  )
                                  .filter((i) => i.quantity > 0),
                              }
                            : null
                        );
                      }}
                      className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-amber-300 font-bold"
                      title="Retirar 1 unidad"
                    >
                      -1 ud
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await removeItemFromDispatch(manageDispatch.id, item.itemId, item.quantity);
                        setManageDispatch((prev) =>
                          prev
                            ? {
                                ...prev,
                                items: prev.items.filter((i) => i.itemId !== item.itemId),
                              }
                            : null
                        );
                      }}
                      className="px-2.5 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 font-bold"
                      title="Retirar partida completa"
                    >
                      Quitar Todo
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-[#30363d] flex justify-end">
              <button
                onClick={() => setManageDispatch(null)}
                className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Delivery Note (Albarán de Salida Imprimible) */}
      {noteToPrint && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-zinc-900 rounded-2xl w-full max-w-3xl p-8 space-y-6 shadow-2xl printable-document">
            {/* Top Bar for Screen */}
            <div className="flex items-center justify-between border-b pb-4 no-print">
              <span className="font-bold text-lg text-zinc-800">Albarán Oficial de Salida de Material</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSignatureDispatch(noteToPrint)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>{noteToPrint.clientSignatureUrl ? 'Cambiar Firma Tablet' : 'Firmar en Tablet'}</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 text-black font-bold text-xs shadow-md transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir / Guardar PDF</span>
                </button>
                <button
                  onClick={() => setNoteToPrint(null)}
                  className="px-3 py-2 rounded-lg border border-zinc-300 text-zinc-700 text-xs hover:bg-zinc-100 cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>

            {/* Document Header - Strict user requirement: Only JD Logo, ALB-OUT-2026-00X and Date */}
            <div className="flex items-center justify-between border-b pb-5">
              <div className="flex items-center gap-3">
                <img
                  src="/assets/logo_transparent.png"
                  alt="JD Sonido e Iluminación"
                  className="h-16 w-auto object-contain drop-shadow-xs"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/assets/logo_jd.png';
                  }}
                />
                <div>
                  <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono uppercase">
                    ESTADO: EXPEDIDO / COMPLETADO
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono font-black text-2xl text-amber-600 tracking-tight">{noteToPrint.code}</div>
                <div className="text-xs font-semibold text-zinc-600 mt-1">
                  Fecha: {new Date(noteToPrint.dispatchDate).toLocaleDateString('es-ES')} - {new Date(noteToPrint.dispatchDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>

            {/* Event & Client Details */}
            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-zinc-50 border text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-400 block font-mono">Evento / Producción</span>
                <span className="font-bold text-sm text-zinc-900 block">{noteToPrint.eventName}</span>
                <span className="text-zinc-600">Código Evento: {noteToPrint.eventCode}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-400 block font-mono">Cliente / Productora</span>
                <span className="font-bold text-sm text-zinc-900 block">{noteToPrint.clientName}</span>
                <span className="text-zinc-600">Preparado por: {noteToPrint.preparedBy}</span>
              </div>
            </div>

            {/* Table of Dispatched Gear */}
            <div>
              <table className="w-full text-left text-xs border">
                <thead className="bg-zinc-100 font-bold border-b text-[11px] font-mono">
                  <tr>
                    <th className="py-2.5 px-3">Código</th>
                    <th className="py-2.5 px-3">Artículo / Descripción</th>
                    <th className="py-2.5 px-3 text-center">Cantidad</th>
                    <th className="py-2.5 px-3">Números de Serie / QR</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {noteToPrint.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 px-3 font-mono font-bold text-zinc-800">{it.itemCode}</td>
                      <td className="py-2.5 px-3 font-semibold text-zinc-900">{it.itemName}</td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-zinc-900">{it.quantity}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-zinc-600">
                        {it.unitSerialNumbers && it.unitSerialNumbers.length > 0
                          ? it.unitSerialNumbers.join(', ')
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {noteToPrint.notes && (
              <div className="text-xs text-zinc-600 border-t pt-2">
                <strong>Observaciones de Salida:</strong> {noteToPrint.notes}
              </div>
            )}

            {/* Signatures Footer with Digital Tablet Stamp */}
            <div className="grid grid-cols-2 gap-8 pt-6 border-t text-xs">
              <div className="border p-4 rounded text-center h-32 flex flex-col justify-between">
                <span className="font-semibold text-zinc-700">Entregado por (Almacén): {noteToPrint.authorizedBy}</span>
                <div className="border-t border-dashed border-zinc-300 pt-1 text-[10px] text-zinc-400">
                  Firma autorizada de almacén
                </div>
              </div>

              <div className="border p-4 rounded text-center h-32 flex flex-col justify-between bg-zinc-50 relative overflow-hidden">
                <span className="font-semibold text-zinc-700">
                  Recibido por (Transporte / Técnico Responsable)
                </span>

                {noteToPrint.clientSignatureUrl ? (
                  <div className="my-auto">
                    <img
                      src={noteToPrint.clientSignatureUrl}
                      alt="Firma digital en tablet"
                      className="h-14 max-w-full object-contain mx-auto"
                    />
                    <div className="text-[10px] text-zinc-600 font-mono">
                      {noteToPrint.signerName || noteToPrint.clientName}{' '}
                      {noteToPrint.signerDni ? `• DNI: ${noteToPrint.signerDni}` : ''}
                    </div>
                  </div>
                ) : (
                  <div className="my-auto py-2">
                    <button
                      type="button"
                      onClick={() => setSignatureDispatch(noteToPrint)}
                      className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 border border-amber-500/40 rounded text-[11px] font-bold no-print inline-flex items-center gap-1 cursor-pointer"
                    >
                      <PenTool className="w-3 h-3" /> Firmar en Tablet
                    </button>
                    <span className="text-[10px] text-zinc-400 block mt-1">Pendiente de firma</span>
                  </div>
                )}

                <div className="border-t border-dashed border-zinc-300 pt-1 text-[10px] text-zinc-500">
                  Firma digital conforme y DNI
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR & Barcode Camera Scanner Modal */}
      <QrPhotoScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        items={items}
        itemUnits={itemUnits}
        onUnitSelected={handleScanUnitResult}
        title="Escanear Material con Cámara para Salida de Almacén"
      />

      {/* Tablet Digital Signature Modal */}
      {signatureDispatch && (
        <TabletSignatureModal
          isOpen={Boolean(signatureDispatch)}
          onClose={() => setSignatureDispatch(null)}
          onSaveSignature={handleSaveSignature}
          dispatchCode={signatureDispatch.code}
          eventName={signatureDispatch.eventName}
          clientName={signatureDispatch.clientName}
        />
      )}

      {/* Direct Damage Report Modal to SAT */}
      <DirectDamageReportModal
        isOpen={isDamageModalOpen}
        onClose={() => setIsDamageModalOpen(false)}
        sourceContext="dispatch"
        referenceName={selectedEvent ? selectedEvent.name : 'Salidas Almacén'}
      />
    </div>
  );
};
