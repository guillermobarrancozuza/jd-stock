import React, { useState } from 'react';
import {
  X,
  Calendar,
  MapPin,
  User,
  Plus,
  Trash2,
  Truck,
  CheckCircle,
  AlertTriangle,
  Clock,
  Package,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { AVEvent, EventItem } from '../../types/inventory.ts';
import { useInventory } from '../../context/InventoryContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';

interface EventDetailModalProps {
  event: AVEvent | null;
  onClose: () => void;
  onOpenDispatch: (eventId: string) => void;
  onOpenEdit: (event: AVEvent) => void;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  event,
  onClose,
  onOpenDispatch,
  onOpenEdit,
}) => {
  const { items, eventItems, addEventItem, removeEventItem, checkAvailability, updateEventStatus } = useInventory();
  const { canAuthorizeDispatches, canManageInventory } = useAuth();

  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id || '');
  const [quantity, setQuantity] = useState(1);
  const [addError, setAddError] = useState<string | null>(null);

  if (!event) return null;

  const lines = eventItems.filter((l) => l.eventId === event.id);

  // Check real-time availability for the selected item before adding
  const currentAvailability = checkAvailability(
    selectedItemId,
    quantity,
    event.dispatchDate,
    event.returnDate,
    event.id
  );

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setAddError(null);
      await addEventItem(event.id, selectedItemId, quantity);
      setQuantity(1);
    } catch (err: any) {
      setAddError(err.message || 'Error al añadir material a la reserva');
    }
  };

  const handleStatusChange = async (newStatus: AVEvent['status']) => {
    await updateEventStatus(event.id, newStatus);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto no-print">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-[#30363d] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-bold">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">{event.name}</h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-zinc-800 text-amber-400 border border-amber-500/30">
                  {event.code}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                  {event.status}
                </span>
              </div>
              <div className="text-xs text-zinc-400">
                Cliente: <strong>{event.clientName}</strong> • {event.location || 'Ubicación a determinar'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenEdit(event)}
              className="px-3 py-1.5 rounded-lg border border-[#30363d] hover:bg-zinc-800 text-zinc-300 text-xs font-semibold transition"
            >
              Editar Datos
            </button>
            <button onClick={onClose} className="text-zinc-400 hover:text-white transition p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Event Logistics Banner */}
        <div className="p-4 bg-[#0d1117] border-b border-[#30363d] grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-[10px] text-zinc-500 block uppercase font-mono">Salida Almacén</span>
            <span className="font-semibold text-zinc-200">
              {new Date(event.dispatchDate).toLocaleDateString()} {new Date(event.dispatchDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 block uppercase font-mono">Fecha del Bolo</span>
            <span className="font-semibold text-zinc-200">
              {new Date(event.eventDate).toLocaleDateString()}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 block uppercase font-mono">Devolución Prevista</span>
            <span className="font-semibold text-amber-400">
              {new Date(event.returnDate).toLocaleDateString()} {new Date(event.returnDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 block uppercase font-mono">Responsable Técnico</span>
            <span className="font-semibold text-zinc-200">{event.manager || 'No asignado'}</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5 text-xs">
          {/* Action trigger: Prepare Dispatch if ready */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
            <div>
              <span className="font-bold text-amber-300 text-sm block">Preparación y Salida de Material</span>
              <span className="text-zinc-400 text-[11px]">
                Asigna números de serie, verifica bultos y genera el Albarán de Salida oficial imprimible.
              </span>
            </div>
            {canAuthorizeDispatches && (
              <button
                onClick={() => {
                  onClose();
                  onOpenDispatch(event.id);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition shadow-lg shadow-amber-500/20"
              >
                <Truck className="w-4 h-4" />
                <span>Preparar Albarán de Salida</span>
              </button>
            )}
          </div>

          {/* Add Material to Event Form */}
          <div className="p-4 rounded-xl bg-[#0d1117] border border-[#30363d] space-y-3">
            <h3 className="font-bold text-white text-xs flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-amber-400" />
              <span>Añadir Material al Listado / Rider del Evento</span>
            </h3>

            {addError && (
              <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleAddMaterial} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-7">
                <label className="block text-zinc-400 font-semibold mb-1">Artículo de Inventario</label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100"
                >
                  {items
                    .filter((i) => i.status === 'active')
                    .map((it) => (
                      <option key={it.id} value={it.id}>
                        [{it.category}] {it.name} — {it.brand} {it.model} ({it.code})
                      </option>
                    ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-zinc-400 font-semibold mb-1">Cantidad</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 font-bold"
                />
              </div>

              <div className="sm:col-span-3">
                <button
                  type="submit"
                  disabled={!currentAvailability.isAvailable}
                  className={`w-full py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition ${
                    currentAvailability.isAvailable
                      ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-md shadow-amber-500/20'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  <span>Reservar</span>
                </button>
              </div>
            </form>

            {/* Availability Indicator & Conflict Warnings (Section 8) */}
            <div className="pt-2 border-t border-[#30363d] flex items-center justify-between text-[11px]">
              <div>
                Disponibilidad máxima calculada para esas fechas:{' '}
                <strong
                  className={currentAvailability.isAvailable ? 'text-emerald-400' : 'text-rose-400 font-bold'}
                >
                  {currentAvailability.maxReservableForDates} uds
                </strong>
                {currentAvailability.conflictingEvents.length > 0 && (
                  <span className="text-amber-400 ml-2">
                    ({currentAvailability.conflictingEvents.length} eventos solapados)
                  </span>
                )}
              </div>

              {!currentAvailability.isAvailable && (
                <span className="text-rose-400 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Conflicto: unidades insuficientes para esas fechas
                </span>
              )}
            </div>
          </div>

          {/* Reserved Material Lines Table */}
          <div className="space-y-2">
            <h3 className="font-bold text-white text-sm flex items-center justify-between">
              <span>Listado de Material Solicitado ({lines.length} líneas)</span>
            </h3>

            {lines.length === 0 ? (
              <div className="text-center py-8 bg-[#0d1117] rounded-xl border border-[#30363d] text-zinc-500">
                No hay material asignado a este evento todavía. Añade referencias en el formulario superior.
              </div>
            ) : (
              <div className="border border-[#30363d] rounded-xl overflow-hidden bg-[#0d1117]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#161b22] text-zinc-400 uppercase font-semibold border-b border-[#30363d] text-[10px] font-mono">
                    <tr>
                      <th className="py-2.5 px-3">Código</th>
                      <th className="py-2.5 px-3">Equipo</th>
                      <th className="py-2.5 px-3 text-center">Solicitado</th>
                      <th className="py-2.5 px-3 text-center">Entregado</th>
                      <th className="py-2.5 px-3 text-center">Devuelto</th>
                      <th className="py-2.5 px-3">Estado</th>
                      <th className="py-2.5 px-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#30363d]">
                    {lines.map((l) => (
                      <tr key={l.id} className="hover:bg-[#161b22]/50 transition">
                        <td className="py-2.5 px-3 font-mono font-bold text-amber-400">{l.itemCode}</td>
                        <td className="py-2.5 px-3 font-medium text-white">{l.itemName}</td>
                        <td className="py-2.5 px-3 text-center font-bold font-mono text-zinc-200">
                          {l.quantityRequested}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-purple-400">
                          {l.quantityDispatched}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-emerald-400">
                          {l.quantityReturned}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              l.status === 'dispatched'
                                ? 'bg-emerald-500/20 text-emerald-400 font-bold uppercase'
                                : l.status === 'returned_ok'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : l.status === 'returned_damaged'
                                ? 'bg-rose-500/20 text-rose-400'
                                : 'bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            {l.status === 'requested'
                              ? 'Reservado'
                              : l.status === 'dispatched'
                              ? 'Expedido'
                              : l.status === 'returned_ok'
                              ? 'Devuelto OK'
                              : l.status === 'returned_damaged'
                              ? 'Devuelto con Daños'
                              : l.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {l.quantityDispatched === 0 && (
                            <button
                              onClick={() => removeEventItem(l.id)}
                              className="p-1 rounded text-zinc-500 hover:text-rose-400 transition"
                              title="Eliminar línea y liberar reserva"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer with Status Actions */}
        <div className="p-4 border-t border-[#30363d] flex flex-wrap items-center justify-between gap-3 bg-[#0d1117]">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 text-xs">Cambiar Estado:</span>
            <select
              value={event.status}
              onChange={(e) => handleStatusChange(e.target.value as AVEvent['status'])}
              className="bg-[#161b22] border border-[#30363d] rounded-lg px-2.5 py-1 text-xs text-zinc-200"
            >
              <option value="draft">Borrador</option>
              <option value="planning">Planificación</option>
              <option value="confirmed">Confirmado</option>
              <option value="preparing">En preparación</option>
              <option value="prepared">Material preparado</option>
              <option value="dispatched">Expedido / Completado</option>
              <option value="pending_return">Pendiente de devolución</option>
              <option value="closed">Cerrado</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-[#30363d] hover:bg-zinc-800 text-zinc-300 text-xs transition"
          >
            Cerrar Ficha
          </button>
        </div>
      </div>
    </div>
  );
};
