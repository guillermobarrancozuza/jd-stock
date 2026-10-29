import React, { useState, useMemo, useRef } from 'react';
import {
  Wrench,
  Plus,
  Search,
  Filter,
  CheckCircle,
  AlertTriangle,
  Clock,
  DollarSign,
  User,
  RotateCcw,
  History,
  FileText,
  Camera,
  QrCode,
  Sparkles,
  Check,
  Upload,
  RefreshCw,
} from 'lucide-react';
import { Incident, IncidentPriority, IncidentStatus, ItemUnit, Item } from '../../types/inventory.ts';
import { useInventory } from '../../context/InventoryContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { QrPhotoScannerModal } from './QrPhotoScannerModal.tsx';
import { decodeQrFromImage, findUnitOrItemByCode } from '../../lib/qrScannerUtils.ts';

export const MaintenanceView: React.FC = () => {
  const { incidents, items, itemUnits, createIncident, updateIncidentStatus, saveItemUnit } = useInventory();
  const { userProfile, canEditIncidents } = useAuth();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // QR Photo Scanner State
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [scannedUnit, setScannedUnit] = useState<ItemUnit | null>(null);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const [photoDetectionBanner, setPhotoDetectionBanner] = useState<string | null>(null);
  const directPhotoInputRef = useRef<HTMLInputElement | null>(null);

  // New incident modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newIncident, setNewIncident] = useState({
    itemId: items[0]?.id || '',
    serialNumber: '',
    description: '',
    priority: 'medium' as IncidentPriority,
    technician: 'David Rubio (SAT Interno)',
    technicalService: 'Taller Central de Mantenimiento',
    estimatedCost: 0,
  });

  // Action / Update status modal
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [updateStatus, setUpdateStatus] = useState<IncidentStatus>('in_repair');
  const [appliedSolution, setAppliedSolution] = useState('');
  const [finalCost, setFinalCost] = useState<number>(0);

  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      if (statusFilter !== 'all' && inc.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && inc.priority !== priorityFilter) return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        inc.code.toLowerCase().includes(q) ||
        inc.itemName.toLowerCase().includes(q) ||
        (inc.serialNumber && inc.serialNumber.toLowerCase().includes(q)) ||
        inc.description.toLowerCase().includes(q) ||
        (inc.technicalService && inc.technicalService.toLowerCase().includes(q))
      );
    });
  }, [incidents, statusFilter, priorityFilter, search]);

  const handleUnitFromQrScanner = (result: {
    unit: ItemUnit | null;
    item: Item | null;
    serialNumber: string;
  }) => {
    if (result.unit) {
      setScannedUnit(result.unit);
      setNewIncident((prev) => ({
        ...prev,
        itemId: result.unit!.itemId,
        serialNumber: result.unit!.serialNumber,
      }));
      setPhotoDetectionBanner(
        `✓ Unidad detectada por QR: ${result.unit.itemName} (S/N: ${result.unit.serialNumber})`
      );
    } else if (result.item) {
      setScannedUnit(null);
      setNewIncident((prev) => ({
        ...prev,
        itemId: result.item!.id,
        serialNumber: result.serialNumber || prev.serialNumber,
      }));
      setPhotoDetectionBanner(
        `✓ Equipo detectado por QR: ${result.item.name} (Ref: ${result.item.code})`
      );
    } else if (result.serialNumber) {
      setScannedUnit(null);
      setNewIncident((prev) => ({
        ...prev,
        serialNumber: result.serialNumber,
      }));
      setPhotoDetectionBanner(`✓ Código QR leído: ${result.serialNumber}`);
    }

    setIsAddOpen(true);
    setTimeout(() => setPhotoDetectionBanner(null), 5000);
  };

  const handleDirectPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzingPhoto(true);
    setPhotoDetectionBanner(null);

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const dataUrl = loadEvent.target?.result as string;
      const img = new Image();
      img.onload = async () => {
        try {
          const decoded = await decodeQrFromImage(img);
          if (!decoded) {
            alert(
              'No se detectó ningún código QR nítido en la foto. Intenta enfocar más de cerca o con mejor iluminación.'
            );
            return;
          }
          const match = findUnitOrItemByCode(decoded, itemUnits, items);
          handleUnitFromQrScanner({
            unit: match.unit,
            item: match.item,
            serialNumber: match.serialNumber,
          });
        } catch (err: any) {
          alert('Error al analizar la foto: ' + (err.message || 'Error desconocido'));
        } finally {
          setIsAnalyzingPhoto(false);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const it = items.find((i) => i.id === newIncident.itemId);
    if (!it || !newIncident.description.trim()) return;

    try {
      await createIncident({
        itemId: it.id,
        itemName: it.name,
        itemCode: it.code,
        unitId: scannedUnit?.id || null,
        serialNumber: newIncident.serialNumber.trim() || null,
        detectionDate: new Date().toISOString().split('T')[0],
        reportedBy: userProfile?.name || 'Técnico de guardia',
        priority: newIncident.priority,
        status: 'new',
        description: newIncident.description.trim(),
        technician: newIncident.technician,
        technicalService: newIncident.technicalService,
        estimatedCost: Number(newIncident.estimatedCost),
      });

      // Update unit status to maintenance if unit exists
      if (scannedUnit) {
        await saveItemUnit({
          ...scannedUnit,
          status: 'maintenance',
          notes: `Avería SAT: ${newIncident.description.trim()}`,
        });
      } else if (newIncident.serialNumber.trim()) {
        const matchingUnit = itemUnits.find(
          (u) =>
            u.itemId === it.id &&
            u.serialNumber.toLowerCase() === newIncident.serialNumber.trim().toLowerCase()
        );
        if (matchingUnit) {
          await saveItemUnit({
            ...matchingUnit,
            status: 'maintenance',
            notes: `Avería SAT: ${newIncident.description.trim()}`,
          });
        }
      }

      setIsAddOpen(false);
      setScannedUnit(null);
      setNewIncident({
        itemId: items[0]?.id || '',
        serialNumber: '',
        description: '',
        priority: 'medium',
        technician: 'David Rubio (SAT Interno)',
        technicalService: 'Taller Central de Mantenimiento',
        estimatedCost: 0,
      });
    } catch (err: any) {
      alert(err.message || 'Error al crear incidencia');
    }
  };

  const handleUpdateStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident) return;

    try {
      await updateIncidentStatus(
        selectedIncident.id,
        updateStatus,
        appliedSolution.trim() || undefined,
        finalCost
      );
      setSelectedIncident(null);
      setAppliedSolution('');
    } catch (err: any) {
      alert(err.message || 'Error al actualizar incidencia');
    }
  };

  const getPriorityBadge = (p: IncidentPriority) => {
    switch (p) {
      case 'critical':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white animate-pulse">Crítica</span>;
      case 'high':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30">Alta</span>;
      case 'medium':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">Media</span>;
      case 'low':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">Baja</span>;
    }
  };

  const getStatusBadge = (s: IncidentStatus) => {
    switch (s) {
      case 'new':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-400">Nueva</span>;
      case 'in_review':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/20 text-purple-400">En Revisión</span>;
      case 'in_repair':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/20 text-blue-400">En Reparación</span>;
      case 'waiting_parts':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-orange-500/20 text-orange-400">Esperando Piezas</span>;
      case 'repaired':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400">Reparada</span>;
      case 'closed':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-800 text-zinc-400">Cerrada</span>;
      case 'unrepairable':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-900 text-red-200">No Reparable</span>;
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#30363d]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            Mantenimiento, Averías y SAT
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono font-medium">
              {filteredIncidents.length} partes
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Control técnico de averías, gestión de repuestos y retornos garantizados al stock disponible.
          </p>
        </div>

        {canEditIncidents && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsQrScannerOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-bold transition shadow-lg shadow-amber-500/20 cursor-pointer"
              title="Tomar foto con el móvil o escanear el QR de la unidad averiada"
            >
              <Camera className="w-4 h-4" />
              <span>Foto / Escanear QR Avería</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setScannedUnit(null);
                setIsAddOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-600/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Avería Manual</span>
            </button>
          </div>
        )}
      </div>

      {/* Hidden mobile camera input for 1-tap snap */}
      <input
        ref={directPhotoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleDirectPhotoUpload}
      />

      {/* Notification banner if a unit was just identified */}
      {photoDetectionBanner && (
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-emerald-300 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold">{photoDetectionBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setPhotoDetectionBanner(null)}
            className="text-emerald-400 hover:text-white text-[11px]"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#161b22] p-3.5 rounded-xl border border-[#30363d] text-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código, equipo o descripción..."
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg pl-9 pr-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
          >
            <option value="all">Todos los estados de reparación</option>
            <option value="new">Nuevas incidencias</option>
            <option value="in_review">En revisión</option>
            <option value="in_repair">En reparación activa</option>
            <option value="waiting_parts">Esperando piezas / repuestos</option>
            <option value="repaired">Reparadas y reintegradas</option>
            <option value="closed">Cerradas</option>
          </select>
        </div>

        <div>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
          >
            <option value="all">Todas las prioridades</option>
            <option value="critical">Crítica</option>
            <option value="high">Alta</option>
            <option value="medium">Media</option>
            <option value="low">Baja</option>
          </select>
        </div>
      </div>

      {/* Incidents List */}
      <div className="space-y-3">
        {filteredIncidents.length === 0 ? (
          <div className="text-center py-16 bg-[#161b22] border border-[#30363d] rounded-xl text-zinc-400">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-zinc-200">No hay partes de avería con estos filtros</h3>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
              Todo el parque técnico se encuentra en estado operativo o revisado.
            </p>
          </div>
        ) : (
          filteredIncidents.map((inc) => (
            <div
              key={inc.id}
              className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] hover:border-zinc-500 transition flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-bold text-rose-400 text-sm">{inc.code}</span>
                  <h3 className="font-bold text-white text-sm">{inc.itemName}</h3>
                  {inc.serialNumber && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-amber-400 font-mono border border-amber-500/30">
                      S/N: {inc.serialNumber}
                    </span>
                  )}
                  {getPriorityBadge(inc.priority)}
                  {getStatusBadge(inc.status)}
                </div>

                <p className="text-zinc-300 font-medium">{inc.description}</p>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-zinc-400 text-[11px]">
                  <span>Reportado por: <strong>{inc.reportedBy}</strong></span>
                  <span>Fecha: {new Date(inc.detectionDate).toLocaleDateString()}</span>
                  {inc.technician && <span>SAT: <strong>{inc.technician}</strong> ({inc.technicalService})</span>}
                  {inc.estimatedCost ? (
                    <span className="text-amber-400 font-mono font-semibold">
                      Coste: {inc.estimatedCost} €
                    </span>
                  ) : null}
                </div>

                {inc.appliedSolution && (
                  <div className="p-2 rounded bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 text-[11px] mt-1">
                    <strong>Solución Técnica:</strong> {inc.appliedSolution}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 md:border-l border-[#30363d] pt-3 md:pt-0 md:pl-4">
                {canEditIncidents && inc.status !== 'closed' && (
                  <button
                    onClick={() => {
                      setSelectedIncident(inc);
                      setUpdateStatus(inc.status);
                      setAppliedSolution(inc.appliedSolution || '');
                      setFinalCost(inc.estimatedCost || 0);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-[#30363d] font-semibold transition"
                  >
                    <Wrench className="w-3.5 h-3.5 text-amber-400" />
                    <span>Gestionar SAT</span>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Incident Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto backdrop-blur-xs">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#30363d]">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Wrench className="w-5 h-5 text-rose-500" />
                Alta de Parte Técnico de Avería
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsAddOpen(false);
                  setScannedUnit(null);
                }}
                className="text-zinc-400 hover:text-white text-xs"
              >
                Cerrar
              </button>
            </div>

            {/* Scanned Unit Highlight Card */}
            {scannedUnit && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                        Unidad Física Reconocida por Foto QR
                      </span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-amber-300 font-mono font-bold">
                        {scannedUnit.serialNumber}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-white">{scannedUnit.itemName}</p>
                    <p className="text-[10px] text-zinc-400">
                      Ubicación: <strong>{scannedUnit.locationName}</strong> • Ref: {scannedUnit.itemCode}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setScannedUnit(null)}
                  className="text-[11px] text-zinc-400 hover:text-rose-400 underline cursor-pointer shrink-0 ml-2"
                >
                  Cambiar
                </button>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              {/* Photo QR scanning quick bar inside modal */}
              <div className="p-3 rounded-xl bg-[#0d1117] border border-[#30363d] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300 font-semibold text-[11px] flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-amber-400" />
                    <span>¿Quieres escanear la etiqueta en vez de escribir el N/S?</span>
                  </span>
                  {isAnalyzingPhoto && (
                    <span className="text-[10px] text-amber-400 flex items-center gap-1 animate-pulse">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Analizando foto...
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => directPhotoInputRef.current?.click()}
                    disabled={isAnalyzingPhoto}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Foto con Cámara</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsQrScannerOpen(true)}
                    disabled={isAnalyzingPhoto}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-cyan-300 border border-cyan-500/30 font-semibold text-xs transition cursor-pointer"
                  >
                    <QrCode className="w-4 h-4 text-cyan-400" />
                    <span>Escáner / Subir</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Artículo Afectado *</label>
                <select
                  value={newIncident.itemId}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    setNewIncident({ ...newIncident, itemId: selectedId, serialNumber: '' });
                    setScannedUnit(null);
                  }}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 font-medium"
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      [{i.category}] {i.name} ({i.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-zinc-300 font-semibold">Número de Serie (N/S)</label>
                  {itemUnits.filter((u) => u.itemId === newIncident.itemId).length > 0 && (
                    <span className="text-[10px] text-zinc-400">
                      {itemUnits.filter((u) => u.itemId === newIncident.itemId).length} unidades en stock
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ej. RB-PNT-1003 o escanea el QR arriba"
                    value={newIncident.serialNumber}
                    onChange={(e) => {
                      setNewIncident({ ...newIncident, serialNumber: e.target.value });
                      const matching = itemUnits.find(
                        (u) =>
                          u.itemId === newIncident.itemId &&
                          u.serialNumber.toLowerCase() === e.target.value.trim().toLowerCase()
                      );
                      setScannedUnit(matching || null);
                    }}
                    className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 font-mono"
                  />
                  {itemUnits.filter((u) => u.itemId === newIncident.itemId).length > 0 && (
                    <select
                      value=""
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) return;
                        const u = itemUnits.find((unit) => unit.id === val);
                        if (u) {
                          setScannedUnit(u);
                          setNewIncident({ ...newIncident, serialNumber: u.serialNumber });
                        }
                      }}
                      className="bg-[#0d1117] border border-[#30363d] rounded-lg px-2 text-zinc-400 text-[11px] cursor-pointer"
                      title="Seleccionar unidad existente"
                    >
                      <option value="">Elegir N/S...</option>
                      {itemUnits
                        .filter((u) => u.itemId === newIncident.itemId)
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.serialNumber} ({u.status})
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">Prioridad *</label>
                  <select
                    value={newIncident.priority}
                    onChange={(e) =>
                      setNewIncident({ ...newIncident, priority: e.target.value as IncidentPriority })
                    }
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100"
                  >
                    <option value="critical">Crítica (compromete evento)</option>
                    <option value="high">Alta</option>
                    <option value="medium">Media</option>
                    <option value="low">Baja</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">Coste Estimado (€)</label>
                  <input
                    type="number"
                    min="0"
                    value={newIncident.estimatedCost}
                    onChange={(e) =>
                      setNewIncident({ ...newIncident, estimatedCost: Number(e.target.value) })
                    }
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Descripción del Fallo / Avería *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Detalla los síntomas técnicos observados..."
                  value={newIncident.description}
                  onChange={(e) => setNewIncident({ ...newIncident, description: e.target.value })}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg p-2 text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">Técnico Asignado</label>
                  <input
                    type="text"
                    value={newIncident.technician}
                    onChange={(e) => setNewIncident({ ...newIncident, technician: e.target.value })}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">Servicio Técnico / SAT</label>
                  <input
                    type="text"
                    value={newIncident.technicalService}
                    onChange={(e) =>
                      setNewIncident({ ...newIncident, technicalService: e.target.value })
                    }
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100"
                  />
                </div>
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
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold"
                >
                  Dar de Alta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update / Resolve Incident Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-lg p-5 space-y-4">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Wrench className="w-5 h-5 text-amber-400" />
              Gestión de SAT: {selectedIncident.code} — {selectedIncident.itemName}
            </h3>

            <form onSubmit={handleUpdateStatusSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Estado de Reparación *</label>
                <select
                  value={updateStatus}
                  onChange={(e) => setUpdateStatus(e.target.value as IncidentStatus)}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 font-semibold"
                >
                  <option value="in_review">En Revisión en Taller</option>
                  <option value="in_repair">En Reparación Activa</option>
                  <option value="waiting_parts">Esperando Repuestos / Envío a Fabricante</option>
                  <option value="repaired">✓ Reparada (Reincorporar a Almacén)</option>
                  <option value="closed">✓ Cerrada Definitivamente</option>
                  <option value="unrepairable">✗ No Reparable (Dar de baja)</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Solución Técnica Aplicada / Actuación</label>
                <textarea
                  rows={3}
                  placeholder="Detalla qué componentes se cambiaron, ajustes realizados..."
                  value={appliedSolution}
                  onChange={(e) => setAppliedSolution(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg p-2 text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Coste Real de Reparación / Piezas (€)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={finalCost}
                  onChange={(e) => setFinalCost(Number(e.target.value))}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100"
                />
              </div>

              {updateStatus === 'repaired' && (
                <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800 text-emerald-300">
                  ✓ Al guardar como <strong>Reparada</strong>, el equipo volverá inmediatamente a estar{' '}
                  <strong>disponible</strong> en almacén y se registrará el movimiento de retorno en la auditoría.
                </div>
              )}

              <div className="pt-3 border-t border-[#30363d] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedIncident(null)}
                  className="px-3 py-1.5 rounded-lg border border-[#30363d] text-zinc-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold"
                >
                  Actualizar Parte SAT
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Photo & Camera Scanner Modal */}
      <QrPhotoScannerModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        items={items}
        itemUnits={itemUnits}
        onUnitSelected={handleUnitFromQrScanner}
        title="Escanear o Echar Foto al QR de la Avería"
      />
    </div>
  );
};
