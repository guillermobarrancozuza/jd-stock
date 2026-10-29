import React, { useState, useEffect } from 'react';
import {
  Wrench,
  AlertTriangle,
  X,
  Search,
  CheckCircle2,
  Camera,
  Boxes,
  QrCode,
  ShieldAlert,
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext.tsx';
import { Incident, Item, ItemUnit } from '../../types/inventory.ts';
import { QrPhotoScannerModal } from './QrPhotoScannerModal.tsx';

interface DirectDamageReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceContext: 'dispatch' | 'return' | 'warehouse';
  referenceName?: string;
  defaultItemId?: string;
}

export const DirectDamageReportModal: React.FC<DirectDamageReportModalProps> = ({
  isOpen,
  onClose,
  sourceContext,
  referenceName,
  defaultItemId,
}) => {
  const { items, itemUnits, reportDamageDirectly } = useInventory();

  const [selectedItemId, setSelectedItemId] = useState<string>(defaultItemId || '');
  const [searchItem, setSearchItem] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedSerials, setSelectedSerials] = useState<string[]>([]);
  const [priority, setPriority] = useState<Incident['priority']>('high');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCode, setSuccessCode] = useState<string | null>(null);

  // QR Scanner modal for scanning broken unit QR code
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  useEffect(() => {
    if (defaultItemId) {
      setSelectedItemId(defaultItemId);
    }
  }, [defaultItemId, isOpen]);

  if (!isOpen) return null;

  const selectedItem = items.find((i) => i.id === selectedItemId);
  const filteredItems = items.filter(
    (i) =>
      i.name.toLowerCase().includes(searchItem.toLowerCase()) ||
      i.code.toLowerCase().includes(searchItem.toLowerCase()) ||
      i.brand?.toLowerCase().includes(searchItem.toLowerCase()) ||
      i.model?.toLowerCase().includes(searchItem.toLowerCase())
  );

  const unitsForSelectedItem = selectedItem
    ? itemUnits.filter((u) => u.itemId === selectedItem.id && u.status !== 'lost')
    : [];

  const handleUnitSelected = (result: {
    unit: ItemUnit | null;
    item: Item | null;
    serialNumber: string;
  }) => {
    setIsScannerOpen(false);
    if (result.item) {
      setSelectedItemId(result.item.id);
    }
    if (result.unit) {
      setSelectedItemId(result.unit.itemId);
      if (!selectedSerials.includes(result.unit.serialNumber)) {
        setSelectedSerials((prev) => [...prev, result.unit!.serialNumber]);
      }
    } else if (result.serialNumber) {
      if (!selectedSerials.includes(result.serialNumber)) {
        setSelectedSerials((prev) => [...prev, result.serialNumber]);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedItemId) {
      setError('Por favor selecciona el artículo que presenta la avería.');
      return;
    }
    if (quantity <= 0) {
      setError('La cantidad debe ser mayor que 0.');
      return;
    }
    if (!description.trim()) {
      setError('Indica la descripción técnica del fallo o rotura.');
      return;
    }

    setIsSubmitting(true);
    try {
      const inc = await reportDamageDirectly({
        itemId: selectedItemId,
        quantity,
        serialNumbers: selectedSerials,
        description: description.trim(),
        sourceContext,
        referenceName,
        priority,
      });

      setSuccessCode(inc.code);
      setTimeout(() => {
        setSuccessCode(null);
        setSelectedItemId('');
        setDescription('');
        setSelectedSerials([]);
        setQuantity(1);
        onClose();
      }, 1500);
    } catch (err: unknown) {
      setError((err as Error).message || 'Error al reportar la avería al SAT');
    } finally {
      setIsSubmitting(false);
    }
  };

  const contextTitle =
    sourceContext === 'dispatch'
      ? 'Avería / Rotura detectada en Salida o Expedición'
      : sourceContext === 'return'
      ? 'Avería / Rotura detectada en Retorno de Evento'
      : 'Envío Directo de Material Averiado a SAT';

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs">
        <div className="bg-[#161b22] border border-[#30363d] w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-[#30363d] flex items-center justify-between bg-gradient-to-r from-rose-950/40 via-[#161b22] to-[#161b22]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <span>Reportar Material Roto a SAT</span>
                  {referenceName && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                      {referenceName}
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-zinc-400">{contextTitle}</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Form */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {successCode && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 flex items-center gap-2 font-bold animate-in fade-in">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>¡Incidencia {successCode} creada y material derivado a Taller SAT con éxito!</span>
              </div>
            )}

            {/* Quick QR Scanner Trigger */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#0d1117] border border-[#30363d]">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-cyan-400" />
                <span className="text-zinc-300 text-xs">¿Tienes la unidad rota delante?</span>
              </div>
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Escanear QR / NS</span>
              </button>
            </div>

            {/* Item Selection */}
            <div>
              <label className="block text-zinc-300 font-semibold mb-1">
                Artículo Afectado <span className="text-rose-400">*</span>
              </label>
              <div className="space-y-1.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchItem}
                    onChange={(e) => setSearchItem(e.target.value)}
                    placeholder="Filtrar por nombre, marca o modelo..."
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg pl-8 pr-3 py-1.5 text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <select
                  value={selectedItemId}
                  onChange={(e) => {
                    setSelectedItemId(e.target.value);
                    setSelectedSerials([]);
                  }}
                  required
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Selecciona el equipo averiado --</option>
                  {filteredItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      [{item.code}] {item.name} ({item.brand}) • En almacén: {item.availableQuantity} uds • Dañados: {item.damagedQuantity}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quantity and Priority */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Cantidad Rota <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Urgencia / Prioridad
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Incident['priority'])}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                >
                  <option value="low">Baja (Mantenimiento preventivo)</option>
                  <option value="medium">Media (Revisar en taller)</option>
                  <option value="high">Alta (Requiere reparación antes de próximo evento)</option>
                  <option value="critical">Crítica / Urgente (Urgente para evento)</option>
                </select>
              </div>
            </div>

            {/* Serial Numbers (if item is serialized) */}
            {selectedItem?.hasSerialNumbers && unitsForSelectedItem.length > 0 && (
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Número de Serie de la Unidad Rota (Opcional)
                </label>
                <div className="p-2.5 rounded-lg bg-[#0d1117] border border-[#30363d] max-h-32 overflow-y-auto space-y-1.5">
                  {unitsForSelectedItem.map((u) => {
                    const isChecked = selectedSerials.includes(u.serialNumber);
                    return (
                      <label
                        key={u.id}
                        className="flex items-center gap-2 text-[11px] text-zinc-300 hover:text-white cursor-pointer select-none"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSerials((prev) => [...prev, u.serialNumber]);
                            } else {
                              setSelectedSerials((prev) => prev.filter((s) => s !== u.serialNumber));
                            }
                          }}
                          className="rounded border-zinc-700 text-rose-500 focus:ring-0"
                        />
                        <span className="font-mono font-bold text-amber-300">{u.serialNumber}</span>
                        <span className="text-zinc-500 text-[10px]">({u.status} - {u.locationName})</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-zinc-300 font-semibold mb-1">
                Descripción de la Avería o Rotura <span className="text-rose-400">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                required
                placeholder="Ej: Golpe en carcasa, lente astillada, driver de agudos quemado tras evento, cable cortado en conector XLR..."
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg p-2.5 text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#30363d]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || Boolean(successCode)}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-rose-500/20 cursor-pointer disabled:opacity-50"
              >
                <Wrench className="w-4 h-4" />
                <span>{isSubmitting ? 'Registrando en SAT...' : 'Enviar a Taller / Averías'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* QR Photo Scanner */}
      <QrPhotoScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        items={items}
        itemUnits={itemUnits}
        onUnitSelected={handleUnitSelected}
        title="Escanear QR de la Unidad Averiada"
      />
    </>
  );
};
