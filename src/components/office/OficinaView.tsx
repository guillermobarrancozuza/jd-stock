import React, { useEffect, useRef, useState } from 'react';
import {
  Building2,
  FileSignature,
  Users,
  HardDrive,
  Download,
  Upload,
  Mail,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileArchive,
  Save,
  ShieldAlert,
  LayoutGrid,
  UserCheck,
  ArrowRight,
  Truck,
  Crown,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useInventory } from '../../context/InventoryContext.tsx';
import { ContractsView } from '../contracts/ContractsView.tsx';
import { UsersManagementView } from '../users/UsersManagementView.tsx';
import { downloadBackupReminderIcs } from '../../lib/barcodeUtils.ts';

export type OficinaTab = 'resumen' | 'contracts' | 'users' | 'backup';

interface OficinaViewProps {
  initialTab?: OficinaTab;
  onNavigate: (view: string) => void;
}

export const OficinaView: React.FC<OficinaViewProps> = ({
  initialTab = 'resumen',
  onNavigate,
}) => {
  const { isAdmin, allUsers, updateUserRole } = useAuth();
  const {
    contracts,
    dispatches,
    items,
    backupConfig,
    isBackupDue,
    updateBackupConfig,
    exportFullBackupJson,
    exportContractsAndDispatchesArchive,
    restoreFullBackupJson,
  } = useInventory();

  const [activeTab, setActiveTab] = useState<OficinaTab>(initialTab);

  // Backup configuration local state
  const [backupEnabled, setBackupEnabled] = useState(backupConfig.enabled);
  const [intervalMonths, setIntervalMonths] = useState(backupConfig.intervalMonths || 3);
  const [adminEmail, setAdminEmail] = useState(backupConfig.adminEmail || 'admin@jdcontrol.es');
  const [backupMessage, setBackupMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );
  const [restoring, setRestoring] = useState(false);
  const [quickApprovingId, setQuickApprovingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setBackupEnabled(backupConfig.enabled);
    setIntervalMonths(backupConfig.intervalMonths || 3);
    setAdminEmail(backupConfig.adminEmail || 'admin@jdcontrol.es');
  }, [backupConfig.enabled, backupConfig.intervalMonths, backupConfig.adminEmail]);

  if (!isAdmin) {
    return (
      <div className="p-8 text-center bg-[#161b22] border border-rose-500/30 rounded-2xl max-w-lg mx-auto mt-10">
        <ShieldAlert className="w-12 h-12 text-rose-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-white mb-2">Acceso Exclusivo de Oficina</h2>
        <p className="text-xs text-zinc-400">
          El panel de OFICINA (Contratos, Reservas, Roles de Personal y Copias de Seguridad) solo es visible para el Administrador Jefe.
        </p>
      </div>
    );
  }

  // Metrics for Office Executive Dashboard
  const pendingUsers = allUsers.filter((u) => u.role === 'pending' || u.status === 'pending');
  const activeStaff = allUsers.filter((u) => u.role !== 'pending' && u.status !== 'pending');
  const pendingContracts = contracts.filter((c) => c.status === 'draft' || c.status === 'sent');
  const confirmedContracts = contracts.filter(
    (c) => c.status === 'deposit_paid' || c.status === 'signed'
  );
  const totalContractVolume = contracts
    .filter((c) => c.status !== 'cancelled')
    .reduce((sum, c) => sum + (Number(c.totalAmount) || 0), 0);

  const nextBackupDate = (() => {
    if (!backupConfig.lastBackupDate) return 'Pendiente (nunca realizado)';
    const d = new Date(backupConfig.lastBackupDate);
    d.setMonth(d.getMonth() + Math.max(1, intervalMonths));
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  })();

  const handleSaveBackupConfig = () => {
    const cleanMonths = Math.max(1, Math.min(12, Number(intervalMonths) || 3));
    const cleanEmail = adminEmail.trim() || 'admin@jdcontrol.es';
    updateBackupConfig({
      enabled: backupEnabled,
      intervalMonths: cleanMonths,
      adminEmail: cleanEmail,
    });
    setBackupMessage({
      type: 'ok',
      text: `Recordatorio guardado: avisar cada ${cleanMonths} ${cleanMonths === 1 ? 'mes' : 'meses'} a ${cleanEmail}.`,
    });
  };

  const handleDownloadFullJson = () => {
    exportFullBackupJson();
    setBackupMessage({
      type: 'ok',
      text: 'Backup completo (.json) descargado. Guárdalo en tu ordenador físico o disco externo.',
    });
  };

  const handleDownloadContractsArchive = () => {
    exportContractsAndDispatchesArchive();
    setBackupMessage({
      type: 'ok',
      text: 'Archivo de Contratos y Albaranes (.json + .xlsx) descargado para guardar en tu PC físico.',
    });
  };

  const handleSendEmailReminder = () => {
    const recipient = adminEmail.trim() || backupConfig.adminEmail || 'admin@jdcontrol.es';
    const subject = encodeURIComponent(
      `[JD Control de Stock] Recordatorio de Copia de Seguridad (cada ${intervalMonths} meses)`
    );
    const body = encodeURIComponent(
      `Hola Administrador Jefe,\n\n` +
        `Este es tu recordatorio periódico (cada ${intervalMonths} meses) para realizar una copia de seguridad en tu ordenador físico:\n\n` +
        `1. Descargar el archivo JSON completo de toda la aplicación (por si hubiera una caída).\n` +
        `2. Guardar copia local de todos los Contratos (${contracts.length}) y Albaranes (${dispatches.length}).\n\n` +
        `Resumen actual:\n` +
        `- Artículos en inventario: ${items.length}\n` +
        `- Contratos registrados: ${contracts.length}\n` +
        `- Albaranes registrados: ${dispatches.length}\n\n` +
        `Accede a JD Control de Stock > OFICINA > Copias de Seguridad para descargar los archivos.\n`
    );

    updateBackupConfig({ lastReminderSentDate: new Date().toISOString() });
    window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`;
    setBackupMessage({
      type: 'ok',
      text: `Correo de recordatorio preparado para ${recipient}.`,
    });
  };

  const handleDownloadCalendarReminder = () => {
    downloadBackupReminderIcs({
      ...backupConfig,
      intervalMonths,
      adminEmail: adminEmail.trim() || backupConfig.adminEmail,
    });
    setBackupMessage({
      type: 'ok',
      text: `Evento recurrente de calendario (.ics) cada ${intervalMonths} meses descargado.`,
    });
  };

  const handleSnooze7Days = () => {
    const snoozeDate = new Date();
    snoozeDate.setDate(snoozeDate.getDate() + 7);
    updateBackupConfig({ snoozedUntil: snoozeDate.toISOString() });
    setBackupMessage({
      type: 'ok',
      text: 'Recordatorio pospuesto 7 días.',
    });
  };

  const handleRestoreFile = async (file: File) => {
    try {
      setRestoring(true);
      setBackupMessage(null);
      const text = await file.text();
      const res = await restoreFullBackupJson(text);
      setBackupMessage({
        type: 'ok',
        text: `Copia de seguridad restaurada correctamente (${res.restoredCollections} bloques de datos recuperados).`,
      });
    } catch (err: any) {
      setBackupMessage({
        type: 'err',
        text:
          err.message ||
          'El archivo seleccionado no es un backup JSON válido de JD Control de Stock.',
      });
    } finally {
      setRestoring(false);
    }
  };

  const handleQuickApprove = async (userId: string, role: 'technician' | 'warehouse_manager') => {
    try {
      setQuickApprovingId(userId);
      await updateUserRole(userId, role);
    } finally {
      setQuickApprovingId(null);
    }
  };

  const contractStatusLabels: Record<string, { label: string; color: string }> = {
    draft: { label: 'Borrador', color: 'bg-zinc-700/60 text-zinc-300 border-zinc-600' },
    sent: { label: 'Enviado', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
    deposit_paid: { label: 'Reserva 10%', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    signed: { label: 'Firmado', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    cancelled: { label: 'Cancelado', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  };

  return (
    <div className="space-y-6">
      {/* Unified OFICINA Header */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5 shadow-xl no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-md shadow-amber-500/10">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  OFICINA — Gestión Interna
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold uppercase tracking-wider">
                  <Crown className="w-3 h-3" />
                  Solo Admin Jefe
                </span>
              </div>
              <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                Panel único privado de oficina: contratos y reservas 10%, aprobación de personal/roles y copias de seguridad periódicas.
              </p>
            </div>
          </div>

          {/* Quick Office Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadFullJson}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Backup .JSON</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('contracts')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition cursor-pointer"
            >
              <FileSignature className="w-3.5 h-3.5" />
              <span>Contratos y Reservas</span>
            </button>
          </div>
        </div>

        {/* Chief Admin Backup Reminder Banner (Lives EXCLUSIVELY inside OFICINA) */}
        {isBackupDue && (
          <div className="mt-4 p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <div className="font-bold text-amber-200">
                  Recordatorio de Copia de Seguridad (cada {backupConfig.intervalMonths} mes
                  {backupConfig.intervalMonths > 1 ? 'es' : ''})
                </div>
                <p className="text-zinc-200 mt-0.5">
                  Toca guardar tus contratos y albaranes en tu ordenador físico y descargar el archivo{' '}
                  <strong className="text-white">.JSON completo</strong> de la plataforma por si hubiera una caída.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleDownloadFullJson}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar JSON Ahora</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadContractsArchive}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0d1117] hover:bg-zinc-800 text-amber-200 border border-amber-500/30 font-semibold text-xs cursor-pointer"
              >
                <FileArchive className="w-3.5 h-3.5" />
                <span>Contratos + Albaranes</span>
              </button>
              {activeTab !== 'backup' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('backup')}
                  className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-[#30363d] font-semibold text-xs cursor-pointer"
                >
                  Configurar / Correo
                </button>
              )}
            </div>
          </div>
        )}

        {/* Executive KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
          <button
            type="button"
            onClick={() => setActiveTab('contracts')}
            className={`text-left p-3.5 rounded-xl border transition cursor-pointer ${
              activeTab === 'contracts'
                ? 'bg-amber-500/10 border-amber-500/50'
                : 'bg-[#0d1117] border-[#30363d] hover:border-amber-500/40'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <span className="font-semibold">Contratos & Reservas</span>
              <FileSignature className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-extrabold text-white font-mono">{contracts.length}</div>
            <div className="text-[11px] text-zinc-400 mt-1 flex items-center justify-between">
              <span>{pendingContracts.length} pendientes</span>
              <span className="text-amber-300 font-semibold font-mono">
                {totalContractVolume.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`text-left p-3.5 rounded-xl border transition cursor-pointer ${
              activeTab === 'users'
                ? 'bg-cyan-500/10 border-cyan-500/50'
                : 'bg-[#0d1117] border-[#30363d] hover:border-cyan-500/40'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <span className="font-semibold">Personal y Roles</span>
              <Users className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-white font-mono">
                {activeStaff.length}
              </span>
              <span className="text-[11px] text-zinc-500">activos</span>
            </div>
            <div className="text-[11px] mt-1">
              {pendingUsers.length > 0 ? (
                <span className="text-amber-300 font-bold animate-pulse">
                  {pendingUsers.length} esperando rol
                </span>
              ) : (
                <span className="text-emerald-400">Sin solicitudes pendientes</span>
              )}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`text-left p-3.5 rounded-xl border transition cursor-pointer ${
              activeTab === 'backup'
                ? 'bg-emerald-500/10 border-emerald-500/50'
                : isBackupDue
                ? 'bg-amber-500/10 border-amber-500/40 hover:border-amber-400'
                : 'bg-[#0d1117] border-[#30363d] hover:border-emerald-500/40'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <span className="font-semibold">Copia de Seguridad</span>
              <HardDrive
                className={`w-4 h-4 ${isBackupDue ? 'text-amber-400' : 'text-emerald-400'}`}
              />
            </div>
            <div
              className={`text-lg font-extrabold ${
                isBackupDue ? 'text-amber-300' : 'text-emerald-300'
              }`}
            >
              {isBackupDue ? 'Pendiente' : 'Al día'}
            </div>
            <div className="text-[11px] text-zinc-400 mt-1 truncate">
              Cada {backupConfig.intervalMonths} mes{backupConfig.intervalMonths > 1 ? 'es' : ''} ·{' '}
              {backupConfig.lastBackupDate
                ? new Date(backupConfig.lastBackupDate).toLocaleDateString('es-ES')
                : 'Sin backup'}
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('dispatches')}
            className="text-left p-3.5 rounded-xl bg-[#0d1117] border border-[#30363d] hover:border-zinc-500 transition cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <span className="font-semibold">Albaranes y Confirmados</span>
              <Truck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-extrabold text-white font-mono">{dispatches.length}</div>
            <div className="text-[11px] text-zinc-400 mt-1">
              {confirmedContracts.length} contratos confirmados
            </div>
          </button>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-[#30363d]">
          <button
            type="button"
            onClick={() => setActiveTab('resumen')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'resumen'
                ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                : 'bg-[#0d1117] text-zinc-300 border border-[#30363d] hover:text-white hover:border-zinc-500'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Dashboard Oficina</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('contracts')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'contracts'
                ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                : 'bg-[#0d1117] text-zinc-300 border border-[#30363d] hover:text-white hover:border-zinc-500'
            }`}
          >
            <FileSignature className="w-4 h-4" />
            <span>Contratos & Reservas 10%</span>
            {pendingContracts.length > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                  activeTab === 'contracts'
                    ? 'bg-black text-amber-400'
                    : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {pendingContracts.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'users'
                ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                : 'bg-[#0d1117] text-zinc-300 border border-[#30363d] hover:text-white hover:border-zinc-500'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Personal y Roles</span>
            {pendingUsers.length > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono animate-pulse ${
                  activeTab === 'users'
                    ? 'bg-black text-amber-400'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                {pendingUsers.length} pend.
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'backup'
                ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                : 'bg-[#0d1117] text-zinc-300 border border-[#30363d] hover:text-white hover:border-zinc-500'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Copias de Seguridad</span>
            {isBackupDue && (
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono animate-pulse ${
                  activeTab === 'backup'
                    ? 'bg-black text-amber-400'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}
              >
                Pendiente
              </span>
            )}
          </button>
        </div>
      </div>

      {/* TAB 1: DASHBOARD OFICINA (Executive Overview) */}
      {activeTab === 'resumen' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Pending Role Approvals Widget */}
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#30363d] pb-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-cyan-400" />
                  <div>
                    <h2 className="text-sm font-bold text-white">
                      Solicitudes de Acceso Pendientes
                    </h2>
                    <p className="text-[11px] text-zinc-400">
                      Asigna rol en 1 clic para dar acceso inmediato a la app
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('users')}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>Ver todos</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {pendingUsers.length === 0 ? (
                <div className="p-6 rounded-xl bg-[#0d1117] border border-[#30363d] text-center space-y-1.5">
                  <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto" />
                  <div className="text-xs font-bold text-white">
                    No hay trabajadores esperando aprobación
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Actualmente hay {activeStaff.length} usuario(s) con rol asignado y acceso activo.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-72 overflow-y-auto">
                  {pendingUsers.map((u) => (
                    <div
                      key={u.id}
                      className="p-3 rounded-xl bg-[#0d1117] border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{u.name}</div>
                        <div className="text-[11px] text-amber-300 font-mono truncate">
                          @{u.username || u.email.split('@')[0]}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={quickApprovingId === u.id}
                          onClick={() => handleQuickApprove(u.id, 'technician')}
                          className="px-2.5 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 text-[11px] font-bold cursor-pointer disabled:opacity-50"
                        >
                          + Técnico
                        </button>
                        <button
                          type="button"
                          disabled={quickApprovingId === u.id}
                          onClick={() => handleQuickApprove(u.id, 'warehouse_manager')}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold cursor-pointer disabled:opacity-50"
                        >
                          + Encargado
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className="w-full py-2.5 rounded-xl bg-[#0d1117] hover:bg-zinc-800 border border-[#30363d] text-xs font-semibold text-zinc-200 transition cursor-pointer"
            >
              Abrir Gestión Completa de Personal y Roles
            </button>
          </div>

          {/* Contracts & Reservations Overview Widget */}
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#30363d] pb-3">
                <div className="flex items-center gap-2">
                  <FileSignature className="w-5 h-5 text-amber-400" />
                  <div>
                    <h2 className="text-sm font-bold text-white">
                      Últimos Contratos y Reservas 10%
                    </h2>
                    <p className="text-[11px] text-zinc-400">
                      Control de presupuestos, contratos genéricos y señal de reserva
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('contracts')}
                  className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>Gestionar</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {contracts.length === 0 ? (
                <div className="p-6 rounded-xl bg-[#0d1117] border border-[#30363d] text-center space-y-1.5">
                  <FileSignature className="w-7 h-7 text-zinc-500 mx-auto" />
                  <div className="text-xs font-bold text-zinc-300">
                    Aún no hay contratos registrados
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    Crea contratos genéricos por apartados y genera el albarán de salida con QR.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {contracts.slice(0, 5).map((contract) => {
                    const st = contractStatusLabels[contract.status] || {
                      label: contract.status,
                      color: 'bg-zinc-700 text-zinc-300 border-zinc-600',
                    };
                    return (
                      <div
                        key={contract.id}
                        onClick={() => setActiveTab('contracts')}
                        className="p-3 rounded-xl bg-[#0d1117] border border-[#30363d] hover:border-amber-500/40 flex items-center justify-between gap-3 cursor-pointer transition"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">
                            {contract.eventName || contract.code}
                          </div>
                          <div className="text-[11px] text-zinc-400 truncate">
                            {contract.clientName} · {contract.code}
                          </div>
                        </div>
                        <div className="text-right shrink-0 space-y-1">
                          <div className="text-xs font-bold text-amber-300 font-mono">
                            {(Number(contract.totalAmount) || 0).toLocaleString('es-ES', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{' '}
                            €
                          </div>
                          <span
                            className={`inline-block px-2 py-0.5 rounded border text-[10px] font-semibold ${st.color}`}
                          >
                            {st.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('contracts')}
              className="w-full py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-xs font-bold text-amber-300 transition cursor-pointer"
            >
              Abrir Panel de Contratos y Reservas 10%
            </button>
          </div>

          {/* Backup & Security Status Full-Width Card */}
          <div className="lg:col-span-2 bg-[#161b22] border border-[#30363d] rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#30363d] pb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                    isBackupDue
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                      : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">
                    Copia de Seguridad Periódica y Archivo Físico (.JSON + Excel)
                  </h2>
                  <p className="text-[11px] text-zinc-400">
                    Último backup:{' '}
                    <strong className="text-zinc-200">
                      {backupConfig.lastBackupDate
                        ? new Date(backupConfig.lastBackupDate).toLocaleString('es-ES')
                        : 'Ninguno registrado'}
                    </strong>{' '}
                    · Próximo recordatorio: <strong className="text-zinc-200">{nextBackupDate}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('backup')}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 cursor-pointer self-start sm:self-center"
              >
                <span>Configurar recordatorio y restauración</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {backupMessage && (
              <div
                className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                  backupMessage.type === 'ok'
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                }`}
              >
                {backupMessage.type === 'ok' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                )}
                <span>{backupMessage.text}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={handleDownloadFullJson}
                className="p-3.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-left transition cursor-pointer"
              >
                <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs mb-1">
                  <Download className="w-4 h-4" />
                  <span>Descargar Backup Completo (.JSON)</span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Todo el inventario, precios, QR conjuntos, cables, contratos y albaranes.
                </p>
              </button>

              <button
                type="button"
                onClick={handleDownloadContractsArchive}
                className="p-3.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-left transition cursor-pointer"
              >
                <div className="flex items-center gap-2 text-amber-300 font-bold text-xs mb-1">
                  <FileArchive className="w-4 h-4" />
                  <span>Contratos y Albaranes (PC Físico)</span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Exporta {contracts.length} contratos y {dispatches.length} albaranes en .xlsx y .json.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('backup')}
                className="p-3.5 rounded-xl bg-[#0d1117] hover:bg-zinc-800/80 border border-[#30363d] text-left transition cursor-pointer"
              >
                <div className="flex items-center gap-2 text-zinc-200 font-bold text-xs mb-1">
                  <Mail className="w-4 h-4 text-emerald-400" />
                  <span>Recordatorio cada {intervalMonths} meses</span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Cambiar frecuencia, enviar aviso a {adminEmail} o restaurar desde .JSON.
                </p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CONTRATOS & RESERVAS 10% */}
      {activeTab === 'contracts' && <ContractsView onNavigate={onNavigate} />}

      {/* TAB 3: PERSONAL Y ROLES */}
      {activeTab === 'users' && <UsersManagementView />}

      {/* TAB 4: COPIAS DE SEGURIDAD Y RECORDATORIOS */}
      {activeTab === 'backup' && (
        <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5 sm:p-6 space-y-5 text-xs">
          {/* Status Header */}
          <div
            className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              isBackupDue
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {isBackupDue ? (
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="font-bold text-sm">
                  {isBackupDue
                    ? 'Toca realizar copia de seguridad en tu ordenador físico'
                    : 'Copia de seguridad al día'}
                </div>
                <div className="text-[11px] opacity-90 mt-0.5">
                  Último backup:{' '}
                  <strong>
                    {backupConfig.lastBackupDate
                      ? new Date(backupConfig.lastBackupDate).toLocaleString('es-ES')
                      : 'Ninguno registrado'}
                  </strong>{' '}
                  · Próximo aviso: <strong>{nextBackupDate}</strong>
                </div>
              </div>
            </div>
            {isBackupDue && (
              <button
                type="button"
                onClick={handleSnooze7Days}
                className="px-3 py-1.5 rounded-lg bg-zinc-900/70 hover:bg-zinc-900 text-amber-300 border border-amber-500/30 text-[11px] font-semibold shrink-0 cursor-pointer flex items-center gap-1"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Posponer 7 días</span>
              </button>
            )}
          </div>

          {backupMessage && (
            <div
              className={`p-3 rounded-xl border font-semibold flex items-center gap-2 ${
                backupMessage.type === 'ok'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
              }`}
            >
              {backupMessage.type === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{backupMessage.text}</span>
            </div>
          )}

          {/* Direct Backup Downloads */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[#0d1117] border border-cyan-500/30 space-y-3 flex flex-col justify-between">
              <div>
                <div className="font-bold text-white text-sm flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-cyan-400" />
                  <span>Backup Completo de la App (.JSON)</span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                  Guarda TODO el sistema (inventario, precios, QR conjuntos, cajas de cables, contratos, albaranes, eventos, clientes y configuración) por si la página se cae.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadFullJson}
                className="w-full py-2.5 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Descargar Backup Completo (.JSON)</span>
              </button>
            </div>

            <div className="p-4 rounded-xl bg-[#0d1117] border border-amber-500/30 space-y-3 flex flex-col justify-between">
              <div>
                <div className="font-bold text-white text-sm flex items-center gap-1.5">
                  <FileArchive className="w-4 h-4 text-amber-400" />
                  <span>Contratos y Albaranes (PC Físico)</span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                  Descarga simultáneamente en Excel (.xlsx) y .json tus{' '}
                  <strong className="text-amber-300">{contracts.length} contratos</strong> y{' '}
                  <strong className="text-amber-300">{dispatches.length} albaranes</strong> para archivo físico.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadContractsArchive}
                className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <FileArchive className="w-4 h-4" />
                <span>Descargar Contratos y Albaranes</span>
              </button>
            </div>
          </div>

          {/* Periodic Reminder Configuration */}
          <div className="p-4 rounded-xl bg-[#0d1117] border border-[#30363d] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#30363d] pb-2">
              <span className="font-bold text-white uppercase text-[11px] tracking-wider">
                Configuración del Recordatorio Periódico al Administrador Jefe
              </span>
              <label className="flex items-center gap-2 cursor-pointer text-[11px]">
                <input
                  type="checkbox"
                  checked={backupEnabled}
                  onChange={(e) => setBackupEnabled(e.target.checked)}
                  className="accent-amber-500"
                />
                <span className="text-zinc-300 font-semibold">Recordatorio activo</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-zinc-400 font-semibold mb-1">
                  Frecuencia del Recordatorio (cada X meses)
                </label>
                <select
                  value={intervalMonths}
                  onChange={(e) => setIntervalMonths(Number(e.target.value))}
                  className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 text-white font-semibold"
                >
                  <option value={1}>Cada 1 mes</option>
                  <option value={2}>Cada 2 meses</option>
                  <option value={3}>Cada 3 meses (Trimestral — Recomendado)</option>
                  <option value={4}>Cada 4 meses</option>
                  <option value={6}>Cada 6 meses (Semestral)</option>
                  <option value={12}>Cada 12 meses (Anual)</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-400 font-semibold mb-1">
                  Correo del Administrador Jefe
                </label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="jefe@tuempresa.es"
                  className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleSaveBackupConfig}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Guardar Frecuencia y Correo</span>
              </button>

              <button
                type="button"
                onClick={handleSendEmailReminder}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-cyan-300 border border-cyan-500/30 font-semibold cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Enviar Aviso por Correo</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadCalendarReminder}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-amber-500/30 font-semibold cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Añadir Alarma al Calendario (.ics)</span>
              </button>
            </div>
          </div>

          {/* Restore Backup JSON */}
          <div className="p-4 rounded-xl bg-[#0d1117] border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="font-bold text-rose-300 flex items-center gap-1.5">
                <Upload className="w-4 h-4" />
                <span>Restaurar App desde Archivo Backup (.JSON)</span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                En caso de caída o cambio de equipo, carga aquí tu último archivo JSON guardado para recuperar todo.
              </p>
            </div>
            <div>
              <input
                type="file"
                ref={fileInputRef}
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleRestoreFile(f);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                disabled={restoring}
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 font-bold transition cursor-pointer shrink-0 disabled:opacity-50"
              >
                {restoring ? 'Restaurando...' : 'Cargar JSON de Restauración'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
