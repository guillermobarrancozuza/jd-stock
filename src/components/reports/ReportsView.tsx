import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Download,
  Printer,
  DollarSign,
  TrendingUp,
  Package,
  Wrench,
  Clock,
  CheckCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext.tsx';

export const ReportsView: React.FC = () => {
  const { items, events, incidents, movements, categories } = useInventory();

  const [reportType, setReportType] = useState<
    'valuation' | 'category' | 'overdue' | 'repairs' | 'movements'
  >('valuation');

  const [categoryFilter, setCategoryFilter] = useState('all');

  // Calculations
  const totalValuation = useMemo(() => {
    return items
      .filter((i) => i.status === 'active')
      .reduce((acc, i) => acc + i.totalQuantity * (i.purchasePrice || 0), 0);
  }, [items]);

  const totalRepairCosts = useMemo(() => {
    return incidents.reduce((acc, i) => acc + (i.estimatedCost || 0), 0);
  }, [incidents]);

  const overdueEvents = useMemo(() => {
    return events.filter((e) => {
      if (e.status !== 'pending_return' && e.status !== 'dispatched') return false;
      return new Date(e.returnDate).getTime() < Date.now();
    });
  }, [events]);

  const exportCurrentReportCSV = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let filename = `informe_${reportType}_${new Date().toISOString().split('T')[0]}.csv`;

    if (reportType === 'valuation') {
      headers = ['Código', 'Artículo', 'Categoría', 'Total Uds', 'Precio Unit (€)', 'Valor Total (€)', 'Ubicación'];
      rows = items
        .filter((i) => i.status === 'active' && (categoryFilter === 'all' || i.category === categoryFilter))
        .map((i) => [
          `"${i.code}"`,
          `"${i.name.replace(/"/g, '""')}"`,
          `"${i.category}"`,
          i.totalQuantity,
          i.purchasePrice || 0,
          ((i.purchasePrice || 0) * i.totalQuantity).toFixed(2),
          `"${i.defaultLocationName.replace(/"/g, '""')}"`,
        ]);
    } else if (reportType === 'repairs') {
      headers = ['Código Parte', 'Artículo', 'S/N', 'Prioridad', 'Estado', 'Coste (€)', 'Técnico', 'Fecha'];
      rows = incidents.map((inc) => [
        `"${inc.code}"`,
        `"${inc.itemName.replace(/"/g, '""')}"`,
        `"${inc.serialNumber || 'N/A'}"`,
        `"${inc.priority}"`,
        `"${inc.status}"`,
        inc.estimatedCost || 0,
        `"${(inc.technician || '').replace(/"/g, '""')}"`,
        `"${inc.detectionDate}"`,
      ]);
    } else if (reportType === 'overdue') {
      headers = ['Código Evento', 'Evento', 'Cliente', 'Salida', 'Devolución Prevista', 'Estado'];
      rows = overdueEvents.map((ev) => [
        `"${ev.code}"`,
        `"${ev.name.replace(/"/g, '""')}"`,
        `"${ev.clientName.replace(/"/g, '""')}"`,
        `"${ev.dispatchDate}"`,
        `"${ev.returnDate}"`,
        `"${ev.status}"`,
      ]);
    } else {
      headers = ['Fecha', 'Operación', 'Artículo', 'Cantidad', 'Origen', 'Destino', 'Usuario', 'Motivo'];
      rows = movements.map((m) => [
        `"${m.timestamp}"`,
        `"${m.type}"`,
        `"${m.itemName.replace(/"/g, '""')}"`,
        m.quantity,
        `"${m.sourceLocation.replace(/"/g, '""')}"`,
        `"${m.targetLocation.replace(/"/g, '""')}"`,
        `"${m.userName.replace(/"/g, '""')}"`,
        `"${m.reason.replace(/"/g, '""')}"`,
      ]);
    }

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#30363d] no-print">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-amber-400" />
            Informes, Auditoría y Métricas de Flota
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Exportación de datos de valoración de stock, costes de averías y control de devoluciones.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-[#30363d] text-xs font-semibold transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir Informe</span>
          </button>
          <button
            onClick={exportCurrentReportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition shadow-lg shadow-amber-500/20"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Report Type Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs no-print">
        <button
          onClick={() => setReportType('valuation')}
          className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
            reportType === 'valuation'
              ? 'bg-amber-500/10 border-amber-500/50 text-amber-300 font-bold'
              : 'bg-[#161b22] border-[#30363d] text-zinc-400 hover:text-white'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span>Valoración de Inventario</span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-lg font-mono text-white font-bold">
            {totalValuation.toLocaleString('es-ES')} €
          </span>
        </button>

        <button
          onClick={() => setReportType('repairs')}
          className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
            reportType === 'repairs'
              ? 'bg-rose-500/10 border-rose-500/50 text-rose-300 font-bold'
              : 'bg-[#161b22] border-[#30363d] text-zinc-400 hover:text-white'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span>Coste Acumulado SAT</span>
            <Wrench className="w-4 h-4 text-rose-400" />
          </div>
          <span className="text-lg font-mono text-white font-bold">
            {totalRepairCosts.toLocaleString('es-ES')} €
          </span>
        </button>

        <button
          onClick={() => setReportType('overdue')}
          className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
            reportType === 'overdue'
              ? 'bg-orange-500/10 border-orange-500/50 text-orange-300 font-bold'
              : 'bg-[#161b22] border-[#30363d] text-zinc-400 hover:text-white'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span>Devoluciones Atrasadas</span>
            <Clock className="w-4 h-4 text-orange-400" />
          </div>
          <span className="text-lg font-mono text-white font-bold">{overdueEvents.length} eventos</span>
        </button>

        <button
          onClick={() => setReportType('movements')}
          className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
            reportType === 'movements'
              ? 'bg-blue-500/10 border-blue-500/50 text-blue-300 font-bold'
              : 'bg-[#161b22] border-[#30363d] text-zinc-400 hover:text-white'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span>Movimientos Totales</span>
            <TrendingUp className="w-4 h-4 text-blue-400" />
          </div>
          <span className="text-lg font-mono text-white font-bold">{movements.length} ops</span>
        </button>
      </div>

      {/* Report Data Table */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-x-auto shadow-sm p-4 printable-document">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#30363d]">
          <h3 className="font-bold text-white text-sm">
            {reportType === 'valuation' && 'Informe de Valoración de Equipos y Stock'}
            {reportType === 'repairs' && 'Informe de Incidencias, Costes y Mantenimiento SAT'}
            {reportType === 'overdue' && 'Informe de Retornos Pendientes y Atrasos'}
            {reportType === 'movements' && 'Informe de Auditoría de Operaciones'}
          </h3>

          {reportType === 'valuation' && (
            <div className="no-print">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-[#0d1117] border border-[#30363d] rounded px-2.5 py-1 text-xs text-zinc-200"
              >
                <option value="all">Todas las categorías</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {reportType === 'valuation' && (
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0d1117] text-zinc-400 uppercase font-mono text-[10px] border-b border-[#30363d]">
              <tr>
                <th className="py-2.5 px-3">Código</th>
                <th className="py-2.5 px-3">Artículo</th>
                <th className="py-2.5 px-3">Categoría</th>
                <th className="py-2.5 px-3 text-center">Unidades</th>
                <th className="py-2.5 px-3 text-right">Coste Unitario</th>
                <th className="py-2.5 px-3 text-right">Valor Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#30363d]">
              {items
                .filter((i) => i.status === 'active' && (categoryFilter === 'all' || i.category === categoryFilter))
                .map((i) => (
                  <tr key={i.id} className="hover:bg-[#0d1117]/50">
                    <td className="py-2.5 px-3 font-mono font-bold text-amber-400">{i.code}</td>
                    <td className="py-2.5 px-3 font-medium text-white">{i.name}</td>
                    <td className="py-2.5 px-3 text-zinc-400">{i.category}</td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold">{i.totalQuantity}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-zinc-300">
                      {i.purchasePrice ? `${i.purchasePrice.toFixed(2)} €` : 'N/D'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                      {((i.purchasePrice || 0) * i.totalQuantity).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}

        {reportType === 'repairs' && (
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0d1117] text-zinc-400 uppercase font-mono text-[10px] border-b border-[#30363d]">
              <tr>
                <th className="py-2.5 px-3">Código</th>
                <th className="py-2.5 px-3">Artículo</th>
                <th className="py-2.5 px-3">Prioridad</th>
                <th className="py-2.5 px-3">Estado</th>
                <th className="py-2.5 px-3">Técnico / SAT</th>
                <th className="py-2.5 px-3 text-right">Coste Estimado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#30363d]">
              {incidents.map((inc) => (
                <tr key={inc.id} className="hover:bg-[#0d1117]/50">
                  <td className="py-2.5 px-3 font-mono font-bold text-rose-400">{inc.code}</td>
                  <td className="py-2.5 px-3 font-medium text-white">{inc.itemName}</td>
                  <td className="py-2.5 px-3 uppercase text-[10px] font-bold text-zinc-300">{inc.priority}</td>
                  <td className="py-2.5 px-3 text-amber-400">{inc.status}</td>
                  <td className="py-2.5 px-3 text-zinc-400">{inc.technician || 'SAT Interno'}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-300">
                    {inc.estimatedCost ? `${inc.estimatedCost} €` : '0 €'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {reportType === 'overdue' && (
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0d1117] text-zinc-400 uppercase font-mono text-[10px] border-b border-[#30363d]">
              <tr>
                <th className="py-2.5 px-3">Código</th>
                <th className="py-2.5 px-3">Evento</th>
                <th className="py-2.5 px-3">Cliente</th>
                <th className="py-2.5 px-3">Retorno Previsto</th>
                <th className="py-2.5 px-3 text-right">Días de Atraso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#30363d]">
              {overdueEvents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-zinc-500">
                    ✓ No hay devoluciones atrasadas en este momento.
                  </td>
                </tr>
              ) : (
                overdueEvents.map((ev) => {
                  const daysLate = Math.ceil((Date.now() - new Date(ev.returnDate).getTime()) / 86400000);
                  return (
                    <tr key={ev.id} className="hover:bg-[#0d1117]/50">
                      <td className="py-2.5 px-3 font-mono font-bold text-rose-400">{ev.code}</td>
                      <td className="py-2.5 px-3 font-medium text-white">{ev.name}</td>
                      <td className="py-2.5 px-3 text-zinc-300">{ev.clientName}</td>
                      <td className="py-2.5 px-3 font-mono text-zinc-400">
                        {new Date(ev.returnDate).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-rose-400">
                        +{daysLate} días
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {reportType === 'movements' && (
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0d1117] text-zinc-400 uppercase font-mono text-[10px] border-b border-[#30363d]">
              <tr>
                <th className="py-2.5 px-3">Fecha</th>
                <th className="py-2.5 px-3">Tipo</th>
                <th className="py-2.5 px-3">Artículo</th>
                <th className="py-2.5 px-3 text-center">Uds</th>
                <th className="py-2.5 px-3">Motivo</th>
                <th className="py-2.5 px-3 text-right">Usuario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#30363d]">
              {movements.slice(0, 50).map((m) => (
                <tr key={m.id} className="hover:bg-[#0d1117]/50">
                  <td className="py-2.5 px-3 font-mono text-zinc-400">
                    {new Date(m.timestamp).toLocaleDateString()}
                  </td>
                  <td className="py-2.5 px-3 uppercase text-[10px] font-bold text-amber-400">{m.type}</td>
                  <td className="py-2.5 px-3 font-semibold text-white">{m.itemName}</td>
                  <td className="py-2.5 px-3 text-center font-bold font-mono">{m.quantity}</td>
                  <td className="py-2.5 px-3 text-zinc-300">{m.reason}</td>
                  <td className="py-2.5 px-3 text-right text-zinc-400">{m.userName.split(' ')[0]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
