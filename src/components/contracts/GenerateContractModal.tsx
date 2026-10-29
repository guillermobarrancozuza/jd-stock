import React, { useState } from 'react';
import {
  X,
  FileSignature,
  Calendar,
  User,
  MapPin,
  Plus,
  Trash2,
  Sparkles,
  Building,
  CreditCard,
  QrCode,
  Package,
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext.tsx';
import { Contract, ContractItem } from '../../types/inventory.ts';
import { DEFAULT_BANK_DETAILS, DEFAULT_CONTRACT_CLAUSES } from '../../lib/initialData.ts';

interface GenerateContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContractCreated: (contract: Contract) => void;
}

export const GenerateContractModal: React.FC<GenerateContractModalProps> = ({
  isOpen,
  onClose,
  onContractCreated,
}) => {
  const { events, eventItems, clients, items, generateContractFromEvent, saveContract } = useInventory();

  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [mode, setMode] = useState<'from_event' | 'custom'>('from_event');

  // Custom contract fields
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 16));
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 16));
  const [eventLocation, setEventLocation] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientTaxId, setClientTaxId] = useState('');
  const [notes, setNotes] = useState('');

  // Editable Payment Gateway & Bank Account details
  const [bankName, setBankName] = useState(DEFAULT_BANK_DETAILS.bankName);
  const [accountHolder, setAccountHolder] = useState(DEFAULT_BANK_DETAILS.accountHolder);
  const [iban, setIban] = useState(DEFAULT_BANK_DETAILS.iban);
  const [bic, setBic] = useState(DEFAULT_BANK_DETAILS.bic);
  const [bizumPhone, setBizumPhone] = useState(DEFAULT_BANK_DETAILS.bizumPhone);
  const [hasBizum, setHasBizum] = useState<boolean>(false);
  const [depositRate, setDepositRate] = useState<number>(10);
  const [paymentConcept, setPaymentConcept] = useState('');

  // Item lines for custom contract
  const [customLines, setCustomLines] = useState<
    { itemName: string; quantity: number; unitPrice: number; days: number }[]
  >([
    { itemName: 'Equipo de Sonido P.A. Principal', quantity: 1, unitPrice: 850, days: 1 },
    { itemName: 'Sistema de Iluminación y Focos Móviles', quantity: 1, unitPrice: 500, days: 1 },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Compute live totals for custom mode
  const customSubtotal = customLines.reduce(
    (acc, l) => acc + (l.quantity || 0) * (l.unitPrice || 0) * (l.days || 1),
    0
  );
  const customTax = Number(((customSubtotal * 21) / 100).toFixed(2));
  const customTotal = Number((customSubtotal + customTax).toFixed(2));
  const customDeposit = Number(((customTotal * depositRate) / 100).toFixed(2));
  const customRemaining = Number((customTotal - customDeposit).toFixed(2));

  const handleAddLine = () => {
    setCustomLines([
      ...customLines,
      { itemName: 'Servicio / Equipo Audiovisual', quantity: 1, unitPrice: 150, days: 1 },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (customLines.length <= 1) return;
    setCustomLines(customLines.filter((_, i) => i !== index));
  };

  const handleLineChange = (
    index: number,
    field: 'itemName' | 'quantity' | 'unitPrice' | 'days',
    value: string | number
  ) => {
    const updated = [...customLines];
    // @ts-expect-error dynamic key assignment
    updated[index][field] = value;
    setCustomLines(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      setIsSubmitting(true);

      if (mode === 'from_event') {
        if (!selectedEventId) {
          setError('Por favor selecciona un evento existente para generar el contrato.');
          return;
        }

        const generated = await generateContractFromEvent(selectedEventId);
        // Apply custom bank details and deposit rate
        const updated = await saveContract({
          ...generated,
          depositRate,
          bankDetails: {
            bankName: bankName || generated.bankDetails.bankName,
            accountHolder: accountHolder || generated.bankDetails.accountHolder,
            iban: iban || generated.bankDetails.iban,
            bic: bic || generated.bankDetails.bic,
            bizumPhone: bizumPhone || generated.bankDetails.bizumPhone,
            hasBizum,
            paymentConcept: paymentConcept || generated.bankDetails.paymentConcept,
          },
        });
        onContractCreated(updated);
        onClose();
      } else {
        // Custom creation
        if (!eventName.trim() || !clientName.trim()) {
          setError('Debes especificar al menos el nombre del evento y del cliente.');
          return;
        }

        const contractItems: ContractItem[] = customLines.map((l, idx) => ({
          id: `ci-${Date.now()}-${idx}`,
          itemName: l.itemName,
          quantity: Number(l.quantity) || 1,
          unitPrice: Number(l.unitPrice) || 0,
          days: Number(l.days) || 1,
          totalPrice: (Number(l.quantity) || 1) * (Number(l.unitPrice) || 0) * (Number(l.days) || 1),
        }));

        const newContract = await saveContract({
          eventName,
          eventDate,
          returnDate: returnDate || eventDate,
          eventLocation,
          clientName,
          clientEmail,
          clientPhone,
          clientTaxId,
          items: contractItems,
          subtotal: customSubtotal,
          taxRate: 21,
          taxAmount: customTax,
          totalAmount: customTotal,
          depositRate,
          depositAmount: customDeposit,
          remainingAmount: customRemaining,
          status: 'draft',
          paymentMethod: 'bank_transfer',
          notes,
          clauses: DEFAULT_CONTRACT_CLAUSES,
          bankDetails: {
            bankName,
            accountHolder,
            iban,
            bic,
            bizumPhone,
            hasBizum,
            paymentConcept: paymentConcept || `RESERVA ${eventName.slice(0, 15).toUpperCase().trim()}`,
          },
        });

        onContractCreated(newContract);
        onClose();
      }
    } catch (err: unknown) {
      console.error(err);
      setError((err as Error).message || 'Error al generar el contrato.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-[#161b22] border border-[#30363d] w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-[#30363d] flex items-center justify-between bg-linear-to-r from-[#161b22] to-[#1c2128]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <FileSignature className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Generar Contrato y Reserva de Fecha (10%)</h2>
              <p className="text-xs text-zinc-400">
                Calcula automáticamente la señal del 10% para bloquear la fecha en el calendario
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-[#30363d] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection: From Event vs Custom */}
        <div className="px-6 pt-4 flex gap-2 border-b border-[#30363d] bg-[#0d1117]/50">
          <button
            type="button"
            onClick={() => setMode('from_event')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              mode === 'from_event'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generar Automático desde Evento Existente</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('custom')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              mode === 'custom'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>Contrato a Medida / Personalizado</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300">
              {error}
            </div>
          )}

          {mode === 'from_event' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Selecciona el Evento Registrado:
                </label>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Elige un evento --</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.code} - {ev.name} ({ev.clientName}) • {new Date(ev.eventDate).toLocaleDateString('es-ES')}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-zinc-500 mt-1">
                  El sistema recopilará automáticamente los datos del cliente, fechas, y los equipos audiovisuales asignados con sus precios de alquiler.
                </p>
              </div>

              {selectedEventId && (() => {
                const ev = events.find((e) => e.id === selectedEventId);
                const assigned = eventItems.filter((ei) => ei.eventId === selectedEventId);
                return (
                  <div className="p-4 rounded-xl bg-[#0d1117] border border-[#30363d] space-y-3">
                    <div className="flex items-center justify-between border-b border-[#30363d] pb-2">
                      <div>
                        <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">
                          Detalles de la Reserva del Evento
                        </span>
                        <h4 className="text-xs font-bold text-white">{ev?.name}</h4>
                      </div>
                      <span className="text-[11px] font-mono font-semibold text-zinc-300">
                        {ev?.code}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div className="flex items-center gap-2 text-zinc-300">
                        <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <div>
                          <span className="text-[10px] text-zinc-500 block">Fecha y Duración:</span>
                          <strong>
                            {ev?.eventDate ? new Date(ev.eventDate).toLocaleDateString('es-ES') : ''}
                            {ev?.returnDate && ev.returnDate !== ev.eventDate
                              ? ` al ${new Date(ev.returnDate).toLocaleDateString('es-ES')}`
                              : ''}
                          </strong>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-zinc-300">
                        <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <div className="truncate">
                          <span className="text-[10px] text-zinc-500 block">Recinto / Ubicación:</span>
                          <strong className="truncate block">{ev?.location || 'Pendiente'}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Equipment list */}
                    <div className="pt-2 border-t border-[#30363d]">
                      <span className="font-semibold text-zinc-300 text-[11px] flex items-center gap-1.5 mb-2">
                        <Package className="w-3.5 h-3.5 text-amber-400" />
                        Equipos asignados para reservar ({assigned.length}):
                      </span>
                      {assigned.length > 0 ? (
                        <div className="max-h-36 overflow-y-auto space-y-1 bg-[#161b22] p-2 rounded-lg border border-[#30363d]">
                          {assigned.map((ei) => (
                            <div key={ei.id} className="flex items-center justify-between text-[11px] py-0.5">
                              <span className="text-zinc-200">
                                <strong className="text-amber-400 font-mono">{ei.quantityRequested}x</strong> {ei.itemName}
                              </span>
                              <span className="text-[10px] text-zinc-500 font-mono">Ref: {ei.itemCode}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-zinc-400 italic bg-[#161b22] p-2 rounded-lg border border-[#30363d]">
                          No se han asignado equipos específicos aún en este evento. Se incluirá partida técnica estándar para el contrato.
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-[#30363d] text-zinc-400 text-[11px] space-y-1">
                      <div className="flex items-center justify-between">
                        <span>Anticipo de Reserva:</span>
                        <strong className="text-amber-400 font-bold">10% del total para bloquear fecha</strong>
                      </div>
                      <p className="text-[10px] text-zinc-500">
                        Al generar el contrato, todos los datos y la reserva de material se compilarán en formato limpio sin caracteres erróneos para WhatsApp, Correo y QR SEPA.
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Event Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Nombre del Evento *</label>
                  <input
                    type="text"
                    required
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    placeholder="Ej. Concierto Acústico Primavera"
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Fecha Inicio / Montaje *</label>
                  <input
                    type="datetime-local"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Fecha Fin / Desmontaje *</label>
                  <input
                    type="datetime-local"
                    required
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Ubicación / Sala / Recinto</label>
                <input
                  type="text"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  placeholder="Ej. Auditorio Municipal, Madrid"
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Client Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#30363d]">
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Nombre Cliente / Empresa *</label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Ej. Producciones Musicales S.L."
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">CIF / NIF</label>
                  <input
                    type="text"
                    value={clientTaxId}
                    onChange={(e) => setClientTaxId(e.target.value)}
                    placeholder="Ej. B-12345678"
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Teléfono / WhatsApp *</label>
                  <input
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="Ej. +34 600 000 000"
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Correo Electrónico</label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="Ej. cliente@empresa.com"
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Items Breakdown */}
              <div className="pt-2 border-t border-[#30363d] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-300">Partidas y Equipamiento:</span>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Añadir Partida</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {customLines.map((line, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-[#0d1117] p-2 rounded-lg border border-[#30363d]">
                      <input
                        type="text"
                        value={line.itemName}
                        onChange={(e) => handleLineChange(idx, 'itemName', e.target.value)}
                        placeholder="Descripción equipo o servicio"
                        className="flex-1 bg-transparent text-xs text-white focus:outline-none px-1"
                      />
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-zinc-500">Cant:</span>
                        <input
                          type="number"
                          min="1"
                          value={line.quantity}
                          onChange={(e) => handleLineChange(idx, 'quantity', parseInt(e.target.value, 10) || 1)}
                          className="w-12 bg-[#161b22] border border-[#30363d] rounded px-1.5 py-1 text-center text-xs text-white"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-zinc-500">€/Día:</span>
                        <input
                          type="number"
                          min="0"
                          value={line.unitPrice}
                          onChange={(e) => handleLineChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="w-16 bg-[#161b22] border border-[#30363d] rounded px-1.5 py-1 text-right text-xs text-white"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-zinc-500">Días:</span>
                        <input
                          type="number"
                          min="1"
                          value={line.days}
                          onChange={(e) => handleLineChange(idx, 'days', parseInt(e.target.value, 10) || 1)}
                          className="w-12 bg-[#161b22] border border-[#30363d] rounded px-1.5 py-1 text-center text-xs text-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(idx)}
                        className="text-zinc-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Real-time deposit calculation preview */}
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                  <div>
                    <span className="text-[10px] text-zinc-400 block">Subtotal:</span>
                    <span className="font-semibold text-white">{customSubtotal.toFixed(2)} €</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block">IVA 21%:</span>
                    <span className="font-semibold text-white">{customTax.toFixed(2)} €</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block">Total Contrato:</span>
                    <span className="font-bold text-white text-sm">{customTotal.toFixed(2)} €</span>
                  </div>
                  <div className="bg-amber-500/20 p-1.5 rounded-lg border border-amber-500/40">
                    <span className="text-[10px] font-bold text-amber-300 block">{depositRate}% RESERVA:</span>
                    <span className="font-black text-amber-300 text-sm">{customDeposit.toFixed(2)} €</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sección Pasarela de Pago & Datos Bancarios (Editable) */}
          <div className="p-4 rounded-xl bg-[#0d1117] border border-[#30363d] space-y-3 mt-2">
            <div className="flex items-center justify-between pb-2 border-b border-[#30363d]">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Pasarela de Pago & Datos Bancarios (Transferencia / Bizum)
                </h3>
              </div>
              <span className="text-[10px] text-cyan-400/90 font-mono bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40">
                Editable para el cliente
              </span>
            </div>

            <p className="text-[11px] text-zinc-400">
              Estos datos se usarán para generar la pasarela de pago directa, el código QR SEPA y el mensaje automático para WhatsApp/correo:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-zinc-400 mb-1 text-[11px] font-medium">Entidad Bancaria</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="CaixaBank / BBVA / Santander..."
                  className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 text-[11px] font-medium">Beneficiario / Razón Social</label>
                <input
                  type="text"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  placeholder="JD Control de Stock S.L."
                  className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 text-[11px] font-medium">IBAN Cuenta Bancaria</label>
                <input
                  type="text"
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                  placeholder="ES91 2100 0418 4502 0005 1234"
                  className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-zinc-400 text-[11px] font-medium">Bizum de Empresa</label>
                  <button
                    type="button"
                    onClick={() => setHasBizum(!hasBizum)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                      hasBizum
                        ? 'bg-emerald-500 text-black'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                    }`}
                  >
                    {hasBizum ? '✓ Bizum Activado' : 'Activar Bizum'}
                  </button>
                </div>
                {hasBizum ? (
                  <input
                    type="text"
                    value={bizumPhone}
                    onChange={(e) => setBizumPhone(e.target.value)}
                    placeholder="+34 650 123 456"
                    className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-2.5 py-1.5 text-xs text-emerald-300 font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                ) : (
                  <span className="block text-[10px] text-zinc-500 italic py-1">
                    Deshabilitado por defecto para este contrato. Pulsa "Activar Bizum" para incluirlo.
                  </span>
                )}
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 text-[11px] font-medium">Código BIC / SWIFT</label>
                <input
                  type="text"
                  value={bic}
                  onChange={(e) => setBic(e.target.value)}
                  placeholder="CAIXESBBXXX"
                  className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-amber-400 mb-1 text-[11px] font-bold">% de Señal para Reserva</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={depositRate}
                    onChange={(e) => setDepositRate(Math.max(1, parseInt(e.target.value, 10) || 10))}
                    className="w-20 bg-[#161b22] border border-amber-500/50 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 font-bold font-mono focus:outline-none focus:border-amber-400"
                  />
                  <span className="text-xs text-zinc-400 font-mono">% del total presupuestado</span>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-zinc-400 mb-1 text-[11px] font-medium">Concepto Sugerido para el Abono</label>
                <input
                  type="text"
                  value={paymentConcept}
                  onChange={(e) => setPaymentConcept(e.target.value)}
                  placeholder="Ej. RESERVA FESTIVAL SONIDO 2026"
                  className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#30363d]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold flex items-center gap-1.5 transition shadow-md shadow-amber-500/20"
            >
              <FileSignature className="w-4 h-4" />
              <span>{isSubmitting ? 'Generando...' : 'Generar Contrato y Reserva 10%'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
