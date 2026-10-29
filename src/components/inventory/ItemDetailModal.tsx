import React, { useState } from 'react';
import {
  X,
  Edit,
  Archive,
  QrCode,
  Plus,
  History,
  CheckCircle,
  Truck,
  Wrench,
  AlertTriangle,
  Clock,
  MapPin,
  Tag,
  Barcode as BarcodeIcon,
} from 'lucide-react';
import { Item, ItemUnit } from '../../types/inventory.ts';
import { useInventory } from '../../context/InventoryContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { QrBarcodeModal } from './QrBarcodeModal.tsx';

interface ItemDetailModalProps {
  item: Item | null;
  onClose: () => void;
  onEdit: (item: Item) => void;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({ item, onClose, onEdit }) => {
  const { itemUnits, movements, saveItemUnit, archiveItem } = useInventory();
  const { canManageInventory, canViewFinancials } = useAuth();

  const [activeTab, setActiveTab] = useState<'overview' | 'units' | 'movements'>('overview');
  const [newSerial, setNewSerial] = useState('');
  const [addingUnit, setAddingUnit] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [showQrItem, setShowQrItem] = useState(false);
  const [selectedUnitForQr, setSelectedUnitForQr] = useState<ItemUnit | null>(null);

  if (!item) return null;

  const units = itemUnits.filter((u) => u.itemId === item.id);
  const itemMovements = movements.filter((m) => m.itemId === item.id);

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSerial.trim()) return;

