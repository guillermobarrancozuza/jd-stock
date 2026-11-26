import React, { useRef, useState } from 'react';
import {
  X,
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
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext.tsx';
import { downloadBackupReminderIcs } from '../../lib/barcodeUtils.ts';

interface BackupManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BackupManagerModal: React.FC<BackupManagerModalProps> = ({ isOpen, onClose }) => {
  const {
    backupConfig,
    isBackupDue,
    updateBackupConfig,
    exportFullBackupJson,
    exportContractsAndDispatchesArchive,
    restoreFullBackupJson,
    contracts,
    dispatches,
    items,
  } = useInventory();

  const [enabled, setEnabled] = useState(backupConfig.enabled);
  const [intervalMonths, setIntervalMonths] = useState(backupConfig.intervalMonths || 3);
  const [adminEmail, setAdminEmail] = useState(backupConfig.adminEmail || 'admin@jdcontrol.es');
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [restoring, setRestoring] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const nextBackupDate = (() => {
    if (!backupConfig.lastBackupDate) return 'Pendiente (nunca realizado)';
    const d = new Date(backupConfig.lastBackupDate);
    d.setMonth(d.getMonth() + Math.max(1, intervalMonths));
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  })();

  const handleSaveConfig = () => {
    updateBackupConfig({
      enabled,
      intervalMonths: Math.max(1, Math.min(12, Number(intervalMonths) || 3)),
      adminEmail: adminEmail.trim() || 'admin@jdcontrol.es',
    });
    setMessage({
      type: 'ok',
      text: `Recordatorio guardado: avisar cada ${intervalMonths} ${intervalMonths === 1 ? 'mes' : 'meses'} a ${adminEmail.trim()}.`,
    });
  };

  const handleDownloadFullJson = () => {
    exportFullBackupJson();
    setMessage({
      type: 'ok',
      text: 'Backup completo (.json) descargado. Guárdalo en tu ordenador físico o disco externo.',
    });
  };

  const handleDownloadContractsArchive = () => {
    exportContractsAndDispatchesArchive();
    setMessage({
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
        `Accede a JD Control de Stock > Copias de Seguridad para descargar los archivos.\n`
    );

    updateBackupConfig({ lastReminderSentDate: new Date().toISOString() });
    window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`;
    setMessage({
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
    setMessage({
      type: 'ok',
      text: `Evento recurrente de calendario (.ics) cada ${intervalMonths} meses descargado.`,
    });
  };

  const handleSnooze7Days = () => {
    const snoozeDate = new Date();
    snoozeDate.setDate(snoozeDate.getDate() + 7);
    updateBackupConfig({ snoozedUntil: snoozeDate.toISOString() });
    setMessage({
      type: 'ok',
      text: 'Recordatorio pospuesto 7 días.',
    });
  };

  const handleRestoreFile = async (file: File) => {
    try {
      setRestoring(true);
      setMessage(null);
      const text = await file.text();
      const res = await restoreFullBackupJson(text);
      setMessage({
        type: 'ok',
        text: `Copia de seguridad restaurada correctamente (${res.restoredCollections} bloques de datos recuperados).`,
      });
    } catch (err: any) {
      setMessage({
        type: 'err',
        text: err.message || 'El archivo seleccionado no es un backup JSON válido de JD Control de Stock.',
      });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto no-print">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-2xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#30363d] flex items-center justify-between bg-gradient-to-r from-cyan-950/40 via-[#161b22] to-[#161b22]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Centro de Copias de Seguridad y Recordatorios (Admin Jefe)
              </h2>
              <p className="text-[11px] text-zinc-400">
                Descarga el JSON completo de la página y guarda contratos + albaranes en tu ordenador físico
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 overflow-y-auto text-xs flex-1">
          {/* Status Banner */}
          <div
            className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
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

          {message && (
            <div
              className={`p-3 rounded-xl border font-semibold flex items-center gap-2 ${
                message.type === 'ok'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
              }`}
            >
              {message.type === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {/* Direct Backup Downloads */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-[#0d1117] border border-cyan-500/30 space-y-2.5 flex flex-col justify-between">
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

            <div className="p-4 rounded-xl bg-[#0d1117] border border-amber-500/30 space-y-2.5 flex flex-col justify-between">
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
            <div className="flex items-center justify-between border-b border-[#30363d] pb-2">
              <span className="font-bold text-white uppercase text-[11px] tracking-wider">
                Configuración del Recordatorio Periódico al Administrador Jefe
              </span>
              <label className="flex items-center gap-2 cursor-pointer text-[11px]">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
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
                onClick={handleSaveConfig}
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

        {/* Footer */}
        <div className="p-4 border-t border-[#30363d] bg-[#0d1117] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[#30363d] hover:bg-zinc-800 text-zinc-300 text-xs font-semibold cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
