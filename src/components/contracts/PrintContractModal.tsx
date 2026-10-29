import React, { useEffect, useState } from 'react';
import { X, Printer, Download, CreditCard, ShieldCheck, Edit3, Save, Plus, Trash2, Smartphone } from 'lucide-react';
import { Contract, CompanyFiscalConfig } from '../../types/inventory.ts';
import { buildSepaEpcPayload, generateQrDataUrl } from '../../lib/barcodeUtils.ts';
import { useInventory } from '../../context/InventoryContext.tsx';

interface PrintContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: Contract | null;
}

export const PrintContractModal: React.FC<PrintContractModalProps> = ({
  isOpen,
  onClose,
  contract,
}) => {
  const {
    companyFiscalConfig,
    updateCompanyFiscalConfig,
    defaultBankDetails,
    updateDefaultBankDetails,
    saveContract,
  } = useInventory();
  const [epcQrUrl, setEpcQrUrl] = useState<string>('');

  // Editing company fiscal data, bank details & contractual clauses
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [cif, setCif] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [bankName, setBankName] = useState('');
  const [iban, setIban] = useState('');
  const [hasBizum, setHasBizum] = useState<boolean>(false);
  const [bizumPhone, setBizumPhone] = useState<string>('');
  const [terms, setTerms] = useState<string[]>([]);
  const [newTerm, setNewTerm] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (companyFiscalConfig) {
      setCif(companyFiscalConfig.cif);
      setCompanyName(companyFiscalConfig.companyName);
      setTradeName(companyFiscalConfig.tradeName);
      setAddress(companyFiscalConfig.address);
      setPhone(companyFiscalConfig.phone);
      setEmail(companyFiscalConfig.email);
      setTerms(companyFiscalConfig.termsAndConditions || []);
    }
    if (contract) {
      setAccountHolder(contract.bankDetails.accountHolder || defaultBankDetails?.accountHolder || 'JD AUDIOVISUALES S.L.');
      setBankName(contract.bankDetails.bankName || defaultBankDetails?.bankName || 'CaixaBank');
      setIban(contract.bankDetails.iban || defaultBankDetails?.iban || 'ES09 2100 8286 3302 0009 7660');
      setHasBizum(contract.bankDetails.hasBizum ?? defaultBankDetails?.hasBizum ?? false);
      setBizumPhone(contract.bankDetails.bizumPhone || defaultBankDetails?.bizumPhone || '+34 650 123 456');
      if (contract.clauses && contract.clauses.length > 0) {
        setTerms(contract.clauses);
      }
    }
  }, [companyFiscalConfig, defaultBankDetails, contract, isOpen]);

  useEffect(() => {
    if (contract && isOpen) {
      const epcPayload = buildSepaEpcPayload({
        bic: contract.bankDetails.bic,
        recipientName: contract.bankDetails.accountHolder,
        iban: contract.bankDetails.iban,
        amount: contract.paymentType === 'full_payment' ? contract.totalAmount : contract.depositAmount,
        remittanceText: contract.bankDetails.paymentConcept,
      });

      generateQrDataUrl(epcPayload).then((url) => {
        setEpcQrUrl(url);
      });
    }
  }, [contract, isOpen]);

  if (!isOpen || !contract) return null;

  const handleSaveCompanyConfig = async () => {
    // 1. Persist company fiscal config
    updateCompanyFiscalConfig({
      cif: cif.trim(),
      companyName: companyName.trim(),
      tradeName: tradeName.trim(),
      address: address.trim(),
      phone: phone.trim(),
      email: email.trim(),
      termsAndConditions: terms,
    });

    // 2. Persist bank details with Bizum setting
    updateDefaultBankDetails({
      accountHolder: accountHolder.trim(),
      bankName: bankName.trim(),
      iban: iban.trim(),
      hasBizum,
      bizumPhone: bizumPhone.trim(),
    });

    // 3. Update active contract document directly
    contract.bankDetails.accountHolder = accountHolder.trim();
    contract.bankDetails.bankName = bankName.trim();
    contract.bankDetails.iban = iban.trim();
    contract.bankDetails.hasBizum = hasBizum;
    contract.bankDetails.bizumPhone = bizumPhone.trim();
    contract.clauses = terms;

    // 4. Save contract in storage/state
    await saveContract(contract);

    // 5. Refresh QR code
    const epcPayload = buildSepaEpcPayload({
      bic: contract.bankDetails.bic,
      recipientName: contract.bankDetails.accountHolder,
      iban: contract.bankDetails.iban,
      amount: contract.paymentType === 'full_payment' ? contract.totalAmount : contract.depositAmount,
      remittanceText: contract.bankDetails.paymentConcept,
    });
    const url = await generateQrDataUrl(epcPayload);
    setEpcQrUrl(url);

    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      setIsEditingConfig(false);
    }, 900);
  };

  const handleAddTerm = () => {
    if (!newTerm.trim()) return;
    setTerms((prev) => [...prev, newTerm.trim()]);
    setNewTerm('');
  };

  const handleRemoveTerm = (index: number) => {
    setTerms((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handlePrint = () => {
    try {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        const fullHtml = generateContractHtml(contract, companyFiscalConfig, epcQrUrl);
        printWindow.document.open();
        printWindow.document.write(fullHtml);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 500);
        return;
      }
    } catch {
      // Fallback
    }
    window.print();
  };

  const handleExportHtml = () => {
    if (!contract) return;
    const fullHtml = generateContractHtml(contract, companyFiscalConfig, epcQrUrl);
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${contract.code}_Factura_Contrato_JD_Audiovisuales.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-xs">
      <div className="bg-[#161b22] border border-[#30363d] w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[96vh]">
        {/* Controls Bar (no-print) */}
        <div className="p-4 border-b border-[#30363d] flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-sm">Factura y Contrato Formal</span>
            <span className="text-xs font-mono font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded">
              {contract.code}
            </span>
            <span className="text-xs text-zinc-400 hidden sm:inline">
              • {companyFiscalConfig.tradeName}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditingConfig(!isEditingConfig)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-amber-500/30 font-semibold text-xs transition cursor-pointer"
              title="Modificar CIF, teléfono, correo y cláusulas contractuales"
            >
              <Edit3 className="w-4 h-4 text-amber-400" />
              <span>{isEditingConfig ? 'Cerrar Edición' : 'Editar CIF, Contacto y Cláusulas'}</span>
            </button>

            <button
              onClick={handleExportHtml}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-semibold text-xs transition cursor-pointer"
              title="Descargar archivo HTML del contrato con logotipo"
            >
              <Download className="w-4 h-4 text-cyan-400" />
              <span>Exportar</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition shadow-md cursor-pointer"
              title="Imprimir o guardar en PDF con logotipo transparente"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#30363d] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Inline Drawer for Editing Fiscal Data & Clauses */}
        {isEditingConfig && (
          <div className="p-4 bg-[#0d1117] border-b border-[#30363d] max-h-72 overflow-y-auto space-y-4 text-xs text-zinc-200 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-[#30363d] pb-2">
              <span className="font-bold text-amber-400 uppercase text-[11px] tracking-wider">
                Configuración Fiscal de Empresa y Cláusulas Contractuales
              </span>
              <button
                onClick={handleSaveCompanyConfig}
                className="flex items-center gap-1 px-3 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs cursor-pointer shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Guardar Cambios</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-zinc-400 block mb-0.5">Razón Social</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-[#161b22] border border-[#30363d] rounded p-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-400 block mb-0.5">Nombre Comercial</label>
                <input
                  type="text"
                  value={tradeName}
                  onChange={(e) => setTradeName(e.target.value)}
                  className="w-full bg-[#161b22] border border-[#30363d] rounded p-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-400 block mb-0.5">CIF / NIF</label>
                <input
                  type="text"
                  value={cif}
                  onChange={(e) => setCif(e.target.value)}
                  className="w-full bg-[#161b22] border border-[#30363d] rounded p-1.5 text-xs text-cyan-300 font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-400 block mb-0.5">Teléfono de Contacto</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-[#161b22] border border-[#30363d] rounded p-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-400 block mb-0.5">Correo Electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#161b22] border border-[#30363d] rounded p-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-400 block mb-0.5">Dirección / Almacén</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-[#161b22] border border-[#30363d] rounded p-1.5 text-xs text-white"
                />
              </div>
            </div>

            {/* Bank details for contracts and transfers */}
            <div className="pt-2 border-t border-[#30363d] space-y-2">
              <span className="text-[10px] font-bold uppercase text-amber-400 block">
                Datos Bancarios Oficiales (Transferencia Oficial)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-zinc-400 block mb-0.5">Beneficiario / Titular</label>
                  <input
                    type="text"
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                    className="w-full bg-[#161b22] border border-[#30363d] rounded p-1.5 text-xs text-white font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-400 block mb-0.5">Entidad Bancaria</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full bg-[#161b22] border border-[#30363d] rounded p-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-400 block mb-0.5">IBAN Oficial</label>
                  <input
                    type="text"
                    value={iban}
                    onChange={(e) => setIban(e.target.value)}
                    className="w-full bg-[#161b22] border border-[#30363d] rounded p-1.5 text-xs text-amber-300 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Bizum Toggle (Disabled by default, can be activated on demand) */}
              <div className="pt-2 border-t border-[#30363d] space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 rounded-lg bg-[#161b22] border border-[#30363d]">
                  <div className="flex items-center gap-2.5">
                    <Smartphone className={`w-4 h-4 ${hasBizum ? 'text-emerald-400' : 'text-zinc-500'}`} />
                    <div>
                      <span className="text-xs font-semibold text-white block">Bizum de Empresa</span>
                      <span className="text-[10px] text-zinc-400">
                        {hasBizum
                          ? 'Activado: Se incluirá en la factura, contrato y mensajes como opción de cobro alternativa'
                          : 'Deshabilitado (por defecto): Pulsa el botón para activarlo si la empresa puede recibir Bizum'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHasBizum(!hasBizum)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                      hasBizum
                        ? 'bg-emerald-500 text-black shadow-xs'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                    }`}
                  >
                    {hasBizum ? '✓ Bizum Activado' : 'Activar Bizum'}
                  </button>
                </div>

                {hasBizum && (
                  <div className="animate-in fade-in">
                    <label className="text-[10px] text-zinc-400 block mb-0.5">Teléfono Bizum Empresa</label>
                    <input
                      type="text"
                      value={bizumPhone}
                      onChange={(e) => setBizumPhone(e.target.value)}
                      placeholder="+34 650 123 456"
                      className="w-full bg-[#161b22] border border-[#30363d] rounded p-1.5 text-xs text-emerald-300 font-mono font-bold"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Contractual Clauses Editor */}
            <div className="space-y-2 pt-2 border-t border-[#30363d]">
              <span className="text-[10px] font-bold uppercase text-zinc-400 block">
                Cláusulas y Condiciones Generales ({terms.length})
              </span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {terms.map((term, idx) => (
                  <div key={idx} className="flex items-start gap-2 bg-[#161b22] p-2 rounded border border-[#30363d]">
                    <span className="text-[10px] text-amber-400 font-bold shrink-0">{idx + 1}.</span>
                    <input
                      type="text"
                      value={term}
                      onChange={(e) => {
                        const newTerms = [...terms];
                        newTerms[idx] = e.target.value;
                        setTerms(newTerms);
                      }}
                      className="w-full bg-transparent border-0 text-zinc-200 text-xs focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveTerm(idx)}
                      className="text-zinc-500 hover:text-red-400 p-0.5 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={newTerm}
                  onChange={(e) => setNewTerm(e.target.value)}
                  placeholder="Añadir nueva cláusula o condición..."
                  className="flex-1 bg-[#161b22] border border-[#30363d] rounded p-1.5 text-xs text-white"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTerm();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddTerm}
                  className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Añadir
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Contract Printable Sheet */}
        <div className="overflow-y-auto p-4 sm:p-8 bg-zinc-100 flex-1 print:p-0 print:bg-white text-zinc-900">
          <div className="max-w-3xl mx-auto bg-white p-6 sm:p-10 shadow-lg rounded-xl print:shadow-none print:p-4 print:max-w-none text-xs">
            {/* Header: Transparent Logo & Company Info */}
            <div className="flex items-start justify-between border-b-2 border-zinc-900 pb-5 mb-5">
              <div className="flex items-center gap-4">
                <div className="h-16 w-28 p-1 shrink-0 flex items-center justify-center">
                  <img
                    src="/assets/logo_transparent.png"
                    alt={companyFiscalConfig.tradeName}
                    className="h-14 w-auto object-contain max-w-full drop-shadow-xs"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/assets/logo_jd.png';
                    }}
                  />
                </div>
                <div>
                  <h1 className="text-xl font-black tracking-tight text-zinc-900 uppercase">
                    {companyFiscalConfig.companyName}
                  </h1>
                  <p className="text-[11px] text-zinc-600 font-semibold">
                    {companyFiscalConfig.tradeName} • Servicios de Sonido e Iluminación Profesional
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    CIF: <strong>{companyFiscalConfig.cif}</strong> • {companyFiscalConfig.address} • Tel: {companyFiscalConfig.phone}
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    Email: {companyFiscalConfig.email} • Web: {companyFiscalConfig.website}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-base font-black text-amber-600 font-mono tracking-tight">
                  {contract.code}
                </div>
                <div className="text-[10px] text-zinc-500 mt-1">
                  Fecha emisión: {new Date(contract.createdAt).toLocaleDateString('es-ES')}
                </div>
                <div className="mt-2 inline-block">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase border font-mono tracking-wide bg-zinc-100 text-zinc-800 border-zinc-300">
                    FACTURA Y CONTRATO
                  </span>
                </div>
              </div>
            </div>

            {/* Parties Grid (Empresa & Cliente) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="p-3.5 rounded-lg bg-zinc-50 border border-zinc-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                  PARTE ARRENDADORA / PRESTADORA
                </span>
                <span className="font-bold text-zinc-900 text-xs block">{companyFiscalConfig.companyName}</span>
                <span className="text-zinc-600 block text-[11px]">CIF: {companyFiscalConfig.cif}</span>
                <span className="text-zinc-600 block text-[11px]">{companyFiscalConfig.address}</span>
                <span className="text-zinc-600 block text-[11px]">Contacto: {companyFiscalConfig.phone} • {companyFiscalConfig.email}</span>
              </div>

              <div className="p-3.5 rounded-lg bg-zinc-50 border border-zinc-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                  PARTE ARRENDATARIA / CLIENTE
                </span>
                <span className="font-bold text-zinc-900 text-xs block">{contract.clientName}</span>
                <span className="text-zinc-600 block text-[11px]">NIF/CIF: {contract.clientTaxId || 'No especificado'}</span>
                <span className="text-zinc-600 block text-[11px]">Dirección: {contract.clientAddress || 'No especificada'}</span>
                <span className="text-zinc-600 block text-[11px]">
                  Contacto: {contract.clientPhone} • {contract.clientEmail}
                </span>
              </div>
            </div>

            {/* Event & Reservation Summary */}
            <div className="mb-6 p-3.5 rounded-lg bg-amber-50 border border-amber-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 block mb-1.5">
                DATOS DEL EVENTO Y RESERVA TÉCNICA
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                <div>
                  <span className="text-zinc-500 block text-[10px]">Nombre Evento:</span>
                  <strong className="text-zinc-900">{contract.eventName}</strong>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px]">Fecha del Evento:</span>
                  <strong className="text-zinc-900">
                    {new Date(contract.eventDate).toLocaleDateString('es-ES', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </strong>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px]">Ubicación / Recinto:</span>
                  <strong className="text-zinc-900">{contract.eventLocation}</strong>
                </div>
              </div>
            </div>

            {/* Equipment and Services Table */}
            <div className="mb-6">
              <h3 className="font-bold text-xs uppercase tracking-wider text-zinc-800 mb-2 border-b pb-1">
                EQUIPAMIENTO TÉCNICO Y PARTIDAS ASIGNADAS
              </h3>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-zinc-300 text-[10px] uppercase text-zinc-600">
                    <th className="py-1.5 font-bold">Concepto / Material</th>
                    <th className="py-1.5 text-center font-bold">Cant.</th>
                    <th className="py-1.5 text-center font-bold">Días</th>
                    <th className="py-1.5 text-right font-bold">Precio Unit.</th>
                    <th className="py-1.5 text-right font-bold">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 text-[11px]">
                  {contract.items.map((item, idx) => (
                    <tr key={item.id || idx}>
                      <td className="py-1.5">
                        <div className="font-semibold text-zinc-900">{item.itemName}</div>
                        {item.itemCode && (
                          <div className="text-[10px] text-zinc-500 font-mono">Ref: {item.itemCode}</div>
                        )}
                      </td>
                      <td className="py-1.5 text-center font-mono font-medium">{item.quantity}</td>
                      <td className="py-1.5 text-center font-mono">{item.days || 1}</td>
                      <td className="py-1.5 text-right font-mono">
                        {item.unitPrice.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                      </td>
                      <td className="py-1.5 text-right font-mono font-bold text-zinc-900">
                        {item.totalPrice.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals & Economic Summary */}
            <div className="flex justify-end mb-6">
              <div className="w-full sm:w-80 bg-zinc-50 border border-zinc-300 rounded-lg p-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-zinc-600">
                  <span>Base Imponible:</span>
                  <span className="font-mono">
                    {contract.subtotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                  </span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>IVA ({contract.taxRate}%):</span>
                  <span className="font-mono">
                    {contract.taxAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                  </span>
                </div>
                <div className="flex justify-between font-bold text-zinc-900 border-t border-zinc-200 pt-1.5 text-sm">
                  <span>TOTAL FACTURA:</span>
                  <span className="font-mono text-amber-700">
                    {contract.totalAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                  </span>
                </div>

                <div className="mt-2 pt-2 border-t-2 border-dashed border-amber-300 bg-amber-50/80 p-2 rounded">
                  <div className="flex justify-between text-amber-900 font-bold">
                    <span>
                      {contract.paymentType === 'full_payment'
                        ? 'PAGO TOTAL FACTURADO (100%):'
                        : `ANTICIPO ${contract.depositRate}% DE RESERVA:`}
                    </span>
                    <span className="font-mono text-sm underline">
                      {contract.paymentType === 'full_payment'
                        ? `${contract.totalAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`
                        : `${contract.depositAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-600 mt-0.5">
                    <span>Resto pendiente:</span>
                    <span className="font-mono">
                      {contract.paymentType === 'full_payment'
                        ? '0,00 € (Abonado íntegro)'
                        : `${contract.remainingAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bank Details & QR SEPA Box */}
            <div className="mb-6 p-4 rounded-lg bg-zinc-50 border border-zinc-300">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-[11px] flex-1">
                  <span className="font-bold text-xs uppercase tracking-wider text-zinc-900 block flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-cyan-600" />
                    CUENTA BANCARIA PARA TRANSFERENCIA DIRECTA
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] mt-2">
                    <div>
                      <span className="text-zinc-500 block">Beneficiario:</span>
                      <strong className="text-zinc-900">{contract.bankDetails.accountHolder}</strong>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Entidad Bancaria:</span>
                      <strong className="text-zinc-900">{contract.bankDetails.bankName}</strong>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">IBAN:</span>
                      <strong className="text-zinc-900 font-mono text-[11px]">{contract.bankDetails.iban}</strong>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Concepto de Transferencia:</span>
                      <strong className="text-amber-800 font-mono text-[11px]">{contract.bankDetails.paymentConcept}</strong>
                    </div>
                  </div>
                  {contract.bankDetails.hasBizum && contract.bankDetails.bizumPhone && (
                    <div className="mt-2 text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Bizum Empresa Habilitado: <strong className="font-mono text-zinc-900">{contract.bankDetails.bizumPhone}</strong></span>
                    </div>
                  )}
                </div>

                {/* QR SEPA */}
                {epcQrUrl && (
                  <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-white border border-zinc-300 shrink-0 text-center">
                    <img src={epcQrUrl} alt="QR Transferencia Bancaria" className="w-24 h-24 object-contain" />
                    <span className="text-[8px] font-bold text-zinc-700 mt-1 uppercase">QR Transferencia</span>
                  </div>
                )}
              </div>
            </div>

            {/* Legal Clauses */}
            <div className="mb-6 space-y-1.5 text-[9px] text-zinc-600 text-justify border-t pt-3">
              <span className="font-bold text-[10px] uppercase text-zinc-800 block mb-1">
                CONDICIONES CONTRACTUALES Y CLÁUSULAS
              </span>
              {(companyFiscalConfig.termsAndConditions || contract.clauses || []).map((clause, idx) => (
                <p key={idx} className="leading-relaxed">
                  {clause}
                </p>
              ))}
            </div>

            {/* Signature Blocks */}
            <div className="grid grid-cols-2 gap-8 pt-6 border-t-2 border-zinc-300">
              <div className="text-center">
                <span className="text-[10px] font-bold uppercase text-zinc-700 block mb-12">
                  POR LA EMPRESA ({companyFiscalConfig.companyName})
                </span>
                <div className="border-t border-zinc-400 pt-1 text-[10px] text-zinc-500">
                  Firma autorizada y sello
                </div>
              </div>

              <div className="text-center">
                <span className="text-[10px] font-bold uppercase text-zinc-700 block mb-12">
                  POR EL CLIENTE ({contract.clientName})
                </span>
                <div className="border-t border-zinc-400 pt-1 text-[10px] text-zinc-500">
                  Firma conforme y DNI
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function generateContractHtml(
  contract: Contract,
  fiscal: CompanyFiscalConfig,
  epcQrUrl?: string
): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const dateFormatted = new Date(contract.eventDate).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const itemsRows =
    contract.items && contract.items.length > 0
      ? contract.items
          .map(
            (item) => `
        <tr>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb;">
            <strong>${item.itemName}</strong>
            ${item.itemCode ? `<br><span style="font-family: monospace; font-size: 11px; color: #6b7280;">Ref: ${item.itemCode}</span>` : ''}
          </td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: bold;">${item.quantity}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.days || 1}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-family: monospace;">${item.unitPrice.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold; font-family: monospace;">${item.totalPrice.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
        </tr>`
          )
          .join('')
      : `<tr><td colspan="5" style="padding: 12px; text-align: center; color: #6b7280;">Partida técnica general audiovisual asignada.</td></tr>`;

  const clausesList =
    (fiscal.termsAndConditions || contract.clauses || [])
      .map((c) => `<p style="margin: 0 0 6px 0; line-height: 1.4;">${c}</p>`)
      .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Factura y Contrato ${contract.code} - ${fiscal.tradeName}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #111827;
      background-color: #ffffff;
      margin: 0;
      padding: 20px;
      font-size: 12px;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .contract-container {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
    }
    .header-table {
      width: 100%;
      border-bottom: 2px solid #111827;
      padding-bottom: 15px;
      margin-bottom: 15px;
    }
    .logo-img {
      height: 56px;
      width: auto;
      max-width: 130px;
      object-fit: contain;
      display: inline-block;
      margin-right: 15px;
      vertical-align: middle;
    }
    .info-grid {
      display: table;
      width: 100%;
      margin-bottom: 15px;
    }
    .info-col {
      display: table-cell;
      width: 50%;
      padding: 10px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
    }
    .info-col:first-child {
      border-right: none;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
      font-size: 11px;
    }
    .items-table th {
      background: #f3f4f6;
      padding: 8px 10px;
      border-bottom: 2px solid #d1d5db;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.05em;
    }
    .totals-box {
      float: right;
      width: 320px;
      background: #f9fafb;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 15px;
    }
    .bank-box {
      clear: both;
      background: #f9fafb;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 15px;
      display: table;
      width: 100%;
      box-sizing: border-box;
    }
    .bank-info {
      display: table-cell;
      vertical-align: top;
    }
    .bank-qr {
      display: table-cell;
      width: 110px;
      text-align: center;
      vertical-align: middle;
      padding-left: 15px;
    }
    .clauses-box {
      font-size: 9px;
      color: #4b5563;
      border-top: 1px solid #e5e7eb;
      padding-top: 10px;
      margin-bottom: 25px;
      text-align: justify;
    }
    .signatures-table {
      width: 100%;
      margin-top: 25px;
      border-top: 2px solid #e5e7eb;
      padding-top: 15px;
    }
    .signature-cell {
      width: 50%;
      text-align: center;
      padding: 10px 20px;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="contract-container">
    <table class="header-table">
      <tr>
        <td style="vertical-align: middle;">
          <div style="display: flex; align-items: center;">
            <img src="${origin}/assets/logo_transparent.png" alt="${fiscal.tradeName}" class="logo-img" onerror="this.src='${origin}/assets/logo_jd.png';">
            <div>
              <h1 style="margin: 0; font-size: 20px; font-weight: 900; letter-spacing: -0.02em; text-transform: uppercase;">
                ${fiscal.companyName}
              </h1>
              <div style="font-size: 11px; color: #4b5563; font-weight: 600; margin-top: 2px;">
                ${fiscal.tradeName} • Sonido e Iluminación Profesional
              </div>
              <div style="font-size: 10px; color: #6b7280; margin-top: 2px;">
                CIF: ${fiscal.cif} • ${fiscal.address} • Tel: ${fiscal.phone} • Email: ${fiscal.email}
              </div>
            </div>
          </div>
        </td>
        <td style="vertical-align: middle; text-align: right; width: 200px;">
          <div style="font-size: 16px; font-weight: 900; color: #d97706; font-family: monospace;">
            ${contract.code}
          </div>
          <div style="font-size: 10px; color: #6b7280; margin-top: 2px;">
            Emisión: ${new Date(contract.createdAt).toLocaleDateString('es-ES')}
          </div>
          <div style="margin-top: 6px;">
            <span style="font-size: 9px; font-weight: 800; background: #f3f4f6; border: 1px solid #d1d5db; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">
              FACTURA Y CONTRATO
            </span>
          </div>
        </td>
      </tr>
    </table>

    <div class="info-grid">
      <div class="info-col">
        <div style="font-size: 10px; font-weight: bold; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">
          PARTE ARRENDADORA
        </div>
        <strong>${fiscal.companyName}</strong><br>
        CIF: ${fiscal.cif}<br>
        ${fiscal.address}<br>
        Tel: ${fiscal.phone} • Email: ${fiscal.email}
      </div>
      <div class="info-col">
        <div style="font-size: 10px; font-weight: bold; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">
          PARTE ARRENDATARIA / CLIENTE
        </div>
        <strong>${contract.clientName}</strong><br>
        NIF/CIF: ${contract.clientTaxId || 'No indicado'}<br>
        ${contract.clientAddress || 'Dirección no indicada'}<br>
        Contacto: ${contract.clientPhone} • ${contract.clientEmail}
      </div>
    </div>

    <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 10px; margin-bottom: 15px; font-size: 11px;">
      <strong style="color: #92400e;">EVENTO: ${contract.eventName}</strong><br>
      Fecha: <strong>${dateFormatted}</strong> • Lugar: <strong>${contract.eventLocation}</strong>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th>Concepto / Material</th>
          <th style="text-align: center;">Cant.</th>
          <th style="text-align: center;">Días</th>
          <th style="text-align: right;">Precio Unit.</th>
          <th style="text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <div class="totals-box">
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #4b5563;">
        <span>Base Imponible:</span>
        <span style="font-family: monospace;">${contract.subtotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #4b5563;">
        <span>IVA (${contract.taxRate}%):</span>
        <span style="font-family: monospace;">${contract.taxAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 13px; border-top: 1px solid #d1d5db; padding-top: 6px;">
        <span>TOTAL FACTURA:</span>
        <span style="font-family: monospace; color: #b45309;">${contract.totalAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</span>
      </div>
    </div>

    <div class="bank-box">
      <div class="bank-info">
        <strong style="color: #111827; font-size: 11px;">DATOS PARA TRANSFERENCIA BANCARIA INMEDIATA</strong><br>
        <span style="color: #4b5563;">Beneficiario:</span> <strong>${contract.bankDetails.accountHolder}</strong><br>
        <span style="color: #4b5563;">Entidad:</span> <strong>${contract.bankDetails.bankName}</strong><br>
        <span style="color: #4b5563;">IBAN:</span> <strong style="font-family: monospace; font-size: 12px;">${contract.bankDetails.iban}</strong><br>
        <span style="color: #4b5563;">Concepto:</span> <strong style="font-family: monospace; color: #92400e;">${contract.bankDetails.paymentConcept}</strong><br>
        ${
          contract.bankDetails.hasBizum && contract.bankDetails.bizumPhone
            ? `<div style="margin-top: 6px; padding: 4px 8px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 4px; font-size: 10px; color: #065f46; display: inline-block;">
            Bizum Empresa Habilitado: <strong style="font-family: monospace;">${contract.bankDetails.bizumPhone}</strong>
          </div>`
            : ''
        }
      </div>
      ${
        epcQrUrl
          ? `<div class="bank-qr">
        <img src="${epcQrUrl}" style="width: 80px; height: 80px; display: block; margin: 0 auto;">
        <span style="font-size: 8px; font-weight: bold; color: #4b5563; text-transform: uppercase; margin-top: 4px; display: block;">QR SEPA</span>
      </div>`
          : ''
      }
    </div>

    <div class="clauses-box">
      <strong style="display: block; margin-bottom: 6px; font-size: 10px; color: #111827;">CONDICIONES GENERALES Y CLÁUSULAS</strong>
      ${clausesList}
    </div>

    <table class="signatures-table">
      <tr>
        <td class="signature-cell">
          <div style="font-weight: bold; margin-bottom: 45px; text-transform: uppercase;">
            POR LA EMPRESA (${fiscal.companyName})
          </div>
          <div style="border-top: 1px solid #9ca3af; padding-top: 4px; color: #6b7280; font-size: 10px;">
            Firma autorizada y sello
          </div>
        </td>
        <td class="signature-cell">
          <div style="font-weight: bold; margin-bottom: 45px; text-transform: uppercase;">
            POR EL CLIENTE (${contract.clientName})
          </div>
          <div style="border-top: 1px solid #9ca3af; padding-top: 4px; color: #6b7280; font-size: 10px;">
            Firma conforme y DNI
          </div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}
