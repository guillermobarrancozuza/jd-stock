import React, { useState } from 'react';
import {
  Boxes,
  Cable,
  Plus,
  QrCode,
  Edit,
  Trash2,
  MapPin,
  AlertTriangle,
  CheckCircle,
  Minus,
  RotateCcw,
  History,
  X,
  Save,
  Package,
  Search,
} from 'lucide-react';
import {
  EquipmentKit,
  KitComponent,
  CableBox,
  CONTRACT_SECTIONS,
} from '../../types/inventory.ts';
import { useInventory } from '../../context/InventoryContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { QrBarcodeModal } from './QrBarcodeModal.tsx';

export const KitsAndCablesView: React.FC = () => {
  const {
    items,
    locations,
    equipmentKits,
    cableBoxes,
    saveEquipmentKit,
    deleteEquipmentKit,
    saveCableBox,
    deleteCableBox,
    adjustCableBoxQuantity,
  } = useInventory();
  const { canManageInventory } = useAuth();

  const [activeTab, setActiveTab] = useState<'kits' | 'cables'>('kits');
  const [search, setSearch] = useState('');

  // Sticker Modal State
  const [qrKit, setQrKit] = useState<EquipmentKit | null>(null);
  const [qrBox, setQrBox] = useState<CableBox | null>(null);

  // Kit Form Modal State
  const [showKitModal, setShowKitModal] = useState(false);
  const [editingKit, setEditingKit] = useState<EquipmentKit | null>(null);
  const [kitName, setKitName] = useState('');
  const [kitCode, setKitCode] = useState('');
  const [kitSection, setKitSection] = useState<string>('Sonido');
  const [kitLocation, setKitLocation] = useState('Nave Central');
  const [kitRentalPrice, setKitRentalPrice] = useState<number>(0);
  const [kitDescription, setKitDescription] = useState('');
  const [kitComponents, setKitComponents] = useState<KitComponent[]>([]);
  const [newCompName, setNewCompName] = useState('');
  const [newCompQty, setNewCompQty] = useState<number>(1);
  const [selectedCatalogItemId, setSelectedCatalogItemId] = useState<string>('');

  // Cable Box Form Modal State
  const [showBoxModal, setShowBoxModal] = useState(false);
  const [editingBox, setEditingBox] = useState<CableBox | null>(null);
  const [boxName, setBoxName] = useState('');
  const [boxCode, setBoxCode] = useState('');
  const [boxCableType, setBoxCableType] = useState('XLR Balanceado');
  const [boxLength, setBoxLength] = useState('4m');
  const [boxInitialQty, setBoxInitialQty] = useState<number>(20);
  const [boxLocation, setBoxLocation] = useState('Zona Cableado & Distribución Eléctrica');
  const [boxLinkedItemId, setBoxLinkedItemId] = useState<string>('');
  const [boxNotes, setBoxNotes] = useState('');

  // Cable Box Custom Adjustment Modal State
  const [adjustBox, setAdjustBox] = useState<CableBox | null>(null);
  const [adjustType, setAdjustType] = useState<'broken' | 'lost' | 'restocked'>('broken');
  const [adjustAmount, setAdjustAmount] = useState<number>(1);
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustEvent, setAdjustEvent] = useState('');

  // Delete inline confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [expandedHistoryBoxId, setExpandedHistoryBoxId] = useState<string | null>(null);

  const q = search.toLowerCase().trim();

  const filteredKits = equipmentKits.filter(
    (k) =>
      !q ||
      k.name.toLowerCase().includes(q) ||
      k.code.toLowerCase().includes(q) ||
      k.qrCode.toLowerCase().includes(q) ||
      k.section.toLowerCase().includes(q) ||
      k.components.some((c) => c.name.toLowerCase().includes(q))
  );

  const filteredBoxes = cableBoxes.filter(
    (b) =>
      !q ||
      b.name.toLowerCase().includes(q) ||
      b.code.toLowerCase().includes(q) ||
      b.qrCode.toLowerCase().includes(q) ||
      b.cableType.toLowerCase().includes(q) ||
      (b.cableLength && b.cableLength.toLowerCase().includes(q))
  );

  // Open Create/Edit Kit
  const openKitForm = (kit?: EquipmentKit) => {
    if (kit) {
      setEditingKit(kit);
      setKitName(kit.name);
      setKitCode(kit.code);
      setKitSection(kit.section);
      setKitLocation(kit.locationName);
      setKitRentalPrice(kit.rentalPrice || 0);
      setKitDescription(kit.description || '');
      setKitComponents(kit.components.map((c) => ({ ...c })));
    } else {
      setEditingKit(null);
      setKitName('');
      setKitCode('');
      setKitSection('Sonido');
      setKitLocation(locations[0] ? `${locations[0].warehouse} - ${locations[0].zone}` : 'Nave Central');
      setKitRentalPrice(0);
      setKitDescription('');
      setKitComponents([]);
    }
    setNewCompName('');
    setNewCompQty(1);
    setSelectedCatalogItemId('');
    setShowKitModal(true);
  };

  const handleAddComponentFromCatalog = () => {
    if (!selectedCatalogItemId) return;
    const item = items.find((i) => i.id === selectedCatalogItemId);
    if (!item) return;
    setKitComponents((prev) => [
      ...prev,
      {
        id: `kc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        itemId: item.id,
        itemCode: item.code,
        name: item.name,
        quantity: Math.max(1, newCompQty),
      },
    ]);
    setSelectedCatalogItemId('');
    setNewCompQty(1);
  };

  const handleAddCustomComponent = () => {
    if (!newCompName.trim()) return;
    setKitComponents((prev) => [
      ...prev,
      {
        id: `kc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: newCompName.trim(),
        quantity: Math.max(1, newCompQty),
      },
    ]);
    setNewCompName('');
    setNewCompQty(1);
  };

  const handleSaveKit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kitName.trim()) return;
    await saveEquipmentKit({
      id: editingKit?.id,
      code: kitCode.trim() || undefined,
      qrCode: editingKit?.qrCode,
      name: kitName.trim(),
      section: kitSection,
      locationName: kitLocation,
      rentalPrice: Number(kitRentalPrice) || 0,
      description: kitDescription.trim(),
      components: kitComponents,
      status: editingKit?.status || 'available',
      createdAt: editingKit?.createdAt,
    });
    setShowKitModal(false);
  };

  // Open Create/Edit Cable Box
  const openBoxForm = (box?: CableBox) => {
    if (box) {
      setEditingBox(box);
      setBoxName(box.name);
      setBoxCode(box.code);
      setBoxCableType(box.cableType);
      setBoxLength(box.cableLength || '');
      setBoxInitialQty(box.initialQuantity);
      setBoxLocation(box.locationName);
      setBoxLinkedItemId(box.linkedItemId || '');
      setBoxNotes(box.notes || '');
    } else {
      setEditingBox(null);
      setBoxName('');
      setBoxCode('');
      setBoxCableType('XLR Balanceado');
      setBoxLength('4m');
      setBoxInitialQty(20);
      setBoxLocation('Zona Cableado & Distribución Eléctrica');
      setBoxLinkedItemId('');
      setBoxNotes('');
    }
    setShowBoxModal(true);
  };

  const handleSaveBox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boxName.trim() || !boxCableType.trim()) return;
    await saveCableBox({
      id: editingBox?.id,
      code: boxCode.trim() || undefined,
      qrCode: editingBox?.qrCode,
      name: boxName.trim(),
      cableType: boxCableType.trim(),
      cableLength: boxLength.trim(),
      initialQuantity: Math.max(1, Number(boxInitialQty) || 1),
      currentQuantity: editingBox ? editingBox.currentQuantity : Math.max(1, Number(boxInitialQty) || 1),
      brokenCount: editingBox?.brokenCount || 0,
      lostCount: editingBox?.lostCount || 0,
      locationName: boxLocation,
      linkedItemId: boxLinkedItemId || undefined,
      notes: boxNotes.trim(),
      adjustments: editingBox?.adjustments || [],
      createdAt: editingBox?.createdAt,
    });
    setShowBoxModal(false);
  };

  const handleCustomAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustBox) return;
    await adjustCableBoxQuantity(
      adjustBox.id,
      adjustType,
      Math.max(1, adjustAmount),
      adjustReason.trim() || undefined,
      adjustEvent.trim() || undefined
    );
    setAdjustBox(null);
    setAdjustAmount(1);
    setAdjustReason('');
    setAdjustEvent('');
  };

  const cableCatalogItems = items.filter(
    (i) =>
      i.group === 'CABLEADO' ||
      i.category.toLowerCase().includes('cable') ||
      i.name.toLowerCase().includes('cable') ||
      i.name.toLowerCase().includes('xlr') ||
      i.name.toLowerCase().includes('dmx')
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-[#30363d]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Boxes className="w-6 h-6 text-amber-400" />
            <span>QR Conjuntos (Carros / Packs) y Cajas de Cables</span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            Agrupa equipos en un solo QR (ej. Carro de Sonido) y controla cajas de cables descontando rotos o perdidos desde el QR.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManageInventory && (
            <>
              <button
                type="button"
                onClick={() => openKitForm()}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold shadow-lg shadow-amber-500/20 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo QR Conjunto / Carro</span>
              </button>
              <button
                type="button"
                onClick={() => openBoxForm()}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva Caja de Cables QR</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-[#161b22] p-1 rounded-xl border border-[#30363d] w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('kits')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'kits'
                ? 'bg-amber-500 text-black shadow'
                : 'text-zinc-300 hover:text-white'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>QR Conjuntos / Carros ({equipmentKits.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cables')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'cables'
                ? 'bg-cyan-500 text-black shadow'
                : 'text-zinc-300 hover:text-white'
            }`}
          >
            <Cable className="w-4 h-4" />
            <span>Cajas de Cables ({cableBoxes.length})</span>
          </button>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              activeTab === 'kits'
                ? 'Buscar carro, QR, componente o apartado...'
                : 'Buscar caja, tipo XLR/DMX, metros o QR...'
            }
            className="w-full bg-[#161b22] border border-[#30363d] rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* TAB 1: EQUIPMENT KITS (QR CONJUNTOS) */}
      {activeTab === 'kits' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredKits.length === 0 ? (
            <div className="col-span-full text-center py-14 bg-[#161b22] border border-[#30363d] rounded-xl text-zinc-400">
              <Boxes className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-white">No hay QR conjuntos creados</p>
              <p className="text-xs text-zinc-500 mt-1">
                Crea un carro de sonido, rack de etapas o kit completo con un único código QR.
              </p>
            </div>
          ) : (
            filteredKits.map((kit) => {
              const totalPieces = kit.components.reduce((acc, c) => acc + c.quantity, 0);
              return (
                <div
                  key={kit.id}
                  className="bg-[#161b22] border border-[#30363d] hover:border-amber-500/40 rounded-2xl p-4 flex flex-col justify-between gap-4 transition"
                >
                  <div className="space-y-3">
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            {kit.qrCode}
                          </span>
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-zinc-800 text-cyan-300 border border-cyan-500/30">
                            Apartado: {kit.section}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              kit.status === 'available'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : kit.status === 'in_event'
                                ? 'bg-purple-500/15 text-purple-300'
                                : 'bg-rose-500/15 text-rose-400'
                            }`}
                          >
                            {kit.status === 'available'
                              ? 'Disponible'
                              : kit.status === 'in_event'
                              ? 'En Evento'
                              : 'Mantenimiento'}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-white">{kit.name}</h3>
                        {kit.description && (
                          <p className="text-xs text-zinc-400 mt-0.5">{kit.description}</p>
                        )}
                      </div>

                      {kit.rentalPrice ? (
                        <div className="text-right shrink-0">
                          <span className="text-[10px] text-zinc-500 block">Tarifa pack</span>
                          <span className="font-mono font-bold text-emerald-400 text-sm">
                            {kit.rentalPrice.toFixed(2)} €
                          </span>
                        </div>
                      ) : null}
                    </div>

                    {/* Components List */}
                    <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-3 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase text-zinc-400 tracking-wider pb-1 border-b border-[#30363d]">
                        <span>Contenido del QR Conjunto ({kit.components.length} tipos)</span>
                        <span className="text-amber-400 font-mono">{totalPieces} equipos</span>
                      </div>
                      {kit.components.length === 0 ? (
                        <p className="text-xs text-zinc-500 italic py-1">Sin componentes definidos</p>
                      ) : (
                        <ul className="space-y-1 pt-1">
                          {kit.components.map((comp) => (
                            <li
                              key={comp.id}
                              className="flex items-center justify-between text-xs text-zinc-200"
                            >
                              <span className="flex items-center gap-2">
                                <span className="font-mono font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded text-[11px]">
                                  {comp.quantity}×
                                </span>
                                <span>{comp.name}</span>
                              </span>
                              {comp.itemCode && (
                                <span className="font-mono text-[10px] text-zinc-500">{comp.itemCode}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#30363d]">
                    <span className="flex items-center gap-1 text-[11px] text-zinc-400">
                      <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                      {kit.locationName}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setQrKit(kit)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition cursor-pointer"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>Pegatina QR</span>
                      </button>

                      {canManageInventory && (
                        <>
                          <button
                            type="button"
                            onClick={() => openKitForm(kit)}
                            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-amber-300 transition cursor-pointer"
                            title="Editar conjunto"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {confirmDeleteId === kit.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  deleteEquipmentKit(kit.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold cursor-pointer"
                              >
                                Eliminar
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1 rounded bg-zinc-800 text-zinc-300 text-[11px] cursor-pointer"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(kit.id)}
                              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-950 text-zinc-400 hover:text-rose-400 transition cursor-pointer"
                              title="Eliminar conjunto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: CABLE BOXES (QR PARA CAJAS DE CABLES CON DESCUENTO DE ROTOS / PERDIDOS) */}
      {activeTab === 'cables' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredBoxes.length === 0 ? (
            <div className="col-span-full text-center py-14 bg-[#161b22] border border-[#30363d] rounded-xl text-zinc-400">
              <Cable className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-white">No hay cajas de cables registradas</p>
              <p className="text-xs text-zinc-500 mt-1">
                Crea una caja (ej. Caja Cables XLR 4m — 20 uds) para controlar su QR y descontar rotos o perdidos.
              </p>
            </div>
          ) : (
            filteredBoxes.map((box) => {
              const pct = box.initialQuantity > 0
                ? Math.min(100, Math.round((box.currentQuantity / box.initialQuantity) * 100))
                : 0;
              const isIncomplete = box.currentQuantity < box.initialQuantity;
              const showHistory = expandedHistoryBoxId === box.id;

              return (
                <div
                  key={box.id}
                  className={`bg-[#161b22] border rounded-2xl p-4 flex flex-col justify-between gap-4 transition ${
                    isIncomplete
                      ? 'border-amber-500/50'
                      : 'border-[#30363d] hover:border-cyan-500/40'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                            {box.qrCode}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                            {box.cableType} {box.cableLength ? `· ${box.cableLength}` : ''}
                          </span>
                          {isIncomplete ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Incompleta (-{box.initialQuantity - box.currentQuantity})
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Completa
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-bold text-white">{box.name}</h3>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-zinc-500 block">Cables útiles</span>
                        <span className="font-mono font-black text-lg text-white">
                          <span className={isIncomplete ? 'text-amber-400' : 'text-emerald-400'}>
                            {box.currentQuantity}
                          </span>
                          <span className="text-zinc-500 text-xs"> / {box.initialQuantity}</span>
                        </span>
                      </div>
                    </div>

                    {/* Progress & Breakdown */}
                    <div className="space-y-2 bg-[#0d1117] p-3 rounded-xl border border-[#30363d]">
                      <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            pct >= 90
                              ? 'bg-emerald-500'
                              : pct >= 60
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs pt-1">
                        <div className="p-1.5 rounded bg-[#161b22] border border-[#30363d]">
                          <span className="text-[10px] text-zinc-400 block">Activos</span>
                          <span className="font-bold text-emerald-400">{box.currentQuantity}</span>
                        </div>
                        <div className="p-1.5 rounded bg-[#161b22] border border-rose-500/20">
                          <span className="text-[10px] text-rose-400 block">Rotos</span>
                          <span className="font-bold text-rose-300">{box.brokenCount}</span>
                        </div>
                        <div className="p-1.5 rounded bg-[#161b22] border border-amber-500/20">
                          <span className="text-[10px] text-amber-400 block">Perdidos</span>
                          <span className="font-bold text-amber-300">{box.lostCount}</span>
                        </div>
                      </div>
                    </div>

                    {/* Direct 1-click Breakage / Loss Deduction Controls */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        disabled={box.currentQuantity <= 0}
                        onClick={() => adjustCableBoxQuantity(box.id, 'broken', 1)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[11px] font-bold transition cursor-pointer disabled:opacity-40"
                      >
                        <Minus className="w-3.5 h-3.5" />
                        <span>1 Roto</span>
                      </button>

                      <button
                        type="button"
                        disabled={box.currentQuantity <= 0}
                        onClick={() => adjustCableBoxQuantity(box.id, 'lost', 1)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[11px] font-bold transition cursor-pointer disabled:opacity-40"
                      >
                        <Minus className="w-3.5 h-3.5" />
                        <span>1 Perdido</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => adjustCableBoxQuantity(box.id, 'restocked', 1)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold transition cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>+1 Reponer</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setAdjustBox(box);
                          setAdjustType('broken');
                          setAdjustAmount(1);
                          setAdjustReason('');
                          setAdjustEvent('');
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-[#30363d] text-[11px] font-semibold transition cursor-pointer"
                      >
                        Descontar varios / Motivo...
                      </button>
                    </div>

                    {/* History Toggle */}
                    {box.adjustments && box.adjustments.length > 0 && (
                      <div>
                        <button
                          type="button"
                          onClick={() => setExpandedHistoryBoxId(showHistory ? null : box.id)}
                          className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold cursor-pointer"
                        >
                          <History className="w-3.5 h-3.5" />
                          <span>
                            {showHistory ? 'Ocultar' : 'Ver'} historial de bajas/reposiciones ({box.adjustments.length})
                          </span>
                        </button>
                        {showHistory && (
                          <div className="mt-2 space-y-1 max-h-36 overflow-y-auto bg-[#0d1117] border border-[#30363d] rounded-lg p-2 text-[11px]">
                            {box.adjustments.map((adj) => (
                              <div
                                key={adj.id}
                                className="flex items-center justify-between gap-2 py-1 border-b border-[#30363d] last:border-0"
                              >
                                <div className="min-w-0">
                                  <span
                                    className={`font-bold mr-1.5 ${
                                      adj.type === 'broken'
                                        ? 'text-rose-400'
                                        : adj.type === 'lost'
                                        ? 'text-amber-400'
                                        : 'text-emerald-400'
                                    }`}
                                  >
                                    {adj.type === 'broken'
                                      ? `-${adj.amount} Roto`
                                      : adj.type === 'lost'
                                      ? `-${adj.amount} Perdido`
                                      : `+${adj.amount} Repuesto`}
                                  </span>
                                  <span className="text-zinc-300">{adj.notes}</span>
                                  <div className="text-[10px] text-zinc-500">
                                    {new Date(adj.date).toLocaleString()} · {adj.userName}
                                    {adj.eventName ? ` · Evento: ${adj.eventName}` : ''}
                                  </div>
                                </div>
                                <span className="font-mono text-zinc-400 shrink-0">
                                  {adj.previousQuantity}→{adj.newQuantity}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#30363d]">
                    <span className="flex items-center gap-1 text-[11px] text-zinc-400">
                      <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                      {box.locationName}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setQrBox(box)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition cursor-pointer"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>Pegatina QR Caja</span>
                      </button>

                      {canManageInventory && (
                        <>
                          <button
                            type="button"
                            onClick={() => openBoxForm(box)}
                            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-cyan-300 transition cursor-pointer"
                            title="Editar caja"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {confirmDeleteId === box.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  deleteCableBox(box.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold cursor-pointer"
                              >
                                Eliminar
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1 rounded bg-zinc-800 text-zinc-300 text-[11px] cursor-pointer"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(box.id)}
                              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-950 text-zinc-400 hover:text-rose-400 transition cursor-pointer"
                              title="Eliminar caja"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* MODAL: CREATE / EDIT EQUIPMENT KIT */}
      {showKitModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-[#30363d] flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Boxes className="w-4 h-4 text-amber-400" />
                {editingKit ? 'Editar QR Conjunto / Carro' : 'Crear QR Conjunto (Carro / Rack / Pack)'}
              </h2>
              <button onClick={() => setShowKitModal(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveKit} className="p-5 space-y-4 overflow-y-auto text-xs flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">Nombre del Conjunto / Carro *</label>
                  <input
                    type="text"
                    required
                    value={kitName}
                    onChange={(e) => setKitName(e.target.value)}
                    placeholder="Ej. Carro de Sonido Completo #1"
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">Código Interno (opcional)</label>
                  <input
                    type="text"
                    value={kitCode}
                    onChange={(e) => setKitCode(e.target.value)}
                    placeholder="Ej. KIT-SON-001 (Autogenerado si vacío)"
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white font-mono uppercase focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">Apartado de Contrato/Albarán</label>
                  <select
                    value={kitSection}
                    onChange={(e) => setKitSection(e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  >
                    {CONTRACT_SECTIONS.map((sec) => (
                      <option key={sec} value={sec}>
                        {sec}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">Precio Alquiler Pack (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={kitRentalPrice}
                    onChange={(e) => setKitRentalPrice(Number(e.target.value))}
                    className="w-full bg-[#0d1117] border border-emerald-500/40 rounded-lg px-3 py-2 text-emerald-300 font-mono font-bold focus:outline-none focus:border-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">Ubicación</label>
                  <input
                    type="text"
                    value={kitLocation}
                    onChange={(e) => setKitLocation(e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Descripción</label>
                <input
                  type="text"
                  value={kitDescription}
                  onChange={(e) => setKitDescription(e.target.value)}
                  placeholder="Ej. Carro rodante con sonido completo para eventos y bodas"
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Components Builder */}
              <div className="p-3.5 rounded-xl bg-[#0d1117] border border-[#30363d] space-y-3">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <Package className="w-4 h-4" />
                  <span>Equipos incluidos dentro de este QR Conjunto</span>
                </div>

                {/* Add from catalog */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <select
                    value={selectedCatalogItemId}
                    onChange={(e) => setSelectedCatalogItemId(e.target.value)}
                    className="sm:col-span-7 bg-[#161b22] border border-[#30363d] rounded-lg px-2.5 py-2 text-zinc-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">-- Añadir desde el catálogo --</option>
                    {items.map((it) => (
                      <option key={it.id} value={it.id}>
                        [{it.code}] {it.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={newCompQty}
                    onChange={(e) => setNewCompQty(Math.max(1, Number(e.target.value) || 1))}
                    className="sm:col-span-2 bg-[#161b22] border border-[#30363d] rounded-lg px-2.5 py-2 text-center font-mono text-white"
                    title="Cantidad"
                  />
                  <button
                    type="button"
                    onClick={handleAddComponentFromCatalog}
                    disabled={!selectedCatalogItemId}
                    className="sm:col-span-3 px-3 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold cursor-pointer disabled:opacity-40"
                  >
                    + Del Catálogo
                  </button>
                </div>

                {/* Add free-text component */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <input
                    type="text"
                    value={newCompName}
                    onChange={(e) => setNewCompName(e.target.value)}
                    placeholder="O escribe libre: ej. Altavoces 15'', Monitor suelo, Etapas, Mesa Bluetooth..."
                    className="sm:col-span-7 bg-[#161b22] border border-[#30363d] rounded-lg px-2.5 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                  <input
                    type="number"
                    min="1"
                    value={newCompQty}
                    onChange={(e) => setNewCompQty(Math.max(1, Number(e.target.value) || 1))}
                    className="sm:col-span-2 bg-[#161b22] border border-[#30363d] rounded-lg px-2.5 py-2 text-center font-mono text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomComponent}
                    disabled={!newCompName.trim()}
                    className="sm:col-span-3 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-[#30363d] font-bold cursor-pointer disabled:opacity-40"
                  >
                    + Libre
                  </button>
                </div>

                {/* Current component rows */}
                {kitComponents.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-[#30363d]">
                    {kitComponents.map((comp, idx) => (
                      <div
                        key={comp.id}
                        className="flex items-center justify-between gap-2 bg-[#161b22] border border-[#30363d] rounded-lg px-2.5 py-1.5"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <input
                            type="number"
                            min="1"
                            value={comp.quantity}
                            onChange={(e) => {
                              const val = Math.max(1, Number(e.target.value) || 1);
                              setKitComponents((prev) =>
                                prev.map((c, i) => (i === idx ? { ...c, quantity: val } : c))
                              );
                            }}
                            className="w-14 bg-[#0d1117] border border-[#30363d] rounded px-1.5 py-0.5 text-center font-mono text-amber-300 font-bold"
                          />
                          <span className="text-zinc-200 truncate">{comp.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setKitComponents((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-zinc-500 hover:text-rose-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-[#30363d] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowKitModal(false)}
                  className="px-4 py-2 rounded-lg border border-[#30363d] text-zinc-300 hover:bg-zinc-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar QR Conjunto</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT CABLE BOX */}
      {showBoxModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-[#30363d] flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Cable className="w-4 h-4 text-cyan-400" />
                {editingBox ? 'Editar Caja de Cables QR' : 'Nueva Caja de Cables con QR'}
              </h2>
              <button onClick={() => setShowBoxModal(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBox} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Nombre de la Caja *</label>
                <input
                  type="text"
                  required
                  value={boxName}
                  onChange={(e) => setBoxName(e.target.value)}
                  placeholder="Ej. Caja Cables XLR 4m #1"
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">Tipo de Cable *</label>
                  <input
                    type="text"
                    required
                    value={boxCableType}
                    onChange={(e) => setBoxCableType(e.target.value)}
                    placeholder="XLR, DMX, Speakon..."
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">Longitud</label>
                  <input
                    type="text"
                    value={boxLength}
                    onChange={(e) => setBoxLength(e.target.value)}
                    placeholder="Ej. 4m, 10m..."
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">Cables en la Caja *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={boxInitialQty}
                    onChange={(e) => setBoxInitialQty(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full bg-[#0d1117] border border-cyan-500/40 rounded-lg px-3 py-2 text-cyan-300 font-mono font-bold focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">Código Interno (opcional)</label>
                  <input
                    type="text"
                    value={boxCode}
                    onChange={(e) => setBoxCode(e.target.value)}
                    placeholder="Ej. CAJA-XLR4-01"
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white font-mono uppercase focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">Ubicación</label>
                  <input
                    type="text"
                    value={boxLocation}
                    onChange={(e) => setBoxLocation(e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Vincular con artículo del catálogo (opcional, sincroniza bajas)
                </label>
                <select
                  value={boxLinkedItemId}
                  onChange={(e) => setBoxLinkedItemId(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="">-- Sin vincular a artículo suelto --</option>
                  {(cableCatalogItems.length > 0 ? cableCatalogItems : items).map((it) => (
                    <option key={it.id} value={it.id}>
                      [{it.code}] {it.name} (Stock: {it.totalQuantity})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Notas</label>
                <input
                  type="text"
                  value={boxNotes}
                  onChange={(e) => setBoxNotes(e.target.value)}
                  placeholder="Ej. Caja azul con velcro rojo"
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="pt-3 border-t border-[#30363d] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBoxModal(false)}
                  className="px-4 py-2 rounded-lg border border-[#30363d] text-zinc-300 hover:bg-zinc-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar Caja QR</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CUSTOM CABLE BOX DEDUCTION / RESTOCK */}
      {adjustBox && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-[#30363d] flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">Descontar / Reponer Cables</h2>
                <p className="text-[11px] text-cyan-300 font-mono">
                  {adjustBox.name} ({adjustBox.currentQuantity}/{adjustBox.initialQuantity} uds)
                </p>
              </div>
              <button onClick={() => setAdjustBox(null)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCustomAdjustSubmit} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustType('broken')}
                  className={`py-2 rounded-lg font-bold border cursor-pointer ${
                    adjustType === 'broken'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500'
                      : 'bg-[#0d1117] text-zinc-400 border-[#30363d]'
                  }`}
                >
                  Roto (-)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustType('lost')}
                  className={`py-2 rounded-lg font-bold border cursor-pointer ${
                    adjustType === 'lost'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                      : 'bg-[#0d1117] text-zinc-400 border-[#30363d]'
                  }`}
                >
                  Perdido (-)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustType('restocked')}
                  className={`py-2 rounded-lg font-bold border cursor-pointer ${
                    adjustType === 'restocked'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500'
                      : 'bg-[#0d1117] text-zinc-400 border-[#30363d]'
                  }`}
                >
                  Reponer (+)
                </button>
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Cantidad de cables</label>
                <input
                  type="number"
                  min="1"
                  max={adjustType === 'restocked' ? 200 : Math.max(1, adjustBox.currentQuantity)}
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white font-mono font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Evento / Bolo (opcional)</label>
                <input
                  type="text"
                  value={adjustEvent}
                  onChange={(e) => setAdjustEvent(e.target.value)}
                  placeholder="Ej. Festival Primavera / Boda Finca..."
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Observaciones</label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Ej. Conector XLR doblado / No apareció en recogida"
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustBox(null)}
                  className="px-4 py-2 rounded-lg border border-[#30363d] text-zinc-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold cursor-pointer"
                >
                  Aplicar al QR de Caja
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Sticker Modal for Kits & Cable Boxes */}
      {(qrKit || qrBox) && (
        <QrBarcodeModal
          isOpen={Boolean(qrKit || qrBox)}
          onClose={() => {
            setQrKit(null);
            setQrBox(null);
          }}
          kit={qrKit}
          cableBox={qrBox}
          defaultSize="flycase_17x7"
        />
      )}
    </div>
  );
};
