import React, { useState, useEffect } from 'react';
import {
  Building2,
  X,
  Save,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  Smartphone,
  Plus,
  Trash2,
  MapPin,
  FileText,
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext.tsx';

interface CompanyFiscalConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CompanyFiscalConfigModal: React.FC<CompanyFiscalConfigModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    companyFiscalConfig,
    updateCompanyFiscalConfig,
    defaultBankDetails,
    updateDefaultBankDetails,
  } = useInventory();

  const [companyName, setCompanyName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [cif, setCif] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Bank & Bizum
  const [accountHolder, setAccountHolder] = useState('');
  const [bankName, setBankName] = useState('');
  const [iban, setIban] = useState('');
  const [hasBizum, setHasBizum] = useState(false);
  const [bizumPhone, setBizumPhone] = useState('');

  // Contractual clauses
  const [terms, setTerms] = useState<string[]>([]);
  const [newTerm, setNewTerm] = useState('');

  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (companyFiscalConfig && isOpen) {
      setCif(companyFiscalConfig.cif || '');
      setCompanyName(companyFiscalConfig.companyName || '');
      setTradeName(companyFiscalConfig.tradeName || '');
      setAddress(companyFiscalConfig.address || '');
      setPhone(companyFiscalConfig.phone || '');
      setEmail(companyFiscalConfig.email || '');
      setTerms(companyFiscalConfig.termsAndConditions || []);
    }
    if (defaultBankDetails && isOpen) {
      setAccountHolder(defaultBankDetails.accountHolder || '');
      setBankName(defaultBankDetails.bankName || '');
      setIban(defaultBankDetails.iban || '');
      setHasBizum(defaultBankDetails.hasBizum ?? false);
      setBizumPhone(defaultBankDetails.bizumPhone || '+34 650 123 456');
    }
  }, [companyFiscalConfig, defaultBankDetails, isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Persist company fiscal details
    updateCompanyFiscalConfig({
      cif: cif.trim(),
      companyName: companyName.trim(),
      tradeName: tradeName.trim(),
      address: address.trim(),
      phone: phone.trim(),
      email: email.trim(),
      termsAndConditions: terms,
    });

    // 2. Persist default bank & bizum details
    updateDefaultBankDetails({
      accountHolder: accountHolder.trim(),
      bankName: bankName.trim(),
      iban: iban.trim(),
      hasBizum,
      bizumPhone: bizumPhone.trim(),
    });

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  const handleAddTerm = () => {
    if (!newTerm.trim()) return;
    setTerms((prev) => [...prev, newTerm.trim()]);
    setNewTerm('');
  };

  const handleRemoveTerm = (idx: number) => {
    setTerms((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-[#161b22] border border-[#30363d] w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#30363d] flex items-center justify-between bg-gradient-to-r from-amber-950/30 via-[#161b22] to-[#161b22]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                <span>Datos Fiscales de Empresa y Ubicación</span>
              </h3>
              <p className="text-[11px] text-zinc-400">
                Configura tu CIF, ubicación física de la sede, contacto y cuenta bancaria para todos los contratos y facturas.
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
              <span>✓ ¡Datos fiscales, ubicación y banco guardados permanentemente con éxito!</span>
            </div>
          )}

          {/* Section 1: Fiscal & Identification */}
          <div className="space-y-3">
            <span className="font-bold text-amber-400 uppercase text-[11px] tracking-wider block flex items-center gap-1.5 border-b border-[#30363d] pb-1.5">
              <Building2 className="w-3.5 h-3.5" /> Identificación Fiscal de la Empresa
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  CIF / NIF <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={cif}
                  onChange={(e) => setCif(e.target.value)}
                  placeholder="Ej: B-89234812"
                  required
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-cyan-300 font-mono font-bold text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Razón Social <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Ej: JD AUDIOVISUALES S.L."
                  required
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Nombre Comercial
                </label>
                <input
                  type="text"
                  value={tradeName}
                  onChange={(e) => setTradeName(e.target.value)}
                  placeholder="Ej: JD Sonido e Iluminación"
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Physical Location & Contact */}
          <div className="space-y-3">
            <span className="font-bold text-cyan-400 uppercase text-[11px] tracking-wider block flex items-center gap-1.5 border-b border-[#30363d] pb-1.5">
              <MapPin className="w-3.5 h-3.5" /> Ubicación y Contacto
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-3">
                <label className="block text-zinc-300 font-semibold mb-1">
                  Dirección / Ubicación Central del Almacén y Sede <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ej: Polígono Industrial La Nava, Calle Sonido 14, 28001 Madrid"
                  required
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Teléfono de Contacto
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+34 600 000 000"
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-zinc-300 font-semibold mb-1">
                  Correo Electrónico de Facturación y Contratos
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contacto@jdcontrol.es"
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Official Bank Details & Bizum */}
          <div className="space-y-3">
            <span className="font-bold text-emerald-400 uppercase text-[11px] tracking-wider block flex items-center gap-1.5 border-b border-[#30363d] pb-1.5">
              <CreditCard className="w-3.5 h-3.5" /> Cuenta Bancaria Oficial para Transferencias Directas
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Titular / Beneficiario</label>
                <input
                  type="text"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  placeholder="JD AUDIOVISUALES S.L."
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Entidad Bancaria</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="CaixaBank / BBVA / Santander"
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">IBAN Cuenta Oficial</label>
                <input
                  type="text"
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                  placeholder="ES09 2100 8286 3302 0009 7660"
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-amber-300 font-mono font-bold text-xs focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Bizum Toggle */}
            <div className="p-3 rounded-xl bg-[#0d1117] border border-[#30363d] space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Smartphone className={`w-4 h-4 ${hasBizum ? 'text-emerald-400' : 'text-zinc-500'}`} />
                  <div>
                    <span className="text-xs font-semibold text-white block">Bizum de Empresa</span>
                    <span className="text-[10px] text-zinc-400">
                      {hasBizum
                        ? 'Activado: Se incluirá en facturas y contratos como opción alternativa'
                        : 'Deshabilitado (por defecto): Pulsa para activarlo si la empresa admite Bizum'}
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
                <div className="pt-2 border-t border-[#30363d] animate-in fade-in">
                  <label className="block text-zinc-300 font-semibold mb-1 text-[11px]">
                    Teléfono Oficial para Bizum
                  </label>
                  <input
                    type="text"
                    value={bizumPhone}
                    onChange={(e) => setBizumPhone(e.target.value)}
                    placeholder="+34 650 123 456"
                    className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 text-emerald-300 font-mono font-bold text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Clauses & Terms */}
          <div className="space-y-3">
            <span className="font-bold text-zinc-300 uppercase text-[11px] tracking-wider block flex items-center gap-1.5 border-b border-[#30363d] pb-1.5">
              <FileText className="w-3.5 h-3.5 text-amber-400" /> Cláusulas y Condiciones Generales ({terms.length})
            </span>

            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {terms.map((term, idx) => (
                <div key={idx} className="flex items-start gap-2 bg-[#0d1117] p-2 rounded-lg border border-[#30363d]">
                  <span className="text-[10px] text-amber-400 font-bold shrink-0">{idx + 1}.</span>
                  <input
                    type="text"
                    value={term}
                    onChange={(e) => {
                      const updated = [...terms];
                      updated[idx] = e.target.value;
                      setTerms(updated);
                    }}
                    className="w-full bg-transparent border-0 text-zinc-200 text-xs focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveTerm(idx)}
                    className="text-zinc-500 hover:text-rose-400 p-0.5 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newTerm}
                onChange={(e) => setNewTerm(e.target.value)}
                placeholder="Añadir nueva cláusula o condición..."
                className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
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
                className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Añadir
              </button>
            </div>
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
              className="px-5 py-2 rounded-xl bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Cambios Fiscales y Ubicación</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
