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
  Building2,
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
  Edit3,
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { Contract, ContractStatus } from '../../types/inventory.ts';
import { GenerateContractModal } from './GenerateContractModal.tsx';
import { PaymentGatewayModal } from './PaymentGatewayModal.tsx';
import { PrintContractModal } from './PrintContractModal.tsx';
import { CompanyFiscalConfigModal } from './CompanyFiscalConfigModal.tsx';
import { EditContractModal } from './EditContractModal.tsx';
import { composeWhatsAppContractMessage } from '../../lib/barcodeUtils.ts';

interface ContractsViewProps {
  onNavigate?: (view: string) => void;
}

export const ContractsView: React.FC<ContractsViewProps> = ({ onNavigate }) => {
  const { contracts, updateContractStatus, companyFiscalConfig } = useInventory();
  const { userProfile, canManageInventory } = useAuth();

  const [viewMode, setViewMode] = useState<'list' | 'folders'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ContractStatus>('all');
  const [expandedYears, setExpandedYears] = useState<Record<number, boolean>>({
    2026: true,
    2025: true,
  });
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({
    '2026-11': true,
    '2026-10': true,
  });

  const toggleYear = (year: number) => {
    setExpandedYears((prev) => ({
      ...prev,
      [year]: !prev[year],
    }));
  };

  const toggleMonth = (folderKey: string) => {
    setExpandedMonths((prev) => ({
      ...prev,
      [folderKey]: !prev[folderKey],
    }));
  };

  // Modals state
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [gatewayContract, setGatewayContract] = useState<Contract | null>(null);
  const [printContract, setPrintContract] = useState<Contract | null>(null);
  const [isCompanyConfigModalOpen, setIsCompanyConfigModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);

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

  // Grouping by Year and then divided into Months
  const yearlyFolders = React.useMemo(() => {
    const yearMap: Record<
      number,
      {
        year: number;
        totalContracts: number;
        totalAmount: number;
        depositAmount: number;
        monthsMap: Record<
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
        >;
      }
    > = {};

    filteredContracts.forEach((contract) => {
      const d = new Date(contract.eventDate || contract.createdAt);
      const year = isNaN(d.getFullYear()) ? new Date().getFullYear() : d.getFullYear();
      const monthNumber = String(d.getMonth() + 1).padStart(2, '0');
      const folderKey = `${year}-${monthNumber}`;
      const rawMonthName = d.toLocaleDateString('es-ES', { month: 'long' });
      const capitalizedMonth = rawMonthName.charAt(0).toUpperCase() + rawMonthName.slice(1);
      const label = `${capitalizedMonth} ${year}`;

      if (!yearMap[year]) {
        yearMap[year] = {
          year,
          totalContracts: 0,
          totalAmount: 0,
          depositAmount: 0,
          monthsMap: {},
        };
      }

      yearMap[year].totalContracts += 1;
      yearMap[year].totalAmount += contract.totalAmount;
      yearMap[year].depositAmount += contract.depositAmount;

      if (!yearMap[year].monthsMap[folderKey]) {
        yearMap[year].monthsMap[folderKey] = {
          folderKey,
          label,
          year,
          monthName: capitalizedMonth,
          contracts: [],
          totalAmount: 0,
          depositAmount: 0,
        };
      }

      yearMap[year].monthsMap[folderKey].contracts.push(contract);
      yearMap[year].monthsMap[folderKey].totalAmount += contract.totalAmount;
      yearMap[year].monthsMap[folderKey].depositAmount += contract.depositAmount;
    });

    return Object.values(yearMap)
      .sort((a, b) => b.year - a.year)
      .map((y) => ({
        ...y,
        months: Object.values(y.monthsMap).sort((a, b) => b.folderKey.localeCompare(a.folderKey)),
      }));
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
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Contratos y Facturación
              </h1>
              <button
                type="button"
                onClick={() => setIsCompanyConfigModalOpen(true)}
                className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 px-2.5 py-1 rounded flex items-center gap-1.5 transition cursor-pointer"
                title="Pulsa para cambiar CIF de empresa, ubicación y sede de almacén"
              >
                <Building className="w-3 h-3 text-amber-400" />
                <span>{companyFiscalConfig?.tradeName || companyFiscalConfig?.companyName || 'JD AUDIOVISUALES S.L.'}</span>
                <span className="text-cyan-300 font-mono">({companyFiscalConfig?.cif || 'B-89234812'})</span>
                <span className="text-[9px] bg-amber-500/30 text-amber-200 px-1 rounded">Editar ✎</span>
              </button>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl">
              Ubicación sede: <span className="text-zinc-300 font-medium">{companyFiscalConfig?.address || 'Polígono Industrial La Estación, Nave 4'}</span>. Gestión de contratos por carpetas, pasarela SEPA (Anticipo 10% o Pago Total 100%) y descarga PDF.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Button to edit Company Fiscal Data, Location & CIF */}
          <button
            type="button"
            onClick={() => setIsCompanyConfigModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0d1117] hover:bg-[#1c2128] text-amber-300 hover:text-amber-200 border border-amber-500/30 hover:border-amber-500/60 text-xs font-bold transition shadow-xs cursor-pointer"
            title="Cambiar CIF, ubicación de la empresa, teléfono, email, cuenta bancaria y cláusulas"
          >
            <Building2 className="w-3.5 h-3.5 text-amber-400" />
            <span>⚙️ Mi CIF & Ubicación</span>
          </button>

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
              <span>Lista</span>
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
              <span>Carpetas</span>
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
          <span className="text-[10px] text-zinc-500 block mt-1">
            En {yearlyFolders.length} carpetas anuales ({yearlyFolders.reduce((acc, y) => acc + y.months.length, 0)} meses)
          </span>
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

      {/* VIEW MODE 1: ANNUAL & MONTHLY FOLDERS */}
      {viewMode === 'folders' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider flex items-center gap-2">
              <FolderArchive className="w-4 h-4 text-amber-400" />
              Carpetas Anuales y Mensuales de Contratos y Facturas
            </span>
            <span className="text-xs text-zinc-500 font-mono">
              {yearlyFolders.length} ejercicios anuales archivados
            </span>
          </div>

          {yearlyFolders.length === 0 ? (
            <div className="p-12 text-center text-zinc-400 bg-[#161b22] border border-[#30363d] rounded-2xl">
              <Folder className="w-12 h-12 mx-auto text-zinc-600 mb-3" />
              <p className="font-semibold text-sm text-zinc-300">No hay contratos para los filtros seleccionados</p>
            </div>
          ) : (
            <div className="space-y-5">
              {yearlyFolders.map((yearFolder) => {
                const isYearExpanded = expandedYears[yearFolder.year] ?? true;
                return (
                  <div
                    key={yearFolder.year}
                    className="bg-[#161b22] border-2 border-[#30363d] rounded-2xl overflow-hidden shadow-xl"
                  >
                    {/* Annual Folder Header */}
                    <div
                      onClick={() => toggleYear(yearFolder.year)}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-linear-to-r from-[#1f242c] via-[#161b22] to-[#12161c] hover:bg-[#21262d] cursor-pointer border-b border-[#30363d]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0 shadow-xs">
                          {isYearExpanded ? <FolderOpen className="w-6 h-6 text-amber-400" /> : <Folder className="w-6 h-6 text-amber-500" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2.5">
                            <h3 className="text-base font-black text-white tracking-wide">
                              Carpeta Anual {yearFolder.year}
                            </h3>
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                              {yearFolder.totalContracts} {yearFolder.totalContracts === 1 ? 'contrato' : 'contratos'}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700 hidden sm:inline">
                              {yearFolder.months.length} {yearFolder.months.length === 1 ? 'mes' : 'meses'}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-0.5">
                            Archivo anual para contabilidad y facturación, dividido en carpetas mensuales
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs">
                        <div className="text-left sm:text-right">
                          <span className="text-[10px] text-zinc-400 block font-medium">Volumen Ejercicio {yearFolder.year}</span>
                          <span className="font-mono font-bold text-amber-300 text-sm">
                            {yearFolder.totalAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                          </span>
                        </div>
                        <div className="p-1 text-zinc-400">
                          {isYearExpanded ? <ChevronDown className="w-5 h-5 text-amber-400" /> : <ChevronRight className="w-5 h-5" />}
                        </div>
                      </div>
                    </div>

                    {/* Sub-Folders: Monthly inside the Year */}
                    {isYearExpanded && (
                      <div className="p-3 sm:p-4 space-y-3 bg-[#0d1117]/60">
                        {yearFolder.months.map((month) => {
                          const isMonthExpanded = expandedMonths[month.folderKey] ?? true;
                          return (
                            <div
                              key={month.folderKey}
                              className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-sm"
                            >
                              {/* Monthly Subfolder Header */}
                              <div
                                onClick={() => toggleMonth(month.folderKey)}
                                className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-linear-to-r from-[#161b22] to-[#1a1f26] hover:bg-[#21262d] cursor-pointer border-b border-[#30363d]/70"
                              >
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
                                    {isMonthExpanded ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h4 className="text-xs font-bold text-white tracking-wide">
                                        {month.label}
                                      </h4>
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
                                        {month.contracts.length} {month.contracts.length === 1 ? 'contrato' : 'contratos'}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 text-xs">
                                  <div className="text-left sm:text-right">
                                    <span className="text-[10px] text-zinc-400 block font-medium">Facturación Mes</span>
                                    <span className="font-mono font-bold text-white text-xs">
                                      {month.totalAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleBulkPrintFolder(month.contracts);
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                                      title="Abrir contrato de este mes"
                                    >
                                      <Printer className="w-3 h-3 text-cyan-400" />
                                      <span>Ver Lote</span>
                                    </button>
                                    <div className="p-1 text-zinc-400">
                                      {isMonthExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Contracts inside this Month */}
                              {isMonthExpanded && (
                                <div className="divide-y divide-[#30363d]/60 bg-[#0d1117]/40">
                                  {month.contracts.map((c) => (
                                    <div
                                      key={c.id}
                                      className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#161b22] transition"
                                    >
                                      <div className="flex items-start gap-3">
                                        <span className="font-mono font-bold text-amber-400 text-xs bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20 shrink-0">
                                          {c.code}
                                        </span>
                                        <div>
                                          <h5 className="text-xs font-bold text-white flex items-center gap-2">
                                            <span>{c.eventName}</span>
                                          </h5>
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
                                            onClick={() => setEditingContract(c)}
                                            className="px-2 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-zinc-700 hover:border-amber-500/40 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                                            title="Editar contrato, CIF y ubicación del evento"
                                          >
                                            <Edit3 className="w-3 h-3" />
                                            <span>Editar</span>
                                          </button>
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
                                            title="Ver factura y contrato con logo"
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
                                          <button
                                            type="button"
                                            onClick={() => handleOpenEmail(c)}
                                            className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 cursor-pointer"
                                            title="Enviar por correo electrónico"
                                          >
                                            <Mail className="w-3.5 h-3.5" />
                                          </button>
                                          {c.status === 'sent' && (
                                            <button
                                              type="button"
                                              onClick={() => handleMarkPaid(c.id, 'Transferencia Directa Verificada')}
                                              className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold cursor-pointer"
                                              title="Marcar fianza del 10% como abonada"
                                            >
                                              Marcar 10%
                                            </button>
                                          )}
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
                          {/* Edit Contract Button */}
                          <button
                            onClick={() => setEditingContract(c)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-zinc-700 hover:border-amber-500/40 text-[11px] font-bold transition shadow-xs cursor-pointer"
                            title="Editar contrato, CIF del cliente y ubicación del evento"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Editar</span>
                          </button>

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

      {/* Company Fiscal, Location and Bank Configuration Modal */}
      <CompanyFiscalConfigModal
        isOpen={isCompanyConfigModalOpen}
        onClose={() => setIsCompanyConfigModalOpen(false)}
      />

      {/* Edit Contract, Client CIF and Event Location Modal */}
      <EditContractModal
        isOpen={Boolean(editingContract)}
        contract={editingContract}
        onClose={() => setEditingContract(null)}
      />
    </div>
  );
};
