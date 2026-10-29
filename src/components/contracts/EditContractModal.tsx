import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  CheckCircle2,
  FileSignature,
  MapPin,
  Calendar,
  User,
  CreditCard,
  FileText,
  Building,
} from 'lucide-react';
import { Contract, ContractStatus } from '../../types/inventory.ts';
import { useInventory } from '../../context/InventoryContext.tsx';

interface EditContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: Contract | null;
}

export const EditContractModal: React.FC<EditContractModalProps> = ({
  isOpen,
  onClose,
  contract,
}) => {
  const { saveContract } = useInventory();

  const [eventName, setEventName] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientTaxId, setClientTaxId] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [status, setStatus] = useState<ContractStatus>('draft');
  const [notes, setNotes] = useState('');

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (contract && isOpen) {
      setEventName(contract.eventName || '');
      setEventLocation(contract.eventLocation || '');
      // Format dates for datetime-local or date input
      const formatDateForInput = (isoString?: string) => {
        if (!isoString) return '';
        try {
          const d = new Date(isoString);
          return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 16);
        } catch {
          return '';
        }
      };

      setEventDate(formatDateForInput(contract.eventDate));
      setReturnDate(formatDateForInput(contract.returnDate));
      setClientName(contract.clientName || '');
      setClientTaxId(contract.clientTaxId || '');
      setClientPhone(contract.clientPhone || '');
      setClientEmail(contract.clientEmail || '');
      setClientAddress(contract.clientAddress || '');
      setTotalAmount(contract.totalAmount || 0);
      setDepositAmount(contract.depositAmount || 0);
      setStatus(contract.status || 'draft');
      setNotes(contract.notes || '');
    }
  }, [contract, isOpen]);

  if (!isOpen || !contract) return null;

  const handleTotalChange = (val: number) => {
    setTotalAmount(val);
    // Auto calculate 10% deposit
    setDepositAmount(Number((val * 0.1).toFixed(2)));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const remainingAmount = Number((totalAmount - depositAmount).toFixed(2));

      await saveContract({
        ...contract,
        eventName: eventName.trim(),
        eventLocation: eventLocation.trim(),
        eventDate: eventDate ? new Date(eventDate).toISOString() : contract.eventDate,
        returnDate: returnDate ? new Date(returnDate).toISOString() : contract.returnDate,
        clientName: clientName.trim(),
        clientTaxId: clientTaxId.trim(),
        clientPhone: clientPhone.trim(),
        clientEmail: clientEmail.trim(),
        clientAddress: clientAddress.trim(),
        totalAmount,
        depositAmount,
        remainingAmount,
        status,
        notes: notes.trim(),
        updatedAt: new Date().toISOString(),
      });

      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        setIsSaving(false);
        onClose();
      }, 900);
    } catch (err) {
      console.error('Error saving contract:', err);
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-[#161b22] border border-[#30363d] w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#30363d] flex items-center justify-between bg-gradient-to-r from-amber-950/30 via-[#161b22] to-[#161b22]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <FileSignature className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-sm sm:text-base">
                  Editar Contrato & Ubicación
                </h3>
                <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                  {contract.code}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Modifica la ubicación del evento, CIF y datos del cliente, fechas e importes del contrato.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs">
          {savedSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 flex items-center gap-2 font-bold animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>✓ ¡Contrato y ubicación actualizados con éxito!</span>
            </div>
          )}

          {/* Section 1: Event Details & Location */}
          <div className="space-y-3">
            <span className="font-bold text-amber-400 uppercase text-[11px] tracking-wider block flex items-center gap-1.5 border-b border-[#30363d] pb-1.5">
              <MapPin className="w-3.5 h-3.5" /> Ubicación y Datos del Evento
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-zinc-300 font-semibold mb-1">
                  Nombre del Evento <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="Ej: Festival Sonorama 2026 - Escenario Principal"
                  required
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-zinc-300 font-semibold mb-1">
                  📍 Ubicación / Lugar del Evento <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  placeholder="Ej: Recinto Ferial El Picón, Aranda de Duero / Hotel Eurostars"
                  required
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-amber-300 font-medium text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  <Calendar className="w-3 h-3 inline mr-1 text-cyan-400" />
                  Fecha y Hora de Inicio
                </label>
                <input
                  type="datetime-local"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  <Calendar className="w-3 h-3 inline mr-1 text-cyan-400" />
                  Fecha y Hora de Retorno
                </label>
                <input
                  type="datetime-local"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Client & Fiscal Data */}
          <div className="space-y-3">
            <span className="font-bold text-cyan-400 uppercase text-[11px] tracking-wider block flex items-center gap-1.5 border-b border-[#30363d] pb-1.5">
              <User className="w-3.5 h-3.5" /> Datos Fiscales del Cliente
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Nombre o Razón Social del Cliente <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Ej: Festival Sonorama Producciones S.L."
                  required
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  CIF / NIF / DNI del Cliente
                </label>
                <input
                  type="text"
                  value={clientTaxId}
                  onChange={(e) => setClientTaxId(e.target.value)}
                  placeholder="Ej: B-87239102"
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-cyan-300 font-mono font-bold text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Teléfono de Contacto
                </label>
                <input
                  type="text"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="+34 600 000 000"
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Email de Facturación
                </label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="cliente@ejemplo.es"
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-zinc-300 font-semibold mb-1">
                  Dirección Fiscal del Cliente
                </label>
                <input
                  type="text"
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  placeholder="Ej: Calle Industria 45, Aranda de Duero, Burgos"
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Financial Details & Status */}
          <div className="space-y-3">
            <span className="font-bold text-emerald-400 uppercase text-[11px] tracking-wider block flex items-center gap-1.5 border-b border-[#30363d] pb-1.5">
              <CreditCard className="w-3.5 h-3.5" /> Importes y Estado
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Importe Total (€ con IVA) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={totalAmount}
                  onChange={(e) => handleTotalChange(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white font-mono font-bold text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Fianza Anticipo (10%) (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-amber-300 font-mono font-bold text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Estado del Contrato
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ContractStatus)}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="draft">Borrador</option>
                  <option value="sent">Enviado (Pendiente 10%)</option>
                  <option value="deposit_paid">10% Abonado (Bloqueado)</option>
                  <option value="signed">Firmado y Liquidado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Notes */}
          <div className="space-y-1.5">
            <label className="block text-zinc-300 font-semibold">
              <FileText className="w-3.5 h-3.5 inline mr-1 text-zinc-400" />
              Observaciones Internas o Condiciones Específicas
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instrucciones especiales de montaje, contacto de producción en el recinto..."
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#30363d]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Guardando...' : 'Guardar Cambios'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
