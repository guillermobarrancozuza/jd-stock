import React, { useState, useMemo } from 'react';
import {
  History,
  Search,
  Filter,
  Download,
  Calendar,
  User,
  ArrowRight,
  ShieldCheck,
  Tag,
} from 'lucide-react';
import { InventoryMovement, MovementType } from '../../types/inventory.ts';
import { useInventory } from '../../context/InventoryContext.tsx';

export const MovementsView: React.FC = () => {
  const { movements } = useInventory();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      if (typeFilter !== 'all' && m.type !== typeFilter) return false;

      if (dateFilter !== 'all') {
        const time = new Date(m.timestamp).getTime();
        const now = Date.now();
        if (dateFilter === 'today' && now - time > 86400000) return false;
        if (dateFilter === 'week' && now - time > 7 * 86400000) return false;
        if (dateFilter === 'month' && now - time > 30 * 86400000) return false;
      }

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        m.itemName.toLowerCase().includes(q) ||
        m.itemCode.toLowerCase().includes(q) ||
        m.reason.toLowerCase().includes(q) ||
        m.userName.toLowerCase().includes(q) ||
        (m.referenceCode && m.referenceCode.toLowerCase().includes(q)) ||
        (m.eventName && m.eventName.toLowerCase().includes(q))
      );
    });
  }, [movements, typeFilter, dateFilter, search]);

  const exportToCSV = () => {
    const headers = ['Fecha/Hora', 'Tipo', 'Código Artículo', 'Artículo', 'Cantidad', 'Origen', 'Destino', 'Usuario', 'Evento', 'Motivo', 'Referencia'];
    const rows = filteredMovements.map((m) => [
      `"${m.timestamp}"`,
      `"${m.type}"`,
      `"${m.itemCode}"`,
      `"${m.itemName.replace(/"/g, '""')}"`,
      m.quantity,
      `"${m.sourceLocation.replace(/"/g, '""')}"`,
      `"${m.targetLocation.replace(/"/g, '""')}"`,
      `"${m.userName.replace(/"/g, '""')}"`,
      `"${(m.eventName || '').replace(/"/g, '""')}"`,
      `"${m.reason.replace(/"/g, '""')}"`,
      `"${m.referenceCode || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `auditoria_movimientos_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getTypeBadge = (type: MovementType) => {
    switch (type) {
      case 'dispatch':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/30">Salida Evento</span>;
      case 'return':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Devolución</span>;
      case 'in':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">Entrada / Compra</span>;
      case 'repair_send':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30">Envío a SAT</span>;
      case 'repair_return':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-500/20 text-teal-400 border border-teal-500/30">Retorno SAT</span>;
      case 'transfer':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">Traslado</span>;
      case 'adjustment':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-orange-500/20 text-orange-400 border border-orange-500/30">Regularización</span>;
      case 'reserve':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">Reserva</span>;
      case 'cancel_reserve':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-700 text-zinc-300">Lib. Reserva</span>;
      case 'create':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-green-500/20 text-green-400">Alta Stock</span>;
      case 'archive':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-800 text-zinc-500">Archivado</span>;
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#30363d]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <History className="w-6 h-6 text-amber-400" />
            Historial Inmutable y Auditoría de Stock
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono font-medium">
              {filteredMovements.length} operaciones
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Registro secuencial inalterable de cada alta, salida, devolución, traslado o regularización con autor y timestamp.
          </p>
        </div>

        <button
          onClick={exportToCSV}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-[#30363d] text-xs font-semibold transition"
          title="Exportar auditoría en formato CSV"
        >
          <Download className="w-3.5 h-3.5 text-amber-400" />
          <span>Exportar Auditoría CSV</span>
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#161b22] p-3.5 rounded-xl border border-[#30363d] text-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por artículo, motivo, usuario o referencia..."
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg pl-9 pr-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
          >
            <option value="all">Todas las operaciones</option>
            <option value="dispatch">Salidas para eventos</option>
            <option value="return">Devoluciones de eventos</option>
            <option value="in">Entradas / Recepción compras</option>
            <option value="transfer">Traslados de almacén</option>
            <option value="adjustment">Ajustes y regularizaciones</option>
            <option value="repair_send">Envíos a reparación</option>
            <option value="repair_return">Retornos de reparación</option>
            <option value="reserve">Reservas para bolos</option>
          </select>
        </div>

        <div>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
          >
            <option value="all">Todo el histórico</option>
            <option value="today">Últimas 24 horas</option>
            <option value="week">Últimos 7 días</option>
            <option value="month">Últimos 30 días</option>
          </select>
        </div>
      </div>

      {/* Movements Audit Table */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-x-auto shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0d1117] text-zinc-400 uppercase font-semibold border-b border-[#30363d] text-[10px] font-mono">
            <tr>
              <th className="py-3 px-4">Fecha y Hora</th>
              <th className="py-3 px-4">Operación</th>
              <th className="py-3 px-4">Artículo / Equipo</th>
              <th className="py-3 px-4 text-center">Cantidad</th>
              <th className="py-3 px-4">Trazabilidad (Origen → Destino)</th>
              <th className="py-3 px-4">Motivo / Evento / Ref</th>
              <th className="py-3 px-4 text-right">Usuario Responsable</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#30363d]">
            {filteredMovements.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-zinc-500">
                  No hay movimientos registrados para los criterios seleccionados.
                </td>
              </tr>
            ) : (
              filteredMovements.map((m) => (
                <tr key={m.id} className="hover:bg-[#0d1117]/60 transition">
                  <td className="py-3 px-4 font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                    <div>{new Date(m.timestamp).toLocaleDateString()}</div>
                    <div className="text-[10px] text-zinc-500">
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">{getTypeBadge(m.type)}</td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-white">{m.itemName}</div>
                    <div className="text-[10px] text-zinc-500 font-mono">{m.itemCode}</div>
                  </td>
                  <td className="py-3 px-4 text-center font-bold font-mono text-zinc-200">
                    {m.quantity}
                  </td>
                  <td className="py-3 px-4 text-[11px]">
                    <div className="text-zinc-400 flex items-center gap-1.5">
                      <span className="truncate max-w-[120px]">{m.sourceLocation}</span>
                      <ArrowRight className="w-3 h-3 text-zinc-600 shrink-0" />
                      <span className="text-amber-300 font-medium truncate max-w-[140px]">{m.targetLocation}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-zinc-300">
                    <div className="font-medium text-xs text-zinc-200">{m.reason}</div>
                    {m.referenceCode && (
                      <span className="text-[10px] font-mono text-zinc-500 block">Ref: {m.referenceCode}</span>
                    )}
                    {m.notes && <div className="text-[10px] text-zinc-400 mt-0.5">{m.notes}</div>}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="font-semibold text-zinc-200">{m.userName.split(' ')[0]}</div>
                    <div className="text-[10px] text-zinc-500">{m.userName}</div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
