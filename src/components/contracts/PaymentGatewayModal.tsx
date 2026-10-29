import React, { useEffect, useState } from 'react';
import {
  X,
  Copy,
  Check,
  QrCode,
  Building,
  CreditCard,
  MessageCircle,
  Mail,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  Edit2,
  Save,
  RotateCcw,
  Calendar,
  MapPin,
  Package,
  FileText,
  ChevronDown,
  ChevronUp,
  Printer,
  Smartphone,
  CheckSquare,
} from 'lucide-react';
import { Contract } from '../../types/inventory.ts';
import { useInventory } from '../../context/InventoryContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { buildSepaEpcPayload, generateQrDataUrl, composeWhatsAppContractMessage } from '../../lib/barcodeUtils.ts';

interface PaymentGatewayModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: Contract | null;
  onMarkPaid: (contractId: string, reference: string) => Promise<void>;
  onOpenPrintContract?: (contract: Contract) => void;
}

export const PaymentGatewayModal: React.FC<PaymentGatewayModalProps> = ({
  isOpen,
  onClose,
  contract,
  onMarkPaid,
  onOpenPrintContract,
}) => {
  const { saveContract, defaultBankDetails, updateDefaultBankDetails } = useInventory();
  const { isAdmin } = useAuth();

  const [epcQrUrl, setEpcQrUrl] = useState<string>('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Payment Mode: 10% Deposit or 100% Full Payment
  const [paymentType, setPaymentType] = useState<'deposit_10' | 'full_payment'>('deposit_10');

  // Editable fields state
  const [isEditing, setIsEditing] = useState(false);
  const [accountHolder, setAccountHolder] = useState('');
  const [iban, setIban] = useState('');
  const [bankName, setBankName] = useState('');
  const [paymentConcept, setPaymentConcept] = useState('');
  const [bizumPhone, setBizumPhone] = useState('');
  const [hasBizum, setHasBizum] = useState<boolean>(false);
  const [bic, setBic] = useState('');
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [isSavingChanges, setIsSavingChanges] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [showEquipment, setShowEquipment] = useState(true);
  const [showMessagePreview, setShowMessagePreview] = useState(false);

  useEffect(() => {
    if (contract && isOpen) {
      const initialHolder =
        contract.bankDetails?.accountHolder ||
        defaultBankDetails?.accountHolder ||
        'JD AUDIOVISUALES S.L.';
      const initialIban =
        contract.bankDetails?.iban ||
        defaultBankDetails?.iban ||
        'ES09 2100 8286 3302 0009 7660';
      const initialBank =
        contract.bankDetails?.bankName ||
        defaultBankDetails?.bankName ||
        'CAIXABANK';
      const initialBic =
        contract.bankDetails?.bic ||
        defaultBankDetails?.bic ||
        'CAIXESBBXXX';
      const initialBizumPhone =
        contract.bankDetails?.bizumPhone ||
        defaultBankDetails?.bizumPhone ||
        '+34 650 123 456';
      const initialHasBizum =
        contract.bankDetails?.hasBizum ??
        defaultBankDetails?.hasBizum ??
        false;

      setAccountHolder(initialHolder);
      setIban(initialIban);
      setBankName(initialBank);
      setBic(initialBic);
      setBizumPhone(initialBizumPhone);
      setHasBizum(initialHasBizum);
      setDepositAmount(contract.depositAmount || Number((contract.totalAmount * 0.1).toFixed(2)));
      setPaymentType(contract.paymentType || 'deposit_10');
      setIsEditing(false);
      setSaveSuccessMessage(null);
      setPaymentRef(`TRF-${Date.now().toString().slice(-6)}`);
    }
  }, [contract, defaultBankDetails, isOpen]);

  // Dynamic active payment amount and concept calculation
  const activeAmount =
    paymentType === 'full_payment'
      ? contract?.totalAmount || 0
      : Number(depositAmount) || contract?.depositAmount || 0;

  const defaultConcept =
    paymentType === 'full_payment'
      ? `PAGO TOTAL ${contract?.code || ''} ${(contract?.eventName || '').slice(0, 18)}`
      : `RESERVA ${contract?.code || ''} ${(contract?.eventName || '').slice(0, 20)}`;

  useEffect(() => {
    if (contract && isOpen) {
      setPaymentConcept(defaultConcept);
    }
  }, [paymentType, contract?.code, contract?.eventName, isOpen]);

  // Re-generate SEPA EPC QR code when amount, concept, iban or holder changes
  useEffect(() => {
    if (!contract || !isOpen || !iban || activeAmount <= 0) return;

    const epcPayload = buildSepaEpcPayload({
      bic: bic || 'CAIXESBBXXX',
      recipientName: accountHolder || 'JD AUDIOVISUALES S.L.',
      iban: iban.trim(),
      amount: activeAmount,
      remittanceText: paymentConcept || defaultConcept,
    });

    generateQrDataUrl(epcPayload).then((url) => {
      setEpcQrUrl(url);
    });
  }, [activeAmount, paymentConcept, iban, accountHolder, bic, defaultConcept, contract, isOpen]);

  if (!isOpen || !contract) return null;

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSaveChanges = async () => {
    try {
      setIsSavingChanges(true);

      const parsedDeposit = Number(depositAmount) || contract.depositAmount;
      const updatedRemaining = Number((contract.totalAmount - parsedDeposit).toFixed(2));

      const updatedBankDetails = {
        ...contract.bankDetails,
        accountHolder: accountHolder.trim() || 'JD AUDIOVISUALES S.L.',
        iban: iban.trim() || 'ES09 2100 8286 3302 0009 7660',
        bankName: bankName.trim() || 'CAIXABANK',
        paymentConcept: paymentConcept.trim() || defaultConcept,
        bizumPhone: bizumPhone.trim() || '+34 650 123 456',
        hasBizum,
        bic: bic.trim() || 'CAIXESBBXXX',
      };

      const updatedContract: Contract = {
        ...contract,
        paymentType,
        depositAmount: parsedDeposit,
        remainingAmount: updatedRemaining,
        bankDetails: updatedBankDetails,
        updatedAt: new Date().toISOString(),
      };

      // 1. Save in contract
      await saveContract(updatedContract);

      // 2. Persist default bank details in company configuration across the entire app
      updateDefaultBankDetails(updatedBankDetails);

      setIsEditing(false);
      setSaveSuccessMessage('✓ Datos bancarios y beneficiario guardados y recordados de forma permanente.');
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (err: unknown) {
      alert((err as Error).message || 'Error al guardar los datos');
    } finally {
      setIsSavingChanges(false);
    }
  };

  const handleCancelEditing = () => {
    setAccountHolder(contract.bankDetails?.accountHolder || defaultBankDetails?.accountHolder || 'JD AUDIOVISUALES S.L.');
    setIban(contract.bankDetails?.iban || defaultBankDetails?.iban || 'ES09 2100 8286 3302 0009 7660');
    setBankName(contract.bankDetails?.bankName || defaultBankDetails?.bankName || 'CAIXABANK');
    setPaymentConcept(defaultConcept);
    setBizumPhone(contract.bankDetails?.bizumPhone || defaultBankDetails?.bizumPhone || '+34 650 123 456');
    setHasBizum(contract.bankDetails?.hasBizum ?? defaultBankDetails?.hasBizum ?? false);
    setBic(contract.bankDetails?.bic || defaultBankDetails?.bic || 'CAIXESBBXXX');
    setDepositAmount(contract.depositAmount);
    setIsEditing(false);
  };

  const handleConfirmPayment = async () => {
    try {
      setIsSubmitting(true);
      await onMarkPaid(contract.id, paymentRef || `TRF-DIR-${Date.now().toString().slice(-5)}`);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentMessageData = {
    ...contract,
    paymentType,
    depositAmount,
    bankDetails: {
      accountHolder,
      iban,
      bankName,
      paymentConcept,
      bizumPhone,
      hasBizum,
      bic,
    },
  };

  const handleOpenWhatsApp = () => {
    const text = composeWhatsAppContractMessage(currentMessageData);
    const cleanPhone = contract.clientPhone.replace(/[^0-9]/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleOpenEmail = () => {
    const text = composeWhatsAppContractMessage(currentMessageData);
    const subject =
      paymentType === 'full_payment'
        ? `Factura y Pago Total 100% - Contrato ${contract.code} - ${contract.eventName}`
        : `Reserva de Fecha 10% - Contrato ${contract.code} - ${contract.eventName}`;
    const url = `mailto:${contract.clientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleCopyFullMessage = async () => {
    const text = composeWhatsAppContractMessage(currentMessageData);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField('fullMessage');
      setTimeout(() => setCopiedField(null), 2500);
    } catch {
      // Fallback
    }
  };

  const isDepositPaid = contract.status === 'deposit_paid' || contract.status === 'signed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-[#161b22] border border-[#30363d] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-[#30363d] flex items-center justify-between bg-linear-to-r from-[#161b22] to-[#1c2128]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Pasarela de Transferencia Bancaria Directa</h2>
                <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded">
                  {contract.code}
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Gestión de cobro para JD AUDIOVISUALES S.L. • CaixaBank
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-[#30363d] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Notification banner if saved */}
          {saveSuccessMessage && (
            <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-2 text-xs font-semibold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{saveSuccessMessage}</span>
            </div>
          )}

          {/* Payment Type Selector: 10% Deposit VS 100% Full Payment */}
          <div className="bg-[#0d1117] p-2 rounded-xl border border-[#30363d] space-y-2">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block px-1">
              Modalidad de Cobro con Pasarela SEPA:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentType('deposit_10')}
                className={`py-2.5 px-3 rounded-lg text-xs font-bold transition flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
                  paymentType === 'deposit_10'
                    ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/25 ring-2 ring-cyan-400'
                    : 'bg-[#161b22] text-zinc-300 border border-[#30363d] hover:border-zinc-500'
                }`}
              >
                <span>Anticipo 10% Reserva</span>
                <span className={`font-mono text-[11px] ${paymentType === 'deposit_10' ? 'font-black' : 'text-cyan-400'}`}>
                  ({depositAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €)
                </span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentType('full_payment')}
                className={`py-2.5 px-3 rounded-lg text-xs font-bold transition flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
                  paymentType === 'full_payment'
                    ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/25 ring-2 ring-emerald-400'
                    : 'bg-[#161b22] text-zinc-300 border border-[#30363d] hover:border-zinc-500'
                }`}
              >
                <span>Pago Total Íntegro 100%</span>
                <span className={`font-mono text-[11px] ${paymentType === 'full_payment' ? 'font-black' : 'text-emerald-400'}`}>
                  ({contract.totalAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €)
                </span>
              </button>
            </div>
          </div>

          {/* Status Alert Banner */}
          {isDepositPaid ? (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3 text-emerald-300">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-sm block text-emerald-200">
                  ¡Abono Registrado y Fecha Bloqueada!
                </span>
                <span className="text-xs text-emerald-300/90 block mt-0.5">
                  Abonado el{' '}
                  {contract.depositPaidAt
                    ? new Date(contract.depositPaidAt).toLocaleString('es-ES')
                    : 'recientemente'}{' '}
                  • Ref: {contract.depositReference || 'Transferencia directa'}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-300">
              <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-sm block text-amber-200">
                  {paymentType === 'full_payment'
                    ? 'Cobro del Pago Total del 100%'
                    : 'Pendiente de recibir transferencia de reserva (10%)'}
                </span>
                <span className="text-xs text-amber-300/90 block mt-0.5">
                  Importe activo:{' '}
                  <strong className="text-white font-extrabold underline">
                    {activeAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                  </strong>{' '}
                  para el evento ({new Date(contract.eventDate).toLocaleDateString('es-ES')}).
                </span>
              </div>
            </div>
          )}

          {/* Event Details & Equipment Reservation Card */}
          <div className="p-4 rounded-xl bg-[#0d1117] border border-[#30363d] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#30363d] pb-2.5">
              <div>
                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">
                  Evento y Reserva Asignada
                </span>
                <h3 className="text-sm font-bold text-white flex items-center gap-2 mt-0.5">
                  <span>{contract.eventName}</span>
                  <span className="text-[11px] font-mono text-zinc-400 font-normal">({contract.code})</span>
                </h3>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-[10px] text-zinc-400 block font-medium">Cliente</span>
                <span className="text-xs font-semibold text-zinc-200">{contract.clientName}</span>
                {contract.clientPhone && (
                  <span className="text-[10px] text-zinc-400 block font-mono">{contract.clientPhone}</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2.5 text-zinc-300 bg-[#161b22] px-3 py-2 rounded-lg border border-[#30363d]/60">
                <Calendar className="w-4 h-4 text-cyan-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-zinc-400 block">Fecha Inicio / Montaje</span>
                  <strong className="text-white">
                    {new Date(contract.eventDate).toLocaleDateString('es-ES', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </strong>
                </div>
              </div>

              <div className="flex items-center gap-2.5 text-zinc-300 bg-[#161b22] px-3 py-2 rounded-lg border border-[#30363d]/60">
                <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
                <div className="truncate">
                  <span className="text-[10px] text-zinc-400 block">Lugar / Recinto</span>
                  <strong className="text-white truncate block">
                    {contract.eventLocation || 'Pendiente de definir'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Reserved Equipment List */}
            <div className="pt-1">
              <div
                onClick={() => setShowEquipment(!showEquipment)}
                className="flex items-center justify-between cursor-pointer py-1 text-zinc-300 hover:text-white"
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs">
                  <Package className="w-3.5 h-3.5 text-amber-400" />
                  <span>Reserva de Equipamiento Técnico ({contract.items?.length || 0} referencias)</span>
                </div>
                <button type="button" className="text-zinc-400 hover:text-zinc-200 text-xs flex items-center gap-1 cursor-pointer">
                  <span>{showEquipment ? 'Ocultar' : 'Ver detalle'}</span>
                  {showEquipment ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {showEquipment && (
                <div className="mt-2 border border-[#30363d] rounded-lg overflow-hidden bg-[#161b22]/70 divide-y divide-[#30363d]/60 max-h-44 overflow-y-auto">
                  {contract.items && contract.items.length > 0 ? (
                    contract.items.map((item, idx) => (
                      <div key={item.id || idx} className="p-2 sm:px-3 sm:py-1.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded text-[11px]">
                            {item.quantity}x
                          </span>
                          <span className="text-zinc-200 font-medium">{item.itemName}</span>
                          {item.days && item.days > 1 && (
                            <span className="text-[10px] text-zinc-400 font-mono">({item.days} días)</span>
                          )}
                        </div>
                        <span className="font-mono font-semibold text-zinc-300 text-xs">
                          {item.totalPrice.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-center text-zinc-500 text-xs">
                      No hay artículos específicos asignados en el desglose del contrato.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Amount Breakdown Card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-[#0d1117] border border-[#30363d]">
              <span className="text-[11px] text-zinc-400 block font-medium">Presupuesto Total (100%)</span>
              <span className="text-lg font-bold text-white mt-1 block">
                {contract.totalAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
              </span>
              <span className="text-[10px] text-zinc-500 block mt-0.5">IVA 21% incluido</span>
            </div>

            <div
              className={`p-3.5 rounded-xl border-2 relative overflow-hidden transition ${
                paymentType === 'deposit_10'
                  ? 'bg-linear-to-br from-cyan-950/40 to-blue-950/40 border-cyan-500/60 shadow-md'
                  : 'bg-[#0d1117] border-[#30363d] opacity-80'
              }`}
            >
              <div className="absolute top-0 right-0 bg-cyan-500 text-black font-black text-[9px] px-2 py-0.5 rounded-bl">
                10% RESERVA
              </div>
              <span className="text-[11px] text-cyan-300 block font-semibold">Anticipo Reserva</span>
              {isEditing ? (
                <div className="mt-1 flex items-center gap-1">
                  <input
                    type="number"
                    step="0.01"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#161b22] border border-cyan-400 rounded px-2 py-1 text-cyan-200 font-black text-lg"
                  />
                  <span className="text-cyan-300 font-bold">€</span>
                </div>
              ) : (
                <span className="text-xl font-black text-cyan-200 mt-1 block">
                  {depositAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                </span>
              )}
              <span className="text-[10px] text-cyan-400 block mt-0.5">Bloqueo de agenda y equipo</span>
            </div>

            <div
              className={`p-3.5 rounded-xl border-2 relative overflow-hidden transition ${
                paymentType === 'full_payment'
                  ? 'bg-linear-to-br from-emerald-950/40 to-green-950/40 border-emerald-500/60 shadow-md'
                  : 'bg-[#0d1117] border-[#30363d]'
              }`}
            >
              <div className="absolute top-0 right-0 bg-emerald-500 text-black font-black text-[9px] px-2 py-0.5 rounded-bl">
                PAGO TOTAL
              </div>
              <span className="text-[11px] text-zinc-400 block font-medium">
                {paymentType === 'full_payment' ? 'Abono Íntegro Activo' : 'Resto al Montaje'}
              </span>
              <span className="text-lg font-bold text-zinc-200 mt-1 block">
                {paymentType === 'full_payment'
                  ? `${contract.totalAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`
                  : `${Number((contract.totalAmount - depositAmount).toFixed(2)).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`}
              </span>
              <span className="text-[10px] text-zinc-500 block mt-0.5">Liquidación final</span>
            </div>
          </div>

          {/* Direct Bank Transfer Gateway Details */}
          <div className="bg-[#0d1117] rounded-xl border border-[#30363d] p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#30363d] pb-3">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-white text-xs uppercase tracking-wide">
                  Datos de Transferencia Bancaria Directa
                </span>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && !isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold transition cursor-pointer shadow-xs"
                    title="Editar Beneficiario, IBAN o Bizum"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Editar y Guardar Cambios</span>
                  </button>
                )}
                {isEditing && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleCancelEditing}
                      disabled={isSavingChanges}
                      className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-semibold transition cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveChanges}
                      disabled={isSavingChanges}
                      className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] font-bold transition cursor-pointer shadow-sm"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isSavingChanges ? 'Guardando...' : 'Guardar y Recordar'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Editing alert indicator */}
            {isEditing && (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px]">
                <span>✏️ <strong>Modo edición:</strong> Modifica el beneficiario, IBAN o Bizum. Al pulsar <strong>Guardar</strong> se actualizará el contrato y se guardará como cuenta predeterminada permanente de la empresa.</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Left Column: Bank Details */}
              <div className="space-y-3">
                {/* Beneficiary */}
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-400 uppercase tracking-wider block font-bold">
                      BENEFICIARIO
                    </span>
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Editar</span>
                      </button>
                    )}
                  </div>

                  {isEditing ? (
                    <input
                      type="text"
                      value={accountHolder}
                      onChange={(e) => setAccountHolder(e.target.value)}
                      placeholder="JD AUDIOVISUALES S.L."
                      className="w-full bg-[#161b22] border-2 border-amber-500 rounded-lg px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-amber-400 shadow-inner mt-1"
                    />
                  ) : (
                    <div
                      onClick={() => setIsEditing(true)}
                      className="flex items-center justify-between bg-[#161b22] border border-[#30363d] hover:border-amber-500/60 px-3 py-2 rounded-lg mt-1 cursor-pointer transition group"
                    >
                      <span className="font-semibold text-white truncate">{accountHolder}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(accountHolder, 'holder');
                        }}
                        className="text-zinc-400 hover:text-white p-1 rounded transition ml-2 shrink-0 cursor-pointer"
                        title="Copiar beneficiario"
                      >
                        {copiedField === 'holder' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}
                </div>

                {/* IBAN */}
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-400 uppercase tracking-wider block font-medium">
                      Número de Cuenta (IBAN)
                    </span>
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Editar</span>
                      </button>
                    )}
                  </div>

                  {isEditing ? (
                    <input
                      type="text"
                      value={iban}
                      onChange={(e) => setIban(e.target.value)}
                      placeholder="ES09 2100 8286 3302 0009 7660"
                      className="w-full bg-[#161b22] border-2 border-cyan-500 rounded-lg px-3 py-2 text-xs text-cyan-300 font-mono font-bold focus:outline-none focus:border-cyan-400 shadow-inner mt-1"
                    />
                  ) : (
                    <div
                      onClick={() => setIsEditing(true)}
                      className="flex items-center justify-between bg-[#161b22] border border-cyan-500/30 hover:border-cyan-400 px-3 py-2 rounded-lg mt-1 cursor-pointer transition group"
                    >
                      <span className="font-mono font-bold text-cyan-300 text-xs tracking-wider">
                        {iban}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(iban, 'iban');
                        }}
                        className="px-2 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-[10px] font-semibold flex items-center gap-1 transition ml-2 shrink-0 cursor-pointer"
                      >
                        {copiedField === 'iban' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedField === 'iban' ? 'Copiado' : 'Copiar'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Concept */}
                <div>
                  <span className="text-[10px] text-amber-400 uppercase tracking-wider block font-bold">
                    Concepto de Transferencia
                  </span>
                  {isEditing ? (
                    <input
                      type="text"
                      value={paymentConcept}
                      onChange={(e) => setPaymentConcept(e.target.value)}
                      className="w-full bg-[#161b22] border-2 border-amber-500 rounded-lg px-3 py-2 text-xs text-amber-300 font-mono font-bold focus:outline-none focus:border-amber-400 shadow-inner mt-1"
                    />
                  ) : (
                    <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 px-3 py-2 rounded-lg mt-1">
                      <span className="font-mono font-bold text-amber-300 text-xs truncate">
                        {paymentConcept}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(paymentConcept, 'concept')}
                        className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-semibold flex items-center gap-1 transition ml-2 shrink-0 cursor-pointer"
                      >
                        {copiedField === 'concept' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedField === 'concept' ? 'Copiado' : 'Copiar'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Bank Name */}
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider block font-medium">
                    Entidad Bancaria
                  </span>
                  {isEditing ? (
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="CAIXABANK"
                      className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-2.5 py-1.5 text-xs text-white mt-1"
                    />
                  ) : (
                    <div className="bg-[#161b22] border border-[#30363d] px-2.5 py-2 rounded-lg mt-1 text-zinc-300 font-medium">
                      {bankName} (BIC: {bic})
                    </div>
                  )}
                </div>

                {/* BIZUM Toggle: Poner o Quitar Bizum según si la empresa puede tenerlo */}
                <div className="p-3 rounded-xl bg-[#161b22] border border-[#30363d] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Smartphone className={`w-4 h-4 ${hasBizum ? 'text-emerald-400' : 'text-zinc-500'}`} />
                      <span className="font-semibold text-xs text-white">Bizum Profesional</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const nextVal = !hasBizum;
                        setHasBizum(nextVal);
                        updateDefaultBankDetails({ hasBizum: nextVal });
                      }}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                        hasBizum
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                          : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700'
                      }`}
                    >
                      {hasBizum ? 'Activado (Empresa dispone de Bizum)' : 'Desactivado (Empresa no tiene Bizum)'}
                    </button>
                  </div>

                  {hasBizum ? (
                    <div>
                      {isEditing ? (
                        <input
                          type="text"
                          value={bizumPhone}
                          onChange={(e) => setBizumPhone(e.target.value)}
                          placeholder="+34 650 123 456"
                          className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono mt-1"
                        />
                      ) : (
                        <div className="flex items-center justify-between bg-[#0d1117] border border-emerald-500/20 px-2.5 py-1.5 rounded-lg mt-1">
                          <span className="font-semibold text-emerald-300 font-mono">{bizumPhone}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(bizumPhone, 'bizum')}
                            className="text-zinc-400 hover:text-white transition ml-1 cursor-pointer"
                          >
                            {copiedField === 'bizum' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-[10px] text-zinc-500 block italic">
                      Bizum desactivado para esta empresa. No aparecerá en WhatsApp ni en el albarán.
                    </span>
                  )}
                </div>
              </div>

              {/* Right Column: SEPA EPC QR Code */}
              <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-white text-black text-center shadow-inner">
                <span className="font-bold text-[11px] text-zinc-900 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <QrCode className="w-4 h-4 text-cyan-600" /> Escanear con App Bancaria
                </span>
                <span className="text-[9px] text-zinc-600 mb-2 max-w-[210px] leading-tight">
                  Código QR EPC Oficial SEPA para CaixaBank, Santander, BBVA, ING y banca digital
                </span>

                {epcQrUrl ? (
                  <img
                    src={epcQrUrl}
                    alt="Código QR EPC SEPA Transferencia"
                    className="w-36 h-36 object-contain border border-zinc-300 rounded p-1 bg-white"
                  />
                ) : (
                  <div className="w-36 h-36 bg-zinc-200 animate-pulse rounded flex items-center justify-center text-zinc-500 text-[10px]">
                    Cargando QR SEPA...
                  </div>
                )}

                <div className="mt-2 text-[11px] font-mono font-bold bg-zinc-100 text-zinc-900 px-2.5 py-1 rounded border border-zinc-300">
                  {paymentType === 'full_payment' ? 'Pago 100%:' : 'Anticipo 10%:'}{' '}
                  {activeAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                </div>
              </div>
            </div>
          </div>

          {/* Client Notification Actions (WhatsApp, Email & Copy) */}
          <div className="p-4 rounded-xl bg-[#0d1117] border border-[#30363d] space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-xs block">
                Enviar datos de pago ({paymentType === 'full_payment' ? 'Pago 100%' : 'Anticipo 10%'}) al cliente ({contract.clientName}):
              </span>
              <button
                type="button"
                onClick={() => setShowMessagePreview(!showMessagePreview)}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold transition cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{showMessagePreview ? 'Ocultar vista previa' : 'Ver mensaje completo'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={handleCopyFullMessage}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-semibold transition cursor-pointer text-xs"
              >
                {copiedField === 'fullMessage' ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">¡Texto Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-zinc-300" />
                    <span>Copiar Texto Completo</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleOpenWhatsApp}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[#25D366] border border-[#25D366]/40 font-semibold transition cursor-pointer text-xs"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Enviar por WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={handleOpenEmail}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/40 font-semibold transition cursor-pointer text-xs"
              >
                <Mail className="w-4 h-4" />
                <span>Enviar por Correo</span>
              </button>
            </div>

            {onOpenPrintContract && (
              <div className="pt-2 border-t border-[#30363d]/80 flex justify-end">
                <button
                  type="button"
                  onClick={() => onOpenPrintContract(contract)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition cursor-pointer"
                  title="Abrir contrato formal con logotipo de JD para imprimir o exportar"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Exportar / Imprimir Factura y Contrato con Logo JD</span>
                </button>
              </div>
            )}

            {/* Collapsible Message Preview */}
            {showMessagePreview && (
              <div className="mt-3 p-3 rounded-lg bg-[#161b22] border border-[#30363d] text-[11px] font-mono text-zinc-300 space-y-2">
                <div className="flex items-center justify-between text-zinc-400 border-b border-[#30363d] pb-1.5 text-[10px]">
                  <span>VISTA PREVIA DEL MENSAJE OFICIAL (Limpio y formateado)</span>
                  <button
                    type="button"
                    onClick={handleCopyFullMessage}
                    className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" /> Copiar
                  </button>
                </div>
                <pre className="whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto text-zinc-300">
                  {composeWhatsAppContractMessage(currentMessageData)}
                </pre>
              </div>
            )}
          </div>

          {/* Admin Validation Section (Mark Paid) */}
          {!isDepositPaid && (
            <div className="p-4 rounded-xl bg-linear-to-r from-emerald-950/30 to-cyan-950/30 border border-emerald-500/30 space-y-3">
              <span className="font-bold text-emerald-300 text-xs block flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                Confirmación de Cobro (Espacio Administrador)
              </span>
              <p className="text-[11px] text-zinc-400">
                Al confirmar la recepción de la transferencia ({paymentType === 'full_payment' ? 'Pago Total 100%' : '10% de Reserva'}), la fecha del evento quedará confirmada y el material bloqueado en el inventario.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-2">
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="Referencia de transferencia (ej. TRF-CXB-9812)"
                  className="w-full sm:flex-1 bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={handleConfirmPayment}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs flex items-center justify-center gap-1.5 transition shrink-0 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmitting ? 'Guardando...' : `Validar ${paymentType === 'full_payment' ? 'Pago 100%' : '10%'} y Bloquear Fecha`}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#30363d] bg-[#161b22] flex items-center justify-between text-xs">
          <span className="text-zinc-500">JD AUDIOVISUALES S.L. • CaixaBank ES09 2100 8286 3302 0009 7660</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
