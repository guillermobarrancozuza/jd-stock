import React, { useState } from 'react';
import {
  ClipboardList,
  Plus,
  CheckCircle,
  AlertTriangle,
  FileCheck,
  ShieldAlert,
  ArrowRight,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { InventorySession, InventorySessionLine } from '../../types/inventory.ts';
import { useInventory } from '../../context/InventoryContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';

export const InventoryAuditView: React.FC = () => {
  const { inventorySessions, items, createInventorySession, saveInventoryCount, regularizeInventory } =
    useInventory();
  const { userProfile, canManageInventory } = useAuth();

  const [activeSession, setActiveSession] = useState<InventorySession | null>(
    inventorySessions.find((s) => s.status === 'in_progress' || s.status === 'pending_approval') || null
  );

  const [counts, setCounts] = useState<Record<string, { counted: number; reason: string }>>({});
  const [selectedWarehouse, setSelectedWarehouse] = useState('Nave Central');
  const [isStartingNew, setIsStartingNew] = useState(false);

  const handleStartSession = async () => {
    const session = await createInventorySession(selectedWarehouse);
    setActiveSession(session);
    setIsStartingNew(false);

    const initialCounts: typeof counts = {};
    session.lines.forEach((l) => {
      initialCounts[l.itemId] = {
        counted: l.theoreticalQty,
        reason: '',
      };
    });
    setCounts(initialCounts);
  };

  const handleCountChange = (itemId: string, counted: number) => {
    setCounts((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        counted,
      },
    }));
  };

  const handleReasonChange = (itemId: string, reason: string) => {
    setCounts((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        reason,
      },
    }));
  };

  const handleSaveAndReview = async () => {
    if (!activeSession) return;

    const updatedLines: InventorySessionLine[] = activeSession.lines.map((l) => {
      const recorded = counts[l.itemId] || { counted: l.theoreticalQty, reason: '' };
      return {
        ...l,
        countedQty: recorded.counted,
        discrepancy: recorded.counted - l.theoreticalQty,
        reason: recorded.reason,
      };
    });

    await saveInventoryCount(activeSession.id, updatedLines);
    setActiveSession({
      ...activeSession,
      lines: updatedLines,
      status: 'pending_approval',
    });
  };

  const handleAuthorizeRegularization = async () => {
    if (!activeSession) return;
    if (
      !window.confirm(
        '¿Confirmar la regularización de inventario? Se ajustarán permanentemente las existencias en almacén y se registrarán movimientos compensatorios de auditoría.'
      )
    ) {
      return;
    }

    await regularizeInventory(activeSession.id, userProfile?.name || 'Administrador');
    setActiveSession(null);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#30363d]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-amber-400" />
            Inventarios Físicos y Regularizaciones
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Recuento presencial de material, detección de descuadres teóricos vs reales y regularizaciones auditadas.
          </p>
        </div>

        {canManageInventory && !activeSession && (
          <button
            onClick={() => setIsStartingNew(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Iniciar Sesión de Conteo</span>
          </button>
        )}
      </div>

      {/* Start new session dialog */}
      {isStartingNew && (
        <div className="p-4 rounded-xl bg-[#161b22] border border-amber-500/40 space-y-3 text-xs">
          <h3 className="font-bold text-white text-sm">Nueva Sesión de Recuento Físico</h3>
          <p className="text-zinc-400">
            Se generará una instantánea de las existencias teóricas actuales de todos los artículos para comparar con el recuento real.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              placeholder="Almacén o Nave..."
              className="bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 flex-1 max-w-xs"
            />
            <button
              onClick={handleStartSession}
              className="px-4 py-2 rounded-lg bg-amber-500 text-black font-bold"
            >
              Comenzar Recuento
            </button>
            <button
              onClick={() => setIsStartingNew(false)}
              className="px-3 py-2 rounded-lg border border-[#30363d] text-zinc-400 hover:text-white"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Active Counting Session */}
      {activeSession ? (
        <div className="p-5 rounded-2xl bg-[#161b22] border border-amber-500/50 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#30363d]">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-amber-400 text-sm">{activeSession.code}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  {activeSession.status === 'in_progress' ? 'Recuento en Curso' : 'Pendiente de Autorización'}
                </span>
              </div>
              <div className="text-xs text-zinc-400 mt-0.5">
                Almacén: <strong>{activeSession.warehouse}</strong> • Iniciado por:{' '}
                <strong>{activeSession.startedBy}</strong> • {new Date(activeSession.startDate).toLocaleDateString()}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {activeSession.status === 'in_progress' ? (
                <button
                  onClick={handleSaveAndReview}
                  className="px-4 py-2 rounded-lg bg-amber-500 text-black font-bold text-xs shadow-md"
                >
                  Guardar Conteo y Revisar Descuadres
                </button>
              ) : (
                canManageInventory && (
                  <button
                    onClick={handleAuthorizeRegularization}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20"
                  >
                    <FileCheck className="w-4 h-4" />
                    <span>Autorizar Regularización en Stock</span>
                  </button>
                )
              )}
            </div>
          </div>

          {/* Lines Table */}
          <div className="border border-[#30363d] rounded-xl overflow-x-auto bg-[#0d1117]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#161b22] text-zinc-400 uppercase font-semibold border-b border-[#30363d] text-[10px] font-mono">
                <tr>
                  <th className="py-2.5 px-3">Código</th>
                  <th className="py-2.5 px-3">Artículo</th>
                  <th className="py-2.5 px-3 text-center">Teórico</th>
                  <th className="py-2.5 px-3 text-center">Contado Real</th>
                  <th className="py-2.5 px-3 text-center">Diferencia</th>
                  <th className="py-2.5 px-3">Motivo / Justificación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#30363d]">
                {activeSession.lines.map((line) => {
                  const state = counts[line.itemId] || { counted: line.theoreticalQty, reason: '' };
                  const diff = state.counted - line.theoreticalQty;

                  return (
                    <tr key={line.itemId} className="hover:bg-[#161b22]/40 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-amber-400">{line.itemCode}</td>
                      <td className="py-2.5 px-3 font-medium text-white">{line.itemName}</td>
                      <td className="py-2.5 px-3 text-center font-bold font-mono text-zinc-300">
                        {line.theoreticalQty}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {activeSession.status === 'in_progress' ? (
                          <input
                            type="number"
                            min="0"
                            value={state.counted}
                            onChange={(e) => handleCountChange(line.itemId, Number(e.target.value))}
                            className="w-16 bg-[#161b22] border border-[#30363d] rounded px-2 py-1 text-center font-mono font-bold text-white"
                          />
                        ) : (
                          <span className="font-mono font-bold text-white">{line.countedQty}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold">
                        {diff === 0 ? (
                          <span className="text-zinc-500">0</span>
                        ) : diff > 0 ? (
                          <span className="text-emerald-400 flex items-center justify-center gap-0.5">
                            <TrendingUp className="w-3 h-3" /> +{diff}
                          </span>
                        ) : (
                          <span className="text-rose-400 flex items-center justify-center gap-0.5">
                            <TrendingDown className="w-3 h-3" /> {diff}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {activeSession.status === 'in_progress' ? (
                          <input
                            type="text"
                            placeholder={diff !== 0 ? 'Indica justificación del descuadre...' : 'Conforme'}
                            value={state.reason}
                            onChange={(e) => handleReasonChange(line.itemId, e.target.value)}
                            className="w-full bg-[#161b22] border border-[#30363d] rounded px-2 py-1 text-zinc-200 text-xs"
                          />
                        ) : (
                          <span className="text-zinc-400">{line.reason || 'Sin justificación'}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Historical Sessions */}
      <div className="space-y-3">
        <h3 className="font-bold text-white text-sm">Historial de Regularizaciones e Inventarios</h3>
        {inventorySessions.length === 0 ? (
          <div className="text-center py-12 bg-[#161b22] border border-[#30363d] rounded-xl text-zinc-500 text-xs">
            No se han registrado sesiones de inventario físico previas.
          </div>
        ) : (
          inventorySessions.map((s) => (
            <div
              key={s.id}
              className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] flex items-center justify-between text-xs"
            >
              <div>
                <div className="font-mono font-bold text-amber-400 text-sm flex items-center gap-2">
                  <span>{s.code}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                      s.status === 'approved'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {s.status === 'approved' ? 'Regularizado y Auditado' : s.status}
                  </span>
                </div>
                <div className="text-zinc-400 mt-1">
                  Almacén: <strong>{s.warehouse}</strong> • Iniciado por: {s.startedBy}
                  {s.approvedBy && ` • Aprobado por: ${s.approvedBy}`}
                </div>
              </div>
              <div className="text-right font-mono">
                <span className="text-zinc-400 text-[11px]">
                  Fecha: {new Date(s.startDate).toLocaleDateString()}
                </span>
                <span className="block text-zinc-200 font-bold mt-0.5">
                  {s.lines.filter((l) => l.discrepancy !== 0).length} descuadres resueltos
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
