import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Plus,
  Search,
  Filter,
  Truck,
  RotateCcw,
  Clock,
  CheckCircle,
  AlertOctagon,
  Eye,
  MapPin,
  User,
  FileSignature,
} from 'lucide-react';
import { AVEvent, EventStatus, Contract } from '../../types/inventory.ts';
import { useInventory } from '../../context/InventoryContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { EventFormModal } from './EventFormModal.tsx';
import { EventDetailModal } from './EventDetailModal.tsx';
import { PaymentGatewayModal } from '../contracts/PaymentGatewayModal.tsx';

interface EventsViewProps {
  onOpenDispatch: (eventId: string) => void;
}

export const EventsView: React.FC<EventsViewProps> = ({ onOpenDispatch }) => {
  const { events, eventItems, contracts, generateContractFromEvent, updateContractStatus } = useInventory();
  const { canManageInventory } = useAuth();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [contractModalData, setContractModalData] = useState<Contract | null>(null);
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<AVEvent | null>(null);
  const [eventToView, setEventToView] = useState<AVEvent | null>(null);

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (statusFilter !== 'all' && ev.status !== statusFilter) return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        ev.name.toLowerCase().includes(q) ||
        ev.code.toLowerCase().includes(q) ||
        ev.clientName.toLowerCase().includes(q) ||
        (ev.location && ev.location.toLowerCase().includes(q))
      );
    });
  }, [events, statusFilter, search]);

  const handleOpenCreate = () => {
    setEventToEdit(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (ev: AVEvent) => {
    setEventToEdit(ev);
    setIsFormOpen(true);
  };

  const getStatusBadge = (status: EventStatus) => {
    switch (status) {
      case 'confirmed':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">Confirmado</span>;
      case 'preparing':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">En Preparación</span>;
      case 'prepared':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">Material Preparado</span>;
      case 'dispatched':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wide">Expedido</span>;
      case 'pending_return':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30">Pendiente Retorno</span>;
      case 'closed':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Cerrado / Devuelto</span>;
      case 'cancelled':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-800 text-zinc-500">Cancelado</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-800 text-zinc-300">{status}</span>;
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#30363d]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            Eventos, Giras y Reservas
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono font-medium">
              {filteredEvents.length} eventos
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Control de reservas de material con cálculo temporal de disponibilidad y fechas de solapamiento.
          </p>
        </div>

        {canManageInventory && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Planificar Evento</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#161b22] p-3.5 rounded-xl border border-[#30363d] text-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por evento, cliente o código..."
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg pl-9 pr-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
          >
            <option value="all">Todos los estados de evento</option>
            <option value="confirmed">Confirmados (con reserva activa)</option>
            <option value="preparing">En preparación de material</option>
            <option value="dispatched">Entregados / En directo</option>
            <option value="pending_return">Pendientes de devolución</option>
            <option value="closed">Cerrados / Completados</option>
            <option value="planning">Presupuesto / Planificación</option>
            <option value="cancelled">Cancelados</option>
          </select>
        </div>

        <div className="flex items-center justify-end">
          {(statusFilter !== 'all' || search) && (
            <button
              onClick={() => {
                setStatusFilter('all');
                setSearch('');
              }}
              className="px-3 py-1.5 rounded-lg border border-[#30363d] hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Events List */}
      <div className="space-y-3">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-16 bg-[#161b22] border border-[#30363d] rounded-xl text-zinc-400">
            <Calendar className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-zinc-200">No hay eventos con estos criterios</h3>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
              Crea un nuevo evento o limpia los filtros de búsqueda.
            </p>
          </div>
        ) : (
          filteredEvents.map((ev) => {
            const lines = eventItems.filter((l) => l.eventId === ev.id);
            const totalRequested = lines.reduce((acc, l) => acc + l.quantityRequested, 0);
            const isOverdue =
              (ev.status === 'pending_return' || ev.status === 'dispatched') &&
              new Date(ev.returnDate).getTime() < Date.now();

            return (
              <div
                key={ev.id}
                onClick={() => setEventToView(ev)}
                className={`p-4 rounded-xl border transition cursor-pointer hover:border-zinc-500 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isOverdue
                    ? 'bg-rose-950/20 border-rose-800/50'
                    : 'bg-[#161b22] border-[#30363d]'
                }`}
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-zinc-800 text-amber-400 border border-amber-500/30">
                      {ev.code}
                    </span>
                    <h3 className="font-bold text-white text-base">{ev.name}</h3>
                    {getStatusBadge(ev.status)}
                    {isOverdue && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white animate-pulse">
                        DEVOLUCIÓN ATRASADA
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
                    <span className="text-zinc-200 font-medium">Cliente: {ev.clientName}</span>
                    {ev.location && (
                      <span className="flex items-center gap-1 text-zinc-400">
                        <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                        {ev.location}
                      </span>
                    )}
                    {ev.manager && (
                      <span className="flex items-center gap-1 text-zinc-400">
                        <User className="w-3.5 h-3.5 text-zinc-500" />
                        {ev.manager}
                      </span>
                    )}
                  </div>
                </div>

                {/* Logistics dates and gear count */}
                <div className="flex flex-wrap items-center gap-4 text-xs font-mono border-t md:border-t-0 md:border-l border-[#30363d] pt-3 md:pt-0 md:pl-4">
                  <div>
                    <span className="text-[10px] text-zinc-500 block uppercase font-sans">Salida</span>
                    <span className="text-zinc-200">{new Date(ev.dispatchDate).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block uppercase font-sans">Retorno Previsto</span>
                    <span className={isOverdue ? 'text-rose-400 font-bold' : 'text-amber-400'}>
                      {new Date(ev.returnDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block uppercase font-sans">Material</span>
                    <span className="text-white font-bold">{totalRequested} uds</span>
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setEventToView(ev)}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition"
                    >
                      Ver Rider
                    </button>

                    {canManageInventory && (
                      <button
                        onClick={async () => {
                          let c = contracts.find((cnt) => cnt.eventId === ev.id);
                          if (!c) {
                            c = await generateContractFromEvent(ev.id);
                          }
                          setContractModalData(c);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition"
                        title="Generar o consultar contrato y gestionar señal del 10%"
                      >
                        <FileSignature className="w-3.5 h-3.5" />
                        <span>Contrato 10%</span>
                      </button>
                    )}

                    {ev.status !== 'closed' && ev.status !== 'cancelled' && (
                      <button
                        onClick={() => onOpenDispatch(ev.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition shadow-md shadow-amber-500/20"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>Salida</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Event Form Modal */}
      {isFormOpen && (
        <EventFormModal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          eventToEdit={eventToEdit}
        />
      )}

      {/* Event Detail Modal */}
      {eventToView && (
        <EventDetailModal
          event={eventToView}
          onClose={() => setEventToView(null)}
          onOpenDispatch={onOpenDispatch}
          onOpenEdit={(ev) => {
            setEventToView(null);
            handleOpenEdit(ev);
          }}
        />
      )}

      {/* Contract & 10% Booking Gateway Modal */}
      {contractModalData && (
        <PaymentGatewayModal
          isOpen={Boolean(contractModalData)}
          onClose={() => setContractModalData(null)}
          contract={contractModalData}
          onMarkPaid={async (contractId, ref) => {
            await updateContractStatus(contractId, 'deposit_paid', ref);
          }}
        />
      )}
    </div>
  );
};
