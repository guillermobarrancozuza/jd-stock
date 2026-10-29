import React from 'react';
import {
  Package,
  Layers,
  CheckCircle2,
  Calendar,
  Truck,
  Wrench,
  AlertOctagon,
  Clock,
  TrendingUp,
  RotateCcw,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  AlertTriangle,
  FileText,
  Boxes,
  History as HistoryIcon,
  FileSignature,
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts';

interface DashboardViewProps {
  onNavigate: (view: string) => void;
  onOpenQuickAction: (action: 'dispatch' | 'return' | 'incident' | 'item' | 'purchase') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate, onOpenQuickAction }) => {
  const { items, itemUnits, events, incidents, movements, contracts } = useInventory();
  const { canViewContracts, canViewFinancials } = useAuth();

  // Metrics calculation
  const totalReferences = items.filter((i) => i.status === 'active').length;
  const totalPhysicalUnits = items
    .filter((i) => i.status === 'active')
    .reduce((acc, i) => acc + i.totalQuantity, 0);
  const totalAvailable = items
    .filter((i) => i.status === 'active')
    .reduce((acc, i) => acc + i.availableQuantity, 0);
  const totalReserved = items
    .filter((i) => i.status === 'active')
    .reduce((acc, i) => acc + i.reservedQuantity, 0);
  const totalOut = items
    .filter((i) => i.status === 'active')
    .reduce((acc, i) => acc + i.outQuantity, 0);
  const totalDamaged = items
    .filter((i) => i.status === 'active')
    .reduce((acc, i) => acc + i.damagedQuantity, 0);

  // Valuation
  const totalValuation = items
    .filter((i) => i.status === 'active')
    .reduce((acc, i) => acc + i.totalQuantity * (i.purchasePrice || 0), 0);

  // Overdue returns
  const overdueEvents = events.filter((e) => {
    if (e.status !== 'pending_return' && e.status !== 'dispatched') return false;
    return new Date(e.returnDate).getTime() < Date.now();
  });

  // Low stock
  const lowStockItems = items.filter(
    (i) => i.status === 'active' && i.availableQuantity <= i.minStock
  );

  // Upcoming events
  const upcomingEvents = events
    .filter((e) => !['closed', 'cancelled'].includes(e.status))
    .sort((a, b) => new Date(a.dispatchDate).getTime() - new Date(b.dispatchDate).getTime())
    .slice(0, 5);

  // Category distribution for pie chart
  const categoryCounts: Record<string, number> = {};
  items.filter((i) => i.status === 'active').forEach((i) => {
    categoryCounts[i.category] = (categoryCounts[i.category] || 0) + i.totalQuantity;
  });

  const categoryChartData = Object.entries(categoryCounts).map(([name, value]) => ({
    name,
    value,
  }));

  const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

  // Movement activity data by type
  const movementCounts: Record<string, number> = {
    Salidas: 0,
    Entradas: 0,
    Devoluciones: 0,
    Averías: 0,
    Reservas: 0,
  };

  movements.forEach((m) => {
    if (m.type === 'dispatch') movementCounts['Salidas']++;
    else if (m.type === 'in') movementCounts['Entradas']++;
    else if (m.type === 'return') movementCounts['Devoluciones']++;
    else if (m.type === 'repair_send') movementCounts['Averías']++;
    else if (m.type === 'reserve') movementCounts['Reservas']++;
  });

  const movementsChartData = Object.entries(movementCounts).map(([type, total]) => ({
    type,
    total,
  }));

  return (
    <div className="space-y-6">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#30363d]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            Panel de Control del Almacén
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
              Operativo
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Control integral de inventario, stock disponible, reservas, salidas y devoluciones.
          </p>
        </div>

        {/* Quick Action bar (Requirement 4) */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onOpenQuickAction('dispatch')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold shadow-lg shadow-amber-500/20 transition cursor-pointer"
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Registrar Salida</span>
          </button>
          <button
            onClick={() => onOpenQuickAction('return')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Registrar Devolución</span>
          </button>
          <button
            onClick={() => onOpenQuickAction('purchase')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-[#30363d] text-xs font-semibold transition cursor-pointer"
          >
            <ArrowDownLeft className="w-3.5 h-3.5 text-blue-400" />
            <span>Entrada / Compra</span>
          </button>
          {canViewContracts && (
            <button
              onClick={() => onNavigate('contracts')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-linear-to-r from-amber-500/20 to-yellow-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition shadow-sm cursor-pointer"
            >
              <FileSignature className="w-3.5 h-3.5 text-amber-400" />
              <span>Contratos & 10% Reserva</span>
            </button>
          )}
        </div>
      </div>

      {/* Overdue Warning Banner if exists */}
      {overdueEvents.length > 0 && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-start gap-3">
          <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-rose-200">
              ¡Alerta de Devolución Atrasada! Hay {overdueEvents.length} evento(s) con material pendiente de retornar.
            </h4>
            <p className="text-xs text-rose-300/80 mt-0.5">
              El material que no ha vuelto a la hora acordada puede comprometer reservas inmediatas de próximos espectáculos.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {overdueEvents.map((ev) => (
                <button
                  key={ev.id}
                  onClick={() => onNavigate('returns')}
                  className="px-2.5 py-1 rounded bg-rose-900/60 hover:bg-rose-900 text-rose-200 text-xs font-medium border border-rose-700/50 transition cursor-pointer"
                >
                  {ev.code} — {ev.name} (Devolver)
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards Grid (Section 4) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Referencias */}
        <div
          onClick={() => onNavigate('inventory')}
          className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] hover:border-zinc-500 cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
            <span>Referencias Activas</span>
            <Package className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{totalReferences}</div>
          <div className="text-[11px] text-zinc-500 mt-1">Catálogo técnico</div>
        </div>

        {/* Total Unidades Físicas */}
        <div
          onClick={() => onNavigate('inventory')}
          className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] hover:border-zinc-500 cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
            <span>Unidades Físicas</span>
            <Boxes className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{totalPhysicalUnits}</div>
          <div className="text-[11px] text-zinc-500 mt-1">En flota total</div>
        </div>

        {/* Disponibles */}
        <div
          onClick={() => onNavigate('inventory')}
          className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] hover:border-zinc-500 cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
            <span>Disponibles en Nave</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">{totalAvailable}</div>
          <div className="text-[11px] text-zinc-500 mt-1">Listos para salida inmediata</div>
        </div>

        {/* Reservadas o Eventos Activos según rol */}
        {canViewContracts ? (
          <div
            onClick={() => onNavigate('events')}
            className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] hover:border-zinc-500 cursor-pointer transition"
          >
            <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
              <span>Reservadas para Bolos</span>
              <Calendar className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-400 font-mono">{totalReserved}</div>
            <div className="text-[11px] text-zinc-500 mt-1">Bloqueadas por fechas</div>
          </div>
        ) : (
          <div
            onClick={() => onNavigate('events')}
            className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] hover:border-zinc-500 cursor-pointer transition"
          >
            <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
              <span>Producciones Activas</span>
              <Calendar className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-blue-400 font-mono">
              {events.filter((e) => !['closed', 'cancelled'].includes(e.status)).length}
            </div>
            <div className="text-[11px] text-zinc-500 mt-1">En agenda operativa</div>
          </div>
        )}

        {/* Fuera de Almacén */}
        <div
          onClick={() => onNavigate('dispatches')}
          className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] hover:border-zinc-500 cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
            <span>Fuera de Almacén</span>
            <Truck className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-400 font-mono">{totalOut}</div>
          <div className="text-[11px] text-zinc-500 mt-1">En gira, teatro o festival</div>
        </div>

        {/* Averías y SAT */}
        <div
          onClick={() => onNavigate('maintenance')}
          className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] hover:border-zinc-500 cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
            <span>En Reparación / SAT</span>
            <Wrench className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 font-mono">{totalDamaged}</div>
          <div className="text-[11px] text-zinc-500 mt-1">Fuera de disponibilidad</div>
        </div>

        {/* Devoluciones Pendientes */}
        <div
          onClick={() => onNavigate('returns')}
          className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] hover:border-zinc-500 cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
            <span>Devoluciones Pendientes</span>
            <Clock className="w-4 h-4 text-orange-400" />
          </div>
          <div className="text-2xl font-bold text-orange-400 font-mono">
            {events.filter((e) => ['dispatched', 'pending_return'].includes(e.status)).length}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            {overdueEvents.length > 0 ? `${overdueEvents.length} con retraso` : 'Al día'}
          </div>
        </div>

        {/* Valoración de Flota o Alertas Stock según rol */}
        {canViewFinancials ? (
          <div
            onClick={() => onNavigate('reports')}
            className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] hover:border-zinc-500 cursor-pointer transition"
          >
            <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
              <span>Valor de Inventario</span>
              <DollarSign className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-cyan-400 font-mono">
              {totalValuation.toLocaleString('es-ES')} €
            </div>
            <div className="text-[11px] text-zinc-500 mt-1">Coste adquisición registrado</div>
          </div>
        ) : (
          <div
            onClick={() => onNavigate('inventory')}
            className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] hover:border-zinc-500 cursor-pointer transition"
          >
            <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
              <span>Alertas Stock Mínimo</span>
              <AlertTriangle className="w-4 h-4 text-orange-400" />
            </div>
            <div className="text-2xl font-bold text-orange-400 font-mono">
              {lowStockItems.length}
            </div>
            <div className="text-[11px] text-zinc-500 mt-1">Necesitan reposición</div>
          </div>
        )}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Movements by Type Chart */}
        <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              Operaciones de Stock Registradas
            </h3>
            <span className="text-xs text-zinc-500">Histórico inmutable</span>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={movementsChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" vertical={false} />
                <XAxis dataKey="type" stroke="#8b949e" tick={{ fontSize: 11 }} />
                <YAxis stroke="#8b949e" tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#161b22', borderColor: '#30363d', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                />
                <Bar dataKey="total" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Operaciones" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown Pie Chart */}
        <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              Distribución de Material por Categoría
            </h3>
            <span className="text-xs text-zinc-500">Unidades totales</span>
          </div>
          <div className="h-60 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryChartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={45}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }: { name?: string; percent?: number }) => `${name || ''} (${(((percent || 0)) * 100).toFixed(0)}%)`}
                  labelLine={false}
                >
                  {categoryChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#161b22', borderColor: '#30363d', borderRadius: 8, fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Two Column Section: Próximos Eventos & Stock Bajo / Movimientos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Próximos Eventos */}
        <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              Próximos Eventos y Reservas
            </h3>
            <button
              onClick={() => onNavigate('events')}
              className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1"
            >
              Ver todos <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            {upcomingEvents.length === 0 ? (
              <p className="text-xs text-zinc-500 py-4 text-center">No hay eventos activos programados.</p>
            ) : (
              upcomingEvents.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => onNavigate('events')}
                  className="p-3 rounded-lg bg-[#0d1117] border border-[#30363d] hover:border-zinc-500 cursor-pointer transition flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold text-xs text-white flex items-center gap-2">
                      <span>{ev.name}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono">
                        {ev.code}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">
                      {ev.clientName} • Salida: {new Date(ev.dispatchDate).toLocaleDateString()}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      ev.status === 'confirmed'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : ev.status === 'dispatched'
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : ev.status === 'pending_return'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'bg-zinc-700 text-zinc-300'
                    }`}
                  >
                    {ev.status === 'confirmed'
                      ? 'Confirmado'
                      : ev.status === 'dispatched'
                      ? 'En bolo'
                      : ev.status === 'pending_return'
                      ? 'Pendiente retorno'
                      : ev.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Stock Bajo Mínimo & Movimientos Recientes */}
        <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <HistoryIcon className="w-4 h-4 text-amber-400" />
              Últimos Movimientos de Almacén
            </h3>
            <button
              onClick={() => onNavigate('movements')}
              className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1"
            >
              Auditoría completa <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            {movements.slice(0, 5).map((m) => (
              <div
                key={m.id}
                className="p-2.5 rounded-lg bg-[#0d1117] border border-[#30363d] flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      m.type === 'dispatch'
                        ? 'bg-amber-400'
                        : m.type === 'return'
                        ? 'bg-emerald-400'
                        : m.type === 'in'
                        ? 'bg-blue-400'
                        : 'bg-zinc-400'
                    }`}
                  />
                  <div>
                    <span className="font-semibold text-zinc-200">{m.itemName}</span>
                    <span className="text-[10px] text-zinc-500 block">
                      {m.quantity} uds • {m.reason}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-[10px] text-zinc-500 block truncate max-w-[100px]">{m.userName.split(' ')[0]}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Low Stock Warning */}
          {lowStockItems.length > 0 && (
            <div className="mt-4 pt-3 border-t border-[#30363d]">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-orange-400 mb-2">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Atención: {lowStockItems.length} referencias en stock mínimo</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {lowStockItems.slice(0, 4).map((it) => (
                  <span
                    key={it.id}
                    onClick={() => onNavigate('inventory')}
                    className="text-[11px] px-2 py-0.5 rounded bg-orange-950/40 text-orange-300 border border-orange-800/40 cursor-pointer hover:bg-orange-900/40"
                  >
                    {it.name}: <strong>{it.availableQuantity} {it.unit}</strong> (mín {it.minStock})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