    try {
      await saveItemUnit({
        itemId: item.id,
        serialNumber: newSerial.trim(),
        locationId: item.defaultLocationId,
        locationName: item.defaultLocationName,
        status: 'available',
      });
      setNewSerial('');
      setAddingUnit(false);
    } catch (err: any) {
      alert(err.message || 'Error al añadir unidad');
    }
  };

  const handleArchive = async () => {
    if (!window.confirm(`¿Estás seguro de que deseas archivar la referencia "${item.name}"? Los movimientos históricos se conservarán.`)) {
      return;
    }

    try {
      setArchiveError(null);
      await archiveItem(item.id, 'Archivado manual desde ficha técnica');
      onClose();
    } catch (err: any) {
      setArchiveError(err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto no-print">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-[#30363d] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-bold">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-white">{item.name}</h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-zinc-800 text-amber-400 border border-amber-500/30">
                  {item.code}
                </span>
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  GRUPO: {item.group || 'GENERAL'}
                </span>
              </div>
              <div className="text-xs text-zinc-400 flex items-center gap-2 mt-0.5">
                <span>{item.category} • {item.brand} {item.model}</span>
                {item.barcode && (
                  <span className="font-mono text-[10px] text-zinc-500 flex items-center gap-0.5">
                    <BarcodeIcon className="w-3 h-3" /> {item.barcode}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQrItem(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold transition"
              title="Ver QR, código de barras y generar etiqueta"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Etiqueta / QR</span>
            </button>
            {canManageInventory && (
              <button
                onClick={() => onEdit(item)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-[#30363d] text-xs font-semibold transition"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Editar</span>
              </button>
            )}
            <button onClick={onClose} className="text-zinc-400 hover:text-white transition p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-4 border-b border-[#30363d] flex items-center gap-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 border-b-2 transition ${
              activeTab === 'overview'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Ficha General & Stock
          </button>
          <button
            onClick={() => setActiveTab('units')}
            className={`py-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'units'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>Unidades Físicas (N/S)</span>
            <span className="px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-300 text-[10px]">
              {units.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('movements')}
            className={`py-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'movements'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Historial Inmutable</span>
            <span className="px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-300 text-[10px]">
              {itemMovements.length}
            </span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {archiveError && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{archiveError}</span>
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Quantities breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-3 rounded-xl bg-[#0d1117] border border-[#30363d] text-center">
                <div className="p-2 rounded bg-zinc-800/40">
                  <span className="text-[10px] text-zinc-400 block">Total Flota</span>
                  <span className="text-xl font-bold text-white font-mono">{item.totalQuantity}</span>
                </div>
                <div className="p-2 rounded bg-emerald-950/30 border border-emerald-800/30">
                  <span className="text-[10px] text-emerald-400 block font-semibold">Disponibles</span>
                  <span className="text-xl font-bold text-emerald-400 font-mono">{item.availableQuantity}</span>
                </div>
                <div className="p-2 rounded bg-amber-950/30 border border-amber-800/30">
                  <span className="text-[10px] text-amber-400 block font-semibold">Reservados</span>
                  <span className="text-xl font-bold text-amber-400 font-mono">{item.reservedQuantity}</span>
                </div>
                <div className="p-2 rounded bg-purple-950/30 border border-purple-800/30">
                  <span className="text-[10px] text-purple-400 block font-semibold">Fuera (Bolos)</span>
                  <span className="text-xl font-bold text-purple-400 font-mono">{item.outQuantity}</span>
                </div>
                <div className="p-2 rounded bg-rose-950/30 border border-rose-800/30">
                  <span className="text-[10px] text-rose-400 block font-semibold">Averiados / SAT</span>
                  <span className="text-xl font-bold text-rose-400 font-mono">{item.damagedQuantity}</span>
                </div>
              </div>

              {/* Technical specs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-[#0d1117] border border-[#30363d] space-y-2">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                    Ubicación y Almacén
                  </span>
                  <div className="flex items-center gap-2 text-zinc-200">
                    <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{item.defaultLocationName}</span>
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    Stock mínimo de alerta: <strong>{item.minStock} {item.unit}</strong>
                  </div>
                </div>

                {canViewFinancials ? (
                  <div className="p-3.5 rounded-xl bg-[#0d1117] border border-[#30363d] space-y-2">
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                      Datos Económicos & Proveedor
                    </span>
                    <div className="text-zinc-200">
                      Proveedor: <strong>{item.supplier || 'No especificado'}</strong>
                    </div>
                    <div className="text-zinc-200">
                      Precio Compra Unitario: <strong>{item.purchasePrice ? `${item.purchasePrice} €` : 'N/D'}</strong>
                    </div>
                    <div className="text-cyan-400 font-semibold">
                      Valor total de referencia:{' '}
                      <strong>{((item.purchasePrice || 0) * item.totalQuantity).toLocaleString('es-ES')} €</strong>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-[#0d1117] border border-[#30363d] space-y-2">
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                      Gestión Operativa del Material
                    </span>
                    <div className="text-zinc-300">
                      Unidades serializadas: <strong>{units.length} registradas</strong>
                    </div>
                    <div className="text-zinc-300">
                      Tipo de control: <strong>{item.hasSerialNumbers ? 'Por Nº de Serie individual (QR/Barcode)' : 'Control por Lote/Bulto'}</strong>
                    </div>
                    <div className="text-emerald-400 text-[11px] font-medium">
                      ✓ Material habilitado para salidas de bolos y albaranes.
                    </div>
                  </div>
                )}
              </div>

              {item.description && (
                <div className="p-3.5 rounded-xl bg-[#0d1117] border border-[#30363d]">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                    Descripción & Accesorios
                  </span>
                  <p className="text-zinc-300 leading-relaxed">{item.description}</p>
                </div>
              )}

              {item.notes && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block mb-1">
                    Notas y Observaciones
                  </span>
                  <p className="text-amber-200">{item.notes}</p>
                </div>
              )}

              {/* Archive action (Section 5: Soft delete with history preservation) */}
              {canManageInventory && (
                <div className="pt-4 border-t border-[#30363d] flex items-center justify-between">
                  <div className="text-zinc-400 text-[11px]">
                    {item.status === 'archived' ? (
                      <span className="text-orange-400 font-semibold">Esta referencia se encuentra archivada.</span>
                    ) : (
                      'Para descatalogar el material sin perder la auditoría de movimientos históricos.'
                    )}
                  </div>
                  {item.status !== 'archived' && (
                    <button
                      onClick={handleArchive}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 border border-rose-800/60 font-semibold transition cursor-pointer"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>Archivar Referencia</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'units' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white">Unidades Físicas con Número de Serie</h3>
                  <p className="text-[11px] text-zinc-400">
                    Permite identificar exactamente cada equipo en los albaranes de salida y devoluciones.
                  </p>
                </div>
                {canManageInventory && (
                  <button
                    onClick={() => setAddingUnit(!addingUnit)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Añadir N/S</span>
                  </button>
                )}
              </div>

              {addingUnit && (
                <form
                  onSubmit={handleAddUnit}
                  className="p-3 rounded-xl bg-[#0d1117] border border-[#30363d] flex items-center gap-3"
                >
                  <input
                    type="text"
                    required
                    placeholder="Introduce el Número de Serie (ej. SN-2026-990)..."
                    value={newSerial}
                    onChange={(e) => setNewSerial(e.target.value)}
                    className="flex-1 bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-1.5 text-zinc-100 font-mono text-xs focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition"
                  >
                    Guardar Unidad
                  </button>
                </form>
              )}

              {units.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 bg-[#0d1117] rounded-xl border border-[#30363d]">
                  No se han registrado números de serie individuales para este artículo.
                </div>
              ) : (
                <div className="divide-y divide-[#30363d] border border-[#30363d] rounded-xl overflow-hidden bg-[#0d1117]">
                  {units.map((u) => (
                    <div key={u.id} className="p-3 flex items-center justify-between hover:bg-[#161b22] transition">
                      <div>
                        <div className="font-mono font-bold text-white flex items-center gap-2">
                          <span>{u.serialNumber}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                            {u.qrCode}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-0.5">
                          {u.locationName} {u.currentEventName && `• En bolo: ${u.currentEventName}`}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedUnitForQr(u)}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-amber-400 text-[11px] font-semibold transition"
                          title="Imprimir etiqueta adhesiva para esta unidad física"
                        >
                          <QrCode className="w-3 h-3" />
                          <span>Etiqueta N/S</span>
                        </button>

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                            u.status === 'available'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              : u.status === 'in_event'
                              ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                              : u.status === 'damaged' || u.status === 'maintenance'
                              ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                          }`}
                        >
                          {u.status === 'available'
                            ? 'Disponible'
                            : u.status === 'in_event'
                            ? 'En Evento'
                            : u.status === 'damaged'
                            ? 'Averiado'
                            : u.status === 'maintenance'
                            ? 'En Reparación'
                            : 'Reservado'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'movements' && (
            <div className="space-y-3">
              <h3 className="font-semibold text-white">Registro Inmutable de Movimientos</h3>
              {itemMovements.length === 0 ? (
                <p className="text-zinc-500 text-center py-6">Sin movimientos históricos registrados aún.</p>
              ) : (
                <div className="space-y-2">
                  {itemMovements.map((m) => (
                    <div
                      key={m.id}
                      className="p-3 rounded-lg bg-[#0d1117] border border-[#30363d] flex items-start justify-between"
                    >
                      <div>
                        <div className="font-medium text-zinc-200 flex items-center gap-2">
                          <span className="font-bold text-amber-400 uppercase text-[10px] font-mono">
                            {m.type}
                          </span>
                          <span>— {m.reason}</span>
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-0.5">
                          De: <strong>{m.sourceLocation}</strong> → A: <strong>{m.targetLocation}</strong>
                        </div>
                        {m.notes && <div className="text-[11px] text-zinc-500 mt-0.5">{m.notes}</div>}
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-zinc-200">{m.quantity} uds</span>
                        <div className="text-[10px] text-zinc-500 mt-0.5">
                          {new Date(m.timestamp).toLocaleDateString()} {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="text-[10px] text-zinc-400">{m.userName.split(' ')[0]}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* QR & Barcode for Reference */}
      {showQrItem && (
        <QrBarcodeModal
          isOpen={showQrItem}
          onClose={() => setShowQrItem(false)}
          item={item}
        />
      )}

      {/* QR & Barcode for Physical Serialized Unit */}
      {selectedUnitForQr && (
        <QrBarcodeModal
          isOpen={Boolean(selectedUnitForQr)}
          onClose={() => setSelectedUnitForQr(null)}
          item={item}
          unit={selectedUnitForQr}
        />
      )}
    </div>
  );
};
