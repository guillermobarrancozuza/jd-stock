import React, { useState } from 'react';
import {
  FileSignature,
  Plus,
  Search,
  Filter,
  CreditCard,
  MessageCircle,
  Mail,
  Printer,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building,
  Calendar,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Truck,
  Folder,
  FolderArchive,
  FolderOpen,
  List,
  Layers,
  Download,
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { Contract, ContractStatus } from '../../types/inventory.ts';
import { GenerateContractModal } from './GenerateContractModal.tsx';
import { PaymentGatewayModal } from './PaymentGatewayModal.tsx';
import { PrintContractModal } from './PrintContractModal.tsx';
import { composeWhatsAppContractMessage } from '../../lib/barcodeUtils.ts';

interface ContractsViewProps {
  onNavigate?: (view: string) => void;
}

export const ContractsView: React.FC<ContractsViewProps> = ({ onNavigate }) => {
  const { contracts, updateContractStatus } = useInventory();
  const { userProfile, canManageInventory } = useAuth();

  const [viewMode, setViewMode] = useState<'list' | 'folders'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ContractStatus>('all');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    '2026-11': true,
    '2026-10': true,
  });

  // Modals state
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [gatewayContract, setGatewayContract] = useState<Contract | null>(null);
  const [printContract, setPrintContract] = useState<Contract | null>(null);

  // Quick WhatsApp send
  const handleOpenWhatsApp = (contract: Contract) => {
    const text = composeWhatsAppContractMessage(contract);
    const cleanPhone = contract.clientPhone.replace(/[^0-9]/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // Quick Email send
  const handleOpenEmail = (contract: Contract) => {
    const text = composeWhatsAppContractMessage(contract);
    const subject = `Reserva de Fecha (10%) - Contrato ${contract.code} - ${contract.eventName}`;
    const url = `mailto:${contract.clientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleMarkPaid = async (contractId: string, reference: string) => {
    await updateContractStatus(contractId, 'deposit_paid', reference);
  };

  const toggleFolder = (folderKey: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderKey]: !prev[folderKey],
    }));
  };

  // Filtered contracts
  const filteredContracts = contracts.filter((c) => {
    const matchesSearch =
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.eventName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.clientTaxId && c.clientTaxId.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Grouping by Month (YYYY-MM)
  const monthlyFolders = React.useMemo(() => {
    const groups: Record<
      string,
      {
        folderKey: string;
        label: string;
        year: number;
        monthName: string;
        contracts: Contract[];
        totalAmount: number;
        depositAmount: number;
      }
    > = {};

    filteredContracts.forEach((contract) => {
      const d = new Date(contract.eventDate || contract.createdAt);
      const year = d.getFullYear();
      const monthNumber = String(d.getMonth() + 1).padStart(2, '0');
      const folderKey = `${year}-${monthNumber}`;
      const monthName = d.toLocaleDateString('es-ES', { month: 'long' });
      const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
      const label = `${capitalizedMonth} ${year}`;

      if (!groups[folderKey]) {
        groups[folderKey] = {
          folderKey,
          label,
          year,
          monthName: capitalizedMonth,
          contracts: [],
          totalAmount: 0,
          depositAmount: 0,
        };
      }

      groups[folderKey].contracts.push(contract);
      groups[folderKey].totalAmount += contract.totalAmount;
      groups[folderKey].depositAmount += contract.depositAmount;
    });

    return Object.values(groups).sort((a, b) => b.folderKey.localeCompare(a.folderKey));
  }, [filteredContracts]);

  // Bulk print all contracts in a monthly folder
  const handleBulkPrintFolder = (folderContracts: Contract[]) => {
    if (folderContracts.length === 0) return;
    setPrintContract(folderContracts[0]);
  };

  // KPI calculations
  const totalVolume = contracts.reduce((acc, c) => acc + c.totalAmount, 0);
  const totalDepositCollected = contracts
    .filter((c) => c.status === 'deposit_paid' || c.status === 'signed')
    .reduce((acc, c) => acc + c.depositAmount, 0);
  const pendingDepositsCount = contracts.filter(
    (c) => c.status === 'sent' || c.status === 'draft'
  ).length;

  const getStatusBadge = (status: ContractStatus) => {
    switch (status) {
      case 'deposit_paid':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
            <CheckCircle2 className="w-3.5 h-3.5" /> 10% Abonado (Fecha Bloqueada)
          </span>
        );
      case 'signed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/40">
            <ShieldCheck className="w-3.5 h-3.5" /> Firmado y Liquidado
          </span>
        );
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse">
            <Clock className="w-3.5 h-3.5" /> Pendiente 10% (Sin Bloquear)
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-zinc-500/20 text-zinc-400 border border-zinc-500/40">
            Borrador
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">
            Cancelado
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-linear-to-r from-[#161b22] via-[#1c2128] to-[#161b22] border border-[#30363d] p-5 sm:p-6 rounded-2xl shadow-xl">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-linear-to-tr from-amber-500 to-yellow-600 flex items-center justify-center text-black font-black shadow-lg shadow-amber-500/20 shrink-0">
            <FileSignature className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Contratos y Facturación
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded">
                JD AUDIOVISUALES S.L.
              </span>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl">
              Gestión de contratos con archivo por carpetas mensuales, pasarela de cobro bancario SEPA (Anticipo 10% o Pago Total 100%) y descarga de documentos en PDF.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-[#0d1117] p-1 rounded-xl border border-[#30363d]">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-amber-500 text-black shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Lista General</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('folders')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'folders'
                  ? 'bg-amber-500 text-black shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <FolderArchive className="w-3.5 h-3.5" />
              <span>Carpetas Mensuales</span>
            </button>
          </div>

          {canManageInventory && (
            <button
              onClick={() => setIsGenerateModalOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition shadow-lg shadow-amber-500/20 shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Nuevo Contrato</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] relative overflow-hidden">
          <span className="text-[11px] text-zinc-400 font-medium block">Total Contratos Emitidos</span>
          <span className="text-2xl font-black text-white mt-1 block font-mono">
            {contracts.length}
          </span>
          <span className="text-[10px] text-zinc-500 block mt-1">En {monthlyFolders.length} carpetas mensuales</span>
        </div>

        <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d]">
          <span className="text-[11px] text-zinc-400 font-medium block">Volumen Global Facturado</span>
          <span className="text-2xl font-black text-white mt-1 block font-mono">
            {totalVolume.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </span>
          <span className="text-[10px] text-zinc-500 block mt-1">Total servicios AV (con IVA)</span>
        </div>

        <div className="p-4 rounded-xl bg-linear-to-br from-emerald-950/40 to-[#161b22] border border-emerald-500/40">
          <span className="text-[11px] text-emerald-300 font-semibold block flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Fianzas Cobradas (Fechas Bloqueadas)
          </span>
          <span className="text-2xl font-black text-emerald-400 mt-1 block font-mono">
            {totalDepositCollected.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </span>
          <span className="text-[10px] text-emerald-500/80 block mt-1">Abonos bancarios recibidos</span>
        </div>

        <div className="p-4 rounded-xl bg-linear-to-br from-amber-950/40 to-[#161b22] border border-amber-500/40">
          <span className="text-[11px] text-amber-300 font-semibold block flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Pendientes de Fianza
          </span>
          <span className="text-2xl font-black text-amber-400 mt-1 block font-mono">
            {pendingDepositsCount}
          </span>
          <span className="text-[10px] text-amber-500/80 block mt-1">Por transferir para bloquear</span>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#161b22] p-4 rounded-xl border border-[#30363d]">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por código (CTR-2026-...), evento o cliente..."
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-amber-500 text-black font-bold'
                : 'bg-[#0d1117] text-zinc-400 hover:text-white border border-[#30363d]'
            }`}
          >
            Todos ({contracts.length})
          </button>
          <button
            onClick={() => setStatusFilter('sent')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              statusFilter === 'sent'
                ? 'bg-amber-500 text-black font-bold'
                : 'bg-[#0d1117] text-zinc-400 hover:text-white border border-[#30363d]'
            }`}
          >
            Pendiente 10%
          </button>
          <button
            onClick={() => setStatusFilter('deposit_paid')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              statusFilter === 'deposit_paid'
                ? 'bg-amber-500 text-black font-bold'
                : 'bg-[#0d1117] text-zinc-400 hover:text-white border border-[#30363d]'
            }`}
          >
            10% Abonado
          </button>
          <button
            onClick={() => setStatusFilter('signed')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              statusFilter === 'signed'
                ? 'bg-amber-500 text-black font-bold'
                : 'bg-[#0d1117] text-zinc-400 hover:text-white border border-[#30363d]'
            }`}
          >
            Firmados
          </button>
        </div>
      </div>

      {/* VIEW MODE 1: MONTHLY FOLDERS */}
      {viewMode === 'folders' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider flex items-center gap-2">
              <FolderArchive className="w-4 h-4 text-amber-400" />
              Carpetas Mensuales de Contratos y Facturas
            </span>
            <span className="text-xs text-zinc-500 font-mono">
              {monthlyFolders.length} carpetas activas
            </span>
          </div>

          {monthlyFolders.length === 0 ? (
            <div className="p-12 text-center text-zinc-400 bg-[#161b22] border border-[#30363d] rounded-2xl">
              <Folder className="w-12 h-12 mx-auto text-zinc-600 mb-3" />
              <p className="font-semibold text-sm text-zinc-300">No hay carpetas para los filtros seleccionados</p>
            </div>
          ) : (
            <div className="space-y-4">
              {monthlyFolders.map((folder) => {
                const isExpanded = expandedFolders[folder.folderKey] ?? true;
                return (
                  <div
                    key={folder.folderKey}
                    className="bg-[#161b22] border border-[#30363d] rounded-2xl overflow-hidden shadow-lg transition"
                  >
                    {/* Folder Header */}
                    <div
                      onClick={() => toggleFolder(folder.folderKey)}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-linear-to-r from-[#1c2128] to-[#161b22] hover:bg-[#21262d] cursor-pointer border-b border-[#30363d]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                          {isExpanded ? <FolderOpen className="w-5 h-5" /> : <Folder className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-white tracking-wide">
                              {folder.label}
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                              {folder.contracts.length} {folder.contracts.length === 1 ? 'contrato' : 'contratos'}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-0.5">
                            Carpeta de archivo mensual para contabilidad y fiscalidad
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs">
                        <div className="text-left sm:text-right">
                          <span className="text-[10px] text-zinc-400 block font-medium">Volumen Total Mes</span>
                          <span className="font-mono font-bold text-white text-sm">
                            {folder.totalAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBulkPrintFolder(folder.contracts);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                            title="Abrir lote de contratos de este mes"
                          >
                            <Printer className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Imprimir / PDF</span>
                          </button>
                          <div className="p-1 text-zinc-400">
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Folder Content (Contracts List) */}
                    {isExpanded && (
                      <div className="divide-y divide-[#30363d]/60 bg-[#0d1117]/50">
                        {folder.contracts.map((c) => (
                          <div
                            key={c.id}
                            className="p-3.5 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#161b22] transition"
                          >
                            <div className="flex items-start gap-3">
                              <span className="font-mono font-bold text-amber-400 text-xs bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20 shrink-0">
                                {c.code}
                              </span>
                              <div>
                                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                                  <span>{c.eventName}</span>
                                </h4>
                                <div className="text-[11px] text-zinc-400 flex flex-wrap items-center gap-2 mt-0.5">
                                  <span>👤 {c.clientName}</span>
                                  <span>•</span>
                                  <span>📅 {new Date(c.eventDate).toLocaleDateString('es-ES')}</span>
                                  <span>•</span>
                                  <span>📍 {c.eventLocation}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                              <div className="text-left sm:text-right">
                                <span className="font-bold text-white text-xs block font-mono">
                                  {c.totalAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                                </span>
                                <span className="text-[10px] text-amber-400/90 font-mono block">
                                  10%: {c.depositAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setGatewayContract(c)}
                                  className="px-2.5 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                  title="Pasarela de pago bancaria"
                                >
                                  <CreditCard className="w-3 h-3" />
                                  <span className="hidden sm:inline">Pasarela</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPrintContract(c)}
                                  className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                  title="Ver factura y contrato en PDF"
                                >
                                  <Printer className="w-3 h-3" />
                                  <span>PDF</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenWhatsApp(c)}
                                  className="p-1.5 rounded-lg bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30 cursor-pointer"
                                  title="Enviar por WhatsApp"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* VIEW MODE 2: TRADITIONAL LIST TABLE */
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-lg">
          {filteredContracts.length === 0 ? (
            <div className="p-12 text-center text-zinc-400">
              <FileSignature className="w-12 h-12 mx-auto text-zinc-600 mb-3" />
              <p className="font-semibold text-sm text-zinc-300">No se encontraron contratos</p>
              <p className="text-xs text-zinc-500 mt-1">
                Prueba cambiando los filtros de búsqueda o pulsa en "Nuevo Contrato".
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#0d1117] text-zinc-400 border-b border-[#30363d] font-semibold text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4">Contrato / Código</th>
                    <th className="py-3 px-4">Evento & Fecha</th>
                    <th className="py-3 px-4">Cliente & Contacto</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4 text-right">Económico (10% Reserva)</th>
                    <th className="py-3 px-4 text-center">Acciones Directas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#30363d]">
                  {filteredContracts.map((c) => (
                    <tr key={c.id} className="hover:bg-[#1c2128] transition">
                      {/* Code & Created */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-amber-400">{c.code}</div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">
                          {new Date(c.createdAt).toLocaleDateString('es-ES')}
                        </div>
                      </td>

                      {/* Event & Location */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-bold text-white leading-snug">{c.eventName}</div>
                        <div className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-zinc-500" />
                          <span>
                            {new Date(c.eventDate).toLocaleDateString('es-ES', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-500 truncate mt-0.5">
                          📍 {c.eventLocation}
                        </div>
                      </td>

                      {/* Client */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-zinc-200">{c.clientName}</div>
                        {c.clientTaxId && (
                          <div className="text-[10px] text-zinc-500 font-mono">CIF: {c.clientTaxId}</div>
                        )}
                        <div className="text-[10px] text-zinc-400 mt-0.5">
                          {c.clientPhone} • {c.clientEmail}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {getStatusBadge(c.status)}
                        {c.depositPaidAt && (
                          <div className="text-[9px] text-emerald-400/80 mt-1 font-mono">
                            Abonado: {new Date(c.depositPaidAt).toLocaleDateString('es-ES')}
                          </div>
                        )}
                      </td>

                      {/* Financial Breakdown with % Deposit Highlight */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-bold text-white text-sm">
                          {c.totalAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                        </div>
                        <div className="inline-block mt-1 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-black">
                          {c.depositRate || 10}% Reserva: {c.depositAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">
                          Resto: {c.remainingAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                        </div>
                        {onNavigate && (
                          <div className="mt-1">
                            <button
                              onClick={() => onNavigate('dispatches')}
                              className="inline-flex items-center gap-1 text-[10px] text-amber-400/90 hover:text-amber-300 transition font-mono hover:underline cursor-pointer"
                              title="Ir al Albarán de Salida para que el técnico prepare el pedido"
                            >
                              <Truck className="w-3 h-3" />
                              <span>Albarán Salida ↗</span>
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Quick Direct Actions */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap items-center justify-center gap-1.5">
                          {/* Prominent Payment Gateway Button */}
                          <button
                            onClick={() => setGatewayContract(c)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[11px] font-bold transition shadow-xs cursor-pointer"
                            title="Abrir pasarela bancaria directa, QR SEPA y Bizum"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Pasarela de Pago</span>
                          </button>

                          {/* WhatsApp Button */}
                          <button
                            onClick={() => handleOpenWhatsApp(c)}
                            className="p-1.5 rounded-lg bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30 transition cursor-pointer"
                            title="Enviar contrato y datos bancarios por WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>

                          {/* Email Button */}
                          <button
                            onClick={() => handleOpenEmail(c)}
                            className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 transition cursor-pointer"
                            title="Enviar detalles de pago por correo electrónico"
                          >
                            <Mail className="w-4 h-4" />
                          </button>

                          {/* Print / Export Contract Button */}
                          <button
                            onClick={() => setPrintContract(c)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-semibold transition cursor-pointer"
                            title="Exportar e imprimir contrato con el logotipo de JD"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Exportar / Imprimir</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Generate Contract Modal */}
      <GenerateContractModal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        onContractCreated={(c) => {
          setGatewayContract(c);
        }}
      />

      {/* Bank Transfer Gateway Modal */}
      <PaymentGatewayModal
        isOpen={Boolean(gatewayContract)}
        onClose={() => setGatewayContract(null)}
        contract={gatewayContract}
        onMarkPaid={handleMarkPaid}
        onOpenPrintContract={(c) => {
          setPrintContract(c);
        }}
      />

      {/* Formal Printable Document Modal */}
      <PrintContractModal
        isOpen={Boolean(printContract)}
        onClose={() => setPrintContract(null)}
        contract={printContract}
      />
    </div>
  );
};
