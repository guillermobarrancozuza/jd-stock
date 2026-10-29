import React, { useState } from 'react';
import { X, Calendar, MapPin, User, Save, AlertCircle } from 'lucide-react';
import { AVEvent, EventStatus } from '../../types/inventory.ts';
import { useInventory } from '../../context/InventoryContext.tsx';

interface EventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventToEdit?: AVEvent | null;
}

export const EventFormModal: React.FC<EventFormModalProps> = ({ isOpen, onClose, eventToEdit }) => {
  const { clients, saveEvent } = useInventory();

  const [formData, setFormData] = useState({
    code: eventToEdit?.code || '',
    name: eventToEdit?.name || '',
    clientId: eventToEdit?.clientId || clients[0]?.id || '',
    clientName: eventToEdit?.clientName || clients[0]?.name || '',
    location: eventToEdit?.location || '',
    address: eventToEdit?.address || '',
    dispatchDate: eventToEdit?.dispatchDate?.substring(0, 16) || new Date(Date.now() + 86400000).toISOString().substring(0, 16),
    eventDate: eventToEdit?.eventDate?.substring(0, 16) || new Date(Date.now() + 172800000).toISOString().substring(0, 16),
    returnDate: eventToEdit?.returnDate?.substring(0, 16) || new Date(Date.now() + 259200000).toISOString().substring(0, 16),
    manager: eventToEdit?.manager || '',
    status: (eventToEdit?.status || 'planning') as EventStatus,
    notes: eventToEdit?.notes || '',
  });

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('El nombre del evento o bolo es obligatorio.');
      return;
    }
    if (new Date(formData.returnDate).getTime() <= new Date(formData.dispatchDate).getTime()) {
      setError('La fecha prevista de devolución debe ser posterior a la fecha de salida del material.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const client = clients.find((c) => c.id === formData.clientId);

      await saveEvent({
        id: eventToEdit?.id,
        code: formData.code.trim() || undefined,
        name: formData.name.trim(),
        clientId: formData.clientId,
        clientName: client ? client.name : formData.clientName,
        location: formData.location.trim(),
        address: formData.address.trim(),
        dispatchDate: new Date(formData.dispatchDate).toISOString(),
        eventDate: new Date(formData.eventDate).toISOString(),
        returnDate: new Date(formData.returnDate).toISOString(),
        manager: formData.manager.trim(),
        status: formData.status,
        notes: formData.notes.trim(),
      });

      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el evento.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto no-print">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="p-4 border-b border-[#30363d] flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-400" />
            <span>{eventToEdit ? 'Editar Evento / Reserva' : 'Planificar Nuevo Evento o Gira'}</span>
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
          {error && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-zinc-300 font-semibold mb-1">Nombre del Espectáculo / Evento *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej. Festival Sonorama, Concierto Wizink, Gira Teatral..."
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-semibold mb-1">Código del Evento</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="Autogenerado (EV-2026-xxx)"
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 font-mono uppercase focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-300 font-semibold mb-1">Cliente / Productora *</label>
              <select
                value={formData.clientId}
                onChange={(e) => {
                  const sel = clients.find((c) => c.id === e.target.value);
                  setFormData({
                    ...formData,
                    clientId: e.target.value,
                    clientName: sel ? sel.name : '',
                  });
                }}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-zinc-300 font-semibold mb-1">Responsable Técnico del Evento</label>
              <input
                type="text"
                value={formData.manager}
                onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
                placeholder="Ej. Carlos Ruiz (Jefe Técnico)"
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-300 font-semibold mb-1">Lugar de Celebración / Recinto</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Ej. Recinto Ferial, Teatro Principal..."
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-semibold mb-1">Dirección Completa / Ciudad</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Calle, número, código postal y localidad"
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Critical Logistics Dates */}
          <div className="p-3.5 rounded-xl bg-[#0d1117] border border-[#30363d] space-y-3">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
              Fechas de Logística y Disponibilidad
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">1. Salida de Almacén *</label>
                <input
                  type="datetime-local"
                  required
                  value={formData.dispatchDate}
                  onChange={(e) => setFormData({ ...formData, dispatchDate: e.target.value })}
                  className="w-full bg-[#161b22] border border-[#30363d] rounded-lg p-2 text-zinc-100 focus:outline-none focus:border-amber-500 font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">2. Celebración del Bolo *</label>
                <input
                  type="datetime-local"
                  required
                  value={formData.eventDate}
                  onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                  className="w-full bg-[#161b22] border border-[#30363d] rounded-lg p-2 text-zinc-100 focus:outline-none focus:border-amber-500 font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">3. Devolución Prevista *</label>
                <input
                  type="datetime-local"
                  required
                  value={formData.returnDate}
                  onChange={(e) => setFormData({ ...formData, returnDate: e.target.value })}
                  className="w-full bg-[#161b22] border border-[#30363d] rounded-lg p-2 text-zinc-100 focus:outline-none focus:border-amber-500 font-mono text-[11px]"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-300 font-semibold mb-1">Estado del Evento *</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as EventStatus })}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
              >
                <option value="draft">Borrador</option>
                <option value="planning">Presupuesto / Planificación</option>
                <option value="confirmed">Confirmado (Reserva Activa)</option>
                <option value="preparing">En Preparación</option>
                <option value="prepared">Material Preparado en Almacén</option>
                <option value="dispatched">Material Entregado / Fuera</option>
                <option value="in_progress">En Curso (En Directo)</option>
                <option value="pending_return">Pendiente de Devolución</option>
                <option value="closed">Cerrado / Completado</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>

            <div>
              <label className="block text-zinc-300 font-semibold mb-1">Observaciones Técnicas / Rider</label>
              <input
                type="text"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Canales Dante, requisitos de potencia 32A..."
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-[#30363d] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#30363d] hover:bg-zinc-800 text-zinc-300 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold transition shadow-lg shadow-amber-500/20"
            >
              <Save className="w-4 h-4" />
              <span>{submitting ? 'Guardando...' : 'Guardar Evento'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
