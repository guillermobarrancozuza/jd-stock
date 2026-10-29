import React, { useState, useMemo } from 'react';
import {
  QrCode,
  Search,
  Filter,
  Plus,
  MapPin,
  Calendar,
  Wrench,
  CheckCircle,
  Truck,
  AlertTriangle,
  RotateCcw,
  Layers,
  Package,
  Camera,
} from 'lucide-react';
import { ItemUnit, AV_GROUPS, Item } from '../../types/inventory.ts';
import { useInventory } from '../../context/InventoryContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { QrBarcodeModal } from './QrBarcodeModal.tsx';
import { ItemFormModal } from './ItemFormModal.tsx';
import { QrPhotoScannerModal } from '../maintenance/QrPhotoScannerModal.tsx';

export const UnitsView: React.FC = () => {
  const { itemUnits, items, locations, saveItemUnit, createIncident } = useInventory();
  const { canManageInventory, canEditIncidents } = useAuth();

  // Top Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [selectedItemId, setSelectedItemId] = useState<string>('all');
  const [selectedUnitForQr, setSelectedUnitForQr] = useState<ItemUnit | null>(null);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);

  // State to open Item Catalog Form directly from here
  const [isItemFormOpen, setIsItemFormOpen] = useState(false);

  // Incident reporting state
  const [incidentModalUnit, setIncidentModalUnit] = useState<ItemUnit | null>(null);
  const [incidentDescription, setIncidentDescription] = useState('');

  // Items grouped by Technical Group for optgroups in filter
  const itemsGroupedByAvGroup = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const it of items) {
      const g = it.group || 'OTROS';
      if (!map.has(g)) {
        map.set(g, []);
      }
      map.get(g)!.push(it);
    }
    return map;
  }, [items]);

  // Filter units for main view
  const filteredUnits = useMemo(() => {
    return itemUnits.filter((u) => {
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (selectedItemId !== 'all' && u.itemId !== selectedItemId) return false;
      if (groupFilter !== 'all') {
        const parent = items.find((i) => i.id === u.itemId);
        if (parent?.group !== groupFilter) return false;
      }

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        u.serialNumber.toLowerCase().includes(q) ||
        u.itemCode.toLowerCase().includes(q) ||
        u.itemName.toLowerCase().includes(q) ||
        u.qrCode.toLowerCase().includes(q) ||
        (u.currentEventName && u.currentEventName.toLowerCase().includes(q))
      );
    });
  }, [itemUnits, statusFilter, selectedItemId, groupFilter, search, items]);

  const handleReportIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentModalUnit || !incidentDescription.trim()) return;

    try {
      await createIncident({
        itemId: incidentModalUnit.itemId,
        itemName: incidentModalUnit.itemName,
        itemCode: incidentModalUnit.itemCode,
        unitId: incidentModalUnit.id,
        serialNumber: incidentModalUnit.serialNumber,
        detectionDate: new Date().toISOString().split('T')[0],
        reportedBy: 'Técnico de guardia',
        priority: 'high',
        status: 'new',
        description: incidentDescription.trim(),
      });

      // Update unit status to damaged
      await saveItemUnit({
        ...incidentModalUnit,
        status: 'damaged',
        notes: incidentDescription.trim(),
      });

      setIncidentModalUnit(null);
      setIncidentDescription('');
    } catch (err: unknown) {
      alert((err as Error).message || 'Error al registrar avería');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#30363d]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            Unidades Individuales y Números de Serie
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono font-medium">
              {filteredUnits.length} equipos en seguimiento
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Panel de control operativo, trazabilidad por N/S, impresión de QR para flightcases y gestión SAT.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsQrScannerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-[#30363d] text-xs font-bold transition shadow-sm cursor-pointer"
            title="Escanear o echar foto al QR de una unidad física para localizarla"
          >
            <Camera className="w-4 h-4" />
            <span>Foto / Escanear QR</span>
          </button>

          {canManageInventory && (
            <button
              onClick={() => setIsItemFormOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition shadow-lg shadow-amber-500/20 cursor-pointer"
              title="Dar de alta nuevo equipo en el catálogo con sus datos técnicos y números de serie"
            >
              <Plus className="w-4 h-4" />
              <span>+ Dar de Alta en Catálogo</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-[#161b22] p-3.5 rounded-xl border border-[#30363d] text-xs">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por N/S, código o evento..."
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg pl-9 pr-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Technical Group Filter */}
        <div>
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
          >
            <option value="all">⚡ Todos los grupos técnicos</option>
            {AV_GROUPS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        {/* Specific Item Filter (Grouped with optgroup) */}
        <div>
          <select
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(e.target.value)}
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
          >
            <option value="all">Todos los modelos y artículos</option>
            {Array.from(itemsGroupedByAvGroup.entries()).map(([grp, groupItems]) => (
              <optgroup key={grp} label={`── ${grp} ──`}>
                {groupItems.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.code} — {it.brand ? `${it.brand} ` : ''}{it.model || it.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
          >
            <option value="all">Todos los estados</option>
            <option value="available">🟢 Disponible en almacén</option>
            <option value="in_event">🟣 En evento / fuera</option>
            <option value="reserved">🟡 Reservado para bolo</option>
            <option value="damaged">🔴 Averiado</option>
            <option value="maintenance">🔧 En mantenimiento / SAT</option>
          </select>
        </div>
      </div>

      {/* Units Table */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-x-auto shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0d1117] text-zinc-400 uppercase font-semibold border-b border-[#30363d] text-[11px] font-mono">
            <tr>
              <th className="py-3 px-4">Número de Serie</th>
              <th className="py-3 px-4">Código QR</th>
              <th className="py-3 px-4">Artículo / Equipo</th>
              <th className="py-3 px-4">Grupo / Categoría</th>
              <th className="py-3 px-4">Estado Actual</th>
              <th className="py-3 px-4">Ubicación Actual</th>
              <th className="py-3 px-4">Evento Asignado</th>
              <th className="py-3 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#30363d]">
            {filteredUnits.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-zinc-500">
                  No se encontraron unidades con los filtros especificados.
                </td>
              </tr>
            ) : (
              filteredUnits.map((unit) => {
                const parent = items.find((i) => i.id === unit.itemId);
                return (
                  <tr key={unit.id} className="hover:bg-[#0d1117]/60 transition">
                    <td className="py-3 px-4 font-mono font-bold text-white flex items-center gap-1.5">
                      <QrCode className="w-3.5 h-3.5 text-amber-400" />
                      <span>{unit.serialNumber}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-zinc-400">{unit.qrCode}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-zinc-200">
                        {parent?.brand ? `${parent.brand} ` : ''}{parent?.model || unit.itemName}
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-1.5">
                        <span className="text-amber-400/90">{unit.itemCode}</span>
                        {unit.notes && (
                          <span className="text-zinc-400 italic font-sans">• {unit.notes}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-zinc-800 text-[10px] font-mono font-medium text-zinc-300 border border-zinc-700/60 block w-fit mb-0.5">
                        {parent?.group || 'AV'}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {parent?.category || 'General'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                          unit.status === 'available'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : unit.status === 'in_event'
                            ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                            : unit.status === 'damaged' || unit.status === 'maintenance'
                            ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        }`}
                      >
                        {unit.status === 'available'
                          ? 'Disponible'
                          : unit.status === 'in_event'
                          ? 'En Bolo / Gira'
                          : unit.status === 'damaged'
                          ? 'Averiado'
                          : unit.status === 'maintenance'
                          ? 'En Taller SAT'
                          : 'Reservado'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-zinc-300">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        <span>{unit.locationName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-zinc-300">
                      {unit.currentEventName ? (
                        <span className="text-purple-300 font-medium">{unit.currentEventName}</span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedUnitForQr(unit)}
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-zinc-700 transition cursor-pointer"
                          title="Imprimir Etiqueta Adhesiva / QR de esta unidad"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                        </button>
                        {unit.status !== 'damaged' && unit.status !== 'maintenance' && canEditIncidents && (
                          <button
                            onClick={() => setIncidentModalUnit(unit)}
                            className="px-2 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 border border-rose-800/60 font-semibold text-[10px] transition cursor-pointer"
                          >
                            Avería SAT
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Incident reporting modal for unit */}
      {incidentModalUnit && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-md p-5 space-y-4">
            <h3 className="font-bold text-rose-400 text-base flex items-center gap-2">
              <Wrench className="w-5 h-5" />
              Reportar Avería en {incidentModalUnit.serialNumber}
            </h3>
            <p className="text-xs text-zinc-400">
              El equipo pasará automáticamente al estado <strong>Averiado</strong> y será retirado de la disponibilidad operativa.
            </p>
            <form onSubmit={handleReportIncident} className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Descripción del Problema Técnico *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe el síntoma: canal distorsionado, motor eje Pan atascado, lámpara no enciende..."
                  value={incidentDescription}
                  onChange={(e) => setIncidentDescription(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg p-2 text-zinc-100"
                />
              </div>

              <div className="pt-3 border-t border-[#30363d] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIncidentModalUnit(null)}
                  className="px-3 py-1.5 rounded-lg border border-[#30363d] text-zinc-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold"
                >
                  Registrar Avería
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full Catalog Item Creation Modal */}
      {isItemFormOpen && (
        <ItemFormModal
          isOpen={isItemFormOpen}
          onClose={() => setIsItemFormOpen(false)}
        />
      )}

      {/* QR & Barcode Printing Modal */}
      {selectedUnitForQr && (
        <QrBarcodeModal
          isOpen={Boolean(selectedUnitForQr)}
          onClose={() => setSelectedUnitForQr(null)}
          unit={selectedUnitForQr}
          item={items.find((i) => i.id === selectedUnitForQr.itemId) || null}
        />
      )}

      {/* QR Photo & Camera Scanner Modal */}
      <QrPhotoScannerModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        items={items}
        itemUnits={itemUnits}
        onUnitSelected={(result) => {
          if (result.unit) {
            setSelectedItemId(result.unit.itemId);
            setSearch(result.unit.serialNumber);
          } else if (result.item) {
            setSelectedItemId(result.item.id);
            setSearch(result.serialNumber || result.item.code);
          } else if (result.serialNumber) {
            setSearch(result.serialNumber);
          }
        }}
        title="Localizar Unidad por Foto o Escáner QR"
      />
    </div>
  );
};
