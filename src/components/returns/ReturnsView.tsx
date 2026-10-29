import React, { useState } from 'react';
import {
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  Clock,
  Printer,
  Wrench,
  Package,
  Calendar,
  AlertOctagon,
} from 'lucide-react';
import { ReturnNote, ReturnCondition } from '../../types/inventory.ts';
import { useInventory } from '../../context/InventoryContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { DirectDamageReportModal } from '../maintenance/DirectDamageReportModal.tsx';

interface ReturnsViewProps {
  initialEventId?: string | null;
  onClearInitialEvent?: () => void;
}

export const ReturnsView: React.FC<ReturnsViewProps> = ({
  initialEventId,
  onClearInitialEvent,
}) => {
  const { events, eventItems, items, itemUnits, returns, processReturn } = useInventory();
  const { userProfile, canAuthorizeDispatches } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(Boolean(initialEventId));
  const [isDamageModalOpen, setIsDamageModalOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState(
    initialEventId ||
      events.filter((e) => ['dispatched', 'pending_return', 'in_progress'].includes(e.status))[0]?.id ||
      ''
  );

  const [receivedBy, setReceivedBy] = useState(userProfile?.name || 'Técnico de Recepción');
  const [notes, setNotes] = useState('');
  const [returnLines, setReturnLines] = useState<
    Record<
      string,
      {
        quantity: number;
        condition: ReturnCondition;
        unitSerialNumbers: string[];
        incidentNotes: string;
      }
    >
  >({});
  const [returnError, setReturnError] = useState<string | null>(null);

  const [noteToPrint, setNoteToPrint] = useState<ReturnNote | null>(null);

  const selectedEvent = events.find((e) => e.id === selectedEventId);
  const selectedEventLines = eventItems.filter(
    (l) => l.eventId === selectedEventId && l.quantityDispatched > l.quantityReturned
  );

  const handleEventChange = (evId: string) => {
    setSelectedEventId(evId);
    const targetLines = eventItems.filter(
      (l) => l.eventId === evId && l.quantityDispatched > l.quantityReturned
    );
    const initialLines: typeof returnLines = {};

    targetLines.forEach((l) => {
      const pendingQty = Math.max(0, l.quantityDispatched - l.quantityReturned);
      const unitsOut = itemUnits
        .filter((u) => u.itemId === l.itemId && u.currentEventId === evId)
        .map((u) => u.serialNumber);

      initialLines[l.itemId] = {
        quantity: pendingQty,
        condition: 'good',
        unitSerialNumbers: unitsOut,
        incidentNotes: '',
      };
    });

    setReturnLines(initialLines);
  };

  const handleOpenReturnModal = (evId?: string) => {
    const target = evId || selectedEventId;
    handleEventChange(target);
    setIsModalOpen(true);
  };

  const handleExecuteReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;

    try {
      setReturnError(null);

      const returnedItems = Object.entries(returnLines).map(([itemId, data]) => ({
        itemId,
        quantity: data.quantity,
        condition: data.condition,
        unitSerialNumbers: data.unitSerialNumbers,
        incidentNotes: data.incidentNotes,
      }));

      const totalReturned = returnedItems.reduce((acc, p) => acc + p.quantity, 0);
      if (totalReturned <= 0) {
        setReturnError('Debes indicar al menos una unidad a devolver.');
        return;
      }

      const note = await processReturn(selectedEvent.id, returnedItems, receivedBy, notes);

      setIsModalOpen(false);
      if (onClearInitialEvent) onClearInitialEvent();
      setNoteToPrint(note);
    } catch (err: any) {
      setReturnError(err.message || 'Error al procesar la devolución.');
    }
  };

  // Overdue events detection (Requirement 10)
  const overdueEvents = events.filter((e) => {
    if (e.status !== 'pending_return' && e.status !== 'dispatched') return false;
    return new Date(e.returnDate).getTime() < Date.now();
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#30363d] no-print">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            Devoluciones y Recepción de Material
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono font-medium">
              {returns.length} devoluciones
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Control de retorno de bolos, inspección técnica de estado y apertura automática de partes SAT en averías.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsDamageModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold transition shadow-xs cursor-pointer"
            title="Reportar material roto directamente a Averías / SAT desde recepción"
          >
            <Wrench className="w-4 h-4 text-rose-400" />
            <span>Reportar Avería a SAT</span>
          </button>

          <button
            onClick={() => handleOpenReturnModal()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/20 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Registrar Devolución</span>
          </button>
        </div>
      </div>

      {/* Overdue Alerts Card if any (Section 10) */}
      {overdueEvents.length > 0 && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-start gap-3 no-print">
          <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <h4 className="font-bold text-rose-200">
              {overdueEvents.length} Evento(s) con Devolución de Material Atrasada
            </h4>
            <div className="mt-2 space-y-1.5">
              {overdueEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center justify-between p-2 rounded bg-rose-900/40 border border-rose-800/40"
                >
                  <div>
                    <span className="font-bold text-white">{ev.name}</span>
                    <span className="text-rose-300 ml-2">
                      (Retorno previsto: {new Date(ev.returnDate).toLocaleDateString()})
                    </span>
                  </div>
                  <button
                    onClick={() => handleOpenReturnModal(ev.id)}
                    className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px]"
                  >
                    Recepcionar Devolución
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Returns History List */}
      <div className="space-y-3 no-print">
        {returns.length === 0 ? (
          <div className="text-center py-16 bg-[#161b22] border border-[#30363d] rounded-xl text-zinc-400">
            <RotateCcw className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-zinc-200">No hay albaranes de devolución registrados</h3>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
              Cuando un bolo termine, registra aquí la recepción del material devuelto para revisar su estado.
            </p>
          </div>
        ) : (
          returns.map((ret) => (
            <div
              key={ret.id}
              className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] hover:border-zinc-500 transition flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-emerald-400 text-sm">{ret.code}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                    {ret.eventCode}
                  </span>
                  {ret.hasIncidents ? (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Con Incidencias / Daños
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                      Material Correcto
                    </span>
                  )}
                </div>
                <div className="font-bold text-white text-sm">{ret.eventName}</div>
                <div className="text-zinc-400">
                  Recibido y revisado por: <strong>{ret.receivedBy}</strong>
                </div>
              </div>

              <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-[#30363d] pt-3 md:pt-0 md:pl-4">
                <div>
                  <span className="text-[10px] text-zinc-500 block uppercase font-mono">Fecha Devolución</span>
                  <span className="text-zinc-200 font-mono">
                    {new Date(ret.returnDate).toLocaleDateString()} {new Date(ret.returnDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 block uppercase font-mono">Uds Devueltas</span>
                  <span className="text-white font-mono font-bold">
                    {ret.items.reduce((acc, i) => acc + i.quantityReturned, 0)} uds
                  </span>
                </div>
                <button
                  onClick={() => setNoteToPrint(ret)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-[#30363d] font-semibold transition"
                >
                  <Printer className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Ver Albarán</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Return Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-[#30363d] flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-emerald-400" />
                <span>Recepción de Material y Control Técnico</span>
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-white transition">
                ✕
              </button>
            </div>

            <form onSubmit={handleExecuteReturn} className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
              {returnError && (
                <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{returnError}</span>
                </div>
              )}

              {/* Event selection */}
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Evento de Origen *</label>
                <select
                  value={selectedEventId}
                  onChange={(e) => handleEventChange(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 font-semibold"
                >
                  {events
                    .filter((e) => ['dispatched', 'pending_return', 'in_progress', 'confirmed'].includes(e.status))
                    .map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        [{ev.code}] {ev.name} — {ev.clientName} (Retorno previsto:{' '}
                        {new Date(ev.returnDate).toLocaleDateString()})
                      </option>
                    ))}
                </select>
              </div>

              {/* Material Lines Selection */}
              <div className="space-y-2">
                <span className="font-bold text-white block">Material Pendiente de Devolución:</span>

                {selectedEventLines.length === 0 ? (
                  <p className="text-zinc-500 py-4 text-center bg-[#0d1117] rounded-lg border border-[#30363d]">
                    Todo el material de este evento ya ha sido devuelto o no tiene entregas pendientes.
                  </p>
                ) : (
                  <div className="border border-[#30363d] rounded-xl overflow-hidden bg-[#0d1117] divide-y divide-[#30363d]">
                    {selectedEventLines.map((line) => {
                      const currentLine = returnLines[line.itemId] || {
                        quantity: 0,
                        condition: 'good',
                        unitSerialNumbers: [],
                        incidentNotes: '',
                      };
                      const pendingToReturn = Math.max(0, line.quantityDispatched - line.quantityReturned);

                      return (
                        <div key={line.id} className="p-3 space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <span className="font-mono text-emerald-400 font-bold">{line.itemCode}</span>
                              <span className="text-white font-semibold ml-2">{line.itemName}</span>
                              <span className="text-[11px] text-zinc-400 ml-2">
                                (Entregadas: {line.quantityDispatched} • Pendientes: {pendingToReturn})
                              </span>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1.5">
                                <span className="text-zinc-400">Devueltas:</span>
                                <input
                                  type="number"
                                  min="0"
                                  max={pendingToReturn}
                                  value={currentLine.quantity}
                                  onChange={(e) => {
                                    setReturnLines({
                                      ...returnLines,
                                      [line.itemId]: {
                                        ...currentLine,
                                        quantity: Number(e.target.value),
                                      },
                                    });
                                  }}
                                  className="w-16 bg-[#161b22] border border-[#30363d] rounded px-2 py-1 text-center font-bold text-white"
                                />
                              </div>

                              {/* Condition Selector (Section 10) */}
                              <select
                                value={currentLine.condition}
                                onChange={(e) => {
                                  setReturnLines({
                                    ...returnLines,
                                    [line.itemId]: {
                                      ...currentLine,
                                      condition: e.target.value as ReturnCondition,
                                    },
                                  });
                                }}
                                className={`px-2 py-1 rounded text-xs font-semibold border ${
                                  currentLine.condition === 'good'
                                    ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800'
                                    : 'bg-rose-950/40 text-rose-400 border-rose-800'
                                }`}
                              >
                                <option value="good">✓ Correcto</option>
                                <option value="damaged">⚠ Dañado / Averiado</option>
                                <option value="incomplete">⚠ Incompleto / Falta pieza</option>
                                <option value="review_pending">🔍 Pendiente de revisión técnica</option>
                              </select>
                            </div>
                          </div>

                          {/* Damage incident note input if not good */}
                          {currentLine.condition !== 'good' && currentLine.quantity > 0 && (
                            <div className="pt-2 border-t border-[#30363d]/50 bg-rose-950/20 p-2.5 rounded-lg border border-rose-800/30">
                              <label className="block text-rose-300 font-semibold mb-1">
                                Detalle de la Avería / Desperfecto (Se abrirá ticket en Taller SAT automáticamante):
                              </label>
                              <input
                                type="text"
                                required
                                placeholder="Describe el daño: cono rajado, canal quemado, golpe en carcasa..."
                                value={currentLine.incidentNotes}
                                onChange={(e) => {
                                  setReturnLines({
                                    ...returnLines,
                                    [line.itemId]: {
                                      ...currentLine,
                                      incidentNotes: e.target.value,
                                    },
                                  });
                                }}
                                className="w-full bg-[#161b22] border border-rose-700/60 rounded px-2.5 py-1 text-zinc-100"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Reception Signature & Notes */}
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Técnico que Recepciona y Comprueba *</label>
                <input
                  type="text"
                  required
                  value={receivedBy}
                  onChange={(e) => setReceivedBy(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Observaciones Generales de la Devolución</label>
                <input
                  type="text"
                  placeholder="Material limpio, cables recogidos con velcro, cajas completas..."
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
                  disabled={selectedEventLines.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-600/20 transition"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Confirmar Recepción y Emitir Albarán</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Return Note (Albarán de Devolución Imprimible) */}
      {noteToPrint && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-zinc-900 rounded-2xl w-full max-w-3xl p-8 space-y-6 shadow-2xl printable-document">
            {/* Top Bar for Screen */}
            <div className="flex items-center justify-between border-b pb-4 no-print">
              <span className="font-bold text-lg text-zinc-800">Albarán Oficial de Devolución y Revisión</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold text-xs shadow-md transition"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir / Guardar PDF</span>
                </button>
                <button
                  onClick={() => setNoteToPrint(null)}
                  className="px-3 py-2 rounded-lg border border-zinc-300 text-zinc-700 text-xs hover:bg-zinc-100"
                >
                  Cerrar
                </button>
              </div>
            </div>

            {/* Document Header */}
            <div className="flex items-start justify-between border-b pb-6">
              <div className="flex items-center gap-3">
                <img src="/assets/logo_jd_square.png" alt="JD" className="w-12 h-12 object-contain rounded-lg" />
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-zinc-900">JD CONTROL DE STOCK</h1>
                  <p className="text-xs text-zinc-500">Gestión Integral de Almacén y Retorno de Material</p>
                  <p className="text-xs text-zinc-500">CIF: B-89234812 • Almacén Central</p>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-xl text-emerald-600">{noteToPrint.code}</div>
                <div className="text-xs text-zinc-500 mt-1">
                  Fecha: {new Date(noteToPrint.returnDate).toLocaleDateString()} {new Date(noteToPrint.returnDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>

            {/* Event Details */}
            <div className="p-4 rounded-xl bg-zinc-50 border text-xs">
              <span className="text-[10px] uppercase font-bold text-zinc-400 block font-mono">Evento / Producción</span>
              <span className="font-bold text-sm text-zinc-900 block">{noteToPrint.eventName}</span>
              <span className="text-zinc-600">
                Código: {noteToPrint.eventCode} • Recepcionado por: {noteToPrint.receivedBy}
              </span>
            </div>

            {/* Returned Items */}
            <div>
              <table className="w-full text-left text-xs border">
                <thead className="bg-zinc-100 font-bold border-b text-[11px] font-mono">
                  <tr>
                    <th className="py-2.5 px-3">Código</th>
                    <th className="py-2.5 px-3">Artículo</th>
                    <th className="py-2.5 px-3 text-center">Devuelto</th>
                    <th className="py-2.5 px-3">Estado Comprobado</th>
                    <th className="py-2.5 px-3">Incidencias / SAT</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {noteToPrint.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 px-3 font-mono font-bold text-zinc-800">{it.itemCode}</td>
                      <td className="py-2.5 px-3 font-semibold text-zinc-900">{it.itemName}</td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-zinc-900">{it.quantityReturned}</td>
                      <td className="py-2.5 px-3 font-bold text-xs">
                        {it.condition === 'good' ? (
                          <span className="text-emerald-700">✓ Correcto</span>
                        ) : (
                          <span className="text-rose-700">⚠ {it.condition}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-zinc-600">{it.incidentNotes || 'Sin anomalías'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {noteToPrint.notes && (
              <div className="text-xs text-zinc-600 border-t pt-2">
                <strong>Observaciones de Devolución:</strong> {noteToPrint.notes}
              </div>
            )}

            {/* Signatures Footer */}
            <div className="grid grid-cols-2 gap-8 pt-8 border-t text-xs">
              <div className="border p-4 rounded text-center h-28 flex flex-col justify-between">
                <span className="font-semibold text-zinc-700">Técnico Receptor de Almacén: {noteToPrint.receivedBy}</span>
                <span className="text-[10px] text-zinc-400">Firma y Conforme</span>
              </div>
              <div className="border p-4 rounded text-center h-28 flex flex-col justify-between">
                <span className="font-semibold text-zinc-700">Entregado por (Transportista / Técnico de Gira)</span>
                <span className="text-[10px] text-zinc-400">Firma y DNI</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Direct Damage Report Modal to SAT */}
      <DirectDamageReportModal
        isOpen={isDamageModalOpen}
        onClose={() => setIsDamageModalOpen(false)}
        sourceContext="return"
        referenceName={selectedEvent ? selectedEvent.name : 'Recepción Devoluciones'}
      />
    </div>
  );
};
