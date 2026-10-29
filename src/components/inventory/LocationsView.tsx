import React, { useState } from 'react';
import { MapPin, Plus, ArrowRightLeft, Wrench, Package, Truck, AlertCircle } from 'lucide-react';
import { useInventory } from '../../context/InventoryContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';

export const LocationsView: React.FC = () => {
  const { locations, items, saveLocation, transferEquipment } = useInventory();
  const { canManageInventory } = useAuth();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [warehouse, setWarehouse] = useState('Nave Central');
  const [zone, setZone] = useState('');
  const [description, setDescription] = useState('');
  const [isRepairZone, setIsRepairZone] = useState(false);

  // Transfer modal state
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferItemId, setTransferItemId] = useState(items[0]?.id || '');
  const [transferQty, setTransferQty] = useState(1);
  const [sourceLoc, setSourceLoc] = useState('');
  const [targetLoc, setTargetLoc] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferError, setTransferError] = useState<string | null>(null);

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zone.trim()) return;

    await saveLocation({
      warehouse: warehouse.trim(),
      zone: zone.trim(),
      description: description.trim(),
      isRepairZone,
    });

    setIsAddOpen(false);
    setZone('');
    setDescription('');
    setIsRepairZone(false);
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const item = items.find((i) => i.id === transferItemId);
    if (!item) return;

    if (transferQty <= 0) {
      setTransferError('La cantidad a trasladar debe ser mayor a 0.');
      return;
    }
    if (transferQty > item.availableQuantity) {
      setTransferError(`No puedes trasladar más unidades de las disponibles (${item.availableQuantity} uds).`);
      return;
    }
    if (sourceLoc === targetLoc) {
      setTransferError('La ubicación de origen y destino deben ser diferentes.');
      return;
    }

    try {
      setTransferError(null);
      await transferEquipment(item.id, transferQty, sourceLoc, targetLoc, transferReason || 'Reorganización de almacén');
      setIsTransferOpen(false);
      setTransferReason('');
    } catch (err: any) {
      setTransferError(err.message || 'Error al ejecutar el traslado');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#30363d]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            Almacenes y Ubicaciones Físicas
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono font-medium">
              {locations.length} ubicaciones
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Control de pasillos, estanterías, jaulas de mangueras, áreas de carga y taller SAT.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canManageInventory && (
            <>
              <button
                onClick={() => {
                  setSourceLoc(locations[0]?.zone || '');
                  setTargetLoc(locations[1]?.zone || '');
                  setIsTransferOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-[#30363d] text-xs font-semibold transition cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
                <span>Traslado entre Ubicaciones</span>
              </button>
              <button
                onClick={() => setIsAddOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva Ubicación</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Locations Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {locations.map((loc) => {
          const itemsHere = items.filter((i) => i.defaultLocationId === loc.id && i.status === 'active');
          const totalUnits = itemsHere.reduce((acc, i) => acc + i.totalQuantity, 0);

          return (
            <div
              key={loc.id}
              className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 ${
                loc.isRepairZone
                  ? 'bg-rose-950/20 border-rose-800/40'
                  : 'bg-[#161b22] border-[#30363d]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                    {loc.warehouse}
                  </span>
                  {loc.isRepairZone && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1 font-semibold">
                      <Wrench className="w-3 h-3" /> Taller SAT
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-white text-sm mt-1">{loc.zone}</h3>
                {loc.description && <p className="text-xs text-zinc-400 mt-1">{loc.description}</p>}
              </div>

              <div className="pt-3 border-t border-[#30363d] flex items-center justify-between text-xs text-zinc-400">
                <span>
                  <strong>{itemsHere.length}</strong> referencias asignadas
                </span>
                <span className="font-mono text-zinc-200">
                  <strong>{totalUnits}</strong> uds físicas
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* New Location Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-md p-5 space-y-4">
            <h3 className="font-bold text-white text-base">Crear Nueva Ubicación en Almacén</h3>
            <form onSubmit={handleSaveLocation} className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Almacén / Nave *</label>
                <input
                  type="text"
                  required
                  value={warehouse}
                  onChange={(e) => setWarehouse(e.target.value)}
                  placeholder="Ej. Nave Central, Nave 2, Almacén Móvil..."
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Zona / Estantería / Pasillo *</label>
                <input
                  type="text"
                  required
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                  placeholder="Ej. Estantería C3 - Iluminación Teatral"
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Descripción / Tipo de Carga</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Para flight cases dobles, perchas de cableado, etc."
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg p-2 text-zinc-100"
                />
              </div>

              <div className="p-3 rounded-lg bg-zinc-800/40 border border-[#30363d] flex items-center justify-between">
                <div>
                  <span className="font-semibold text-zinc-200 block">Es Zona Técnica de Reparación / SAT</span>
                  <span className="text-[10px] text-zinc-400">El material situado aquí se considera fuera de servicio</span>
                </div>
                <input
                  type="checkbox"
                  checked={isRepairZone}
                  onChange={(e) => setIsRepairZone(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded"
                />
              </div>

              <div className="pt-3 border-t border-[#30363d] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-[#30363d] text-zinc-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold"
                >
                  Guardar Ubicación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Equipment Modal */}
      {isTransferOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-md p-5 space-y-4">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-amber-400" />
              Trasladar Material entre Ubicaciones
            </h3>
            <p className="text-xs text-zinc-400">
              Registra un movimiento auditable en el historial del almacén. No se admiten traslados con stock negativo.
            </p>

            {transferError && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{transferError}</span>
              </div>
            )}

            <form onSubmit={handleExecuteTransfer} className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Artículo a Mover *</label>
                <select
                  value={transferItemId}
                  onChange={(e) => {
                    setTransferItemId(e.target.value);
                    const it = items.find((i) => i.id === e.target.value);
                    if (it) setSourceLoc(it.defaultLocationName);
                  }}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100"
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} (Disp: {i.availableQuantity} {i.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Cantidad a Mover *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={transferQty}
                  onChange={(e) => setTransferQty(Number(e.target.value))}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">Origen *</label>
                  <input
                    type="text"
                    required
                    value={sourceLoc}
                    onChange={(e) => setSourceLoc(e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">Destino *</label>
                  <select
                    value={targetLoc}
                    onChange={(e) => setTargetLoc(e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100"
                  >
                    {locations.map((l) => (
                      <option key={l.id} value={`${l.warehouse} - ${l.zone}`}>
                        {l.warehouse} — {l.zone}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Motivo del Traslado</label>
                <input
                  type="text"
                  placeholder="Ej. Reorganización de pasillo, preparación de palet..."
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100"
                />
              </div>

              <div className="pt-3 border-t border-[#30363d] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTransferOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-[#30363d] text-zinc-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold"
                >
                  Confirmar Traslado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
