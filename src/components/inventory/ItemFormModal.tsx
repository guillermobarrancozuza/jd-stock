import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, QrCode, Barcode, Sparkles, Plus, Layers } from 'lucide-react';
import { Item, AV_GROUPS } from '../../types/inventory.ts';
import { useInventory } from '../../context/InventoryContext.tsx';
import { generateBarcode, inferGroupFromCategory } from '../../lib/barcodeUtils.ts';

interface ItemFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemToEdit?: Item | null;
}

export const ItemFormModal: React.FC<ItemFormModalProps> = ({ isOpen, onClose, itemToEdit }) => {
  const { categories, locations, suppliers, saveItem } = useInventory();

  const initialCat = itemToEdit?.category || categories[0]?.name || 'Sonido';
  const initialGroup = itemToEdit?.group || inferGroupFromCategory(initialCat, itemToEdit?.name);

  const [formData, setFormData] = useState({
    code: itemToEdit?.code || '',
    name: itemToEdit?.name || '',
    group: initialGroup,
    category: initialCat,
    subcategory: itemToEdit?.subcategory || '',
    brand: itemToEdit?.brand || '',
    model: itemToEdit?.model || '',
    description: itemToEdit?.description || '',
    barcode: itemToEdit?.barcode || '',
    unit: itemToEdit?.unit || 'Uds',
    hasSerialNumbers: itemToEdit?.hasSerialNumbers ?? false,
    totalQuantity: itemToEdit?.totalQuantity ?? 1,
    defaultLocationId: itemToEdit?.defaultLocationId || locations[0]?.id || '',
    supplier: itemToEdit?.supplier || suppliers[0]?.name || '',
    purchasePrice: itemToEdit?.purchasePrice || 0,
    acquisitionDate: itemToEdit?.acquisitionDate || new Date().toISOString().split('T')[0],
    minStock: itemToEdit?.minStock ?? 2,
    notes: itemToEdit?.notes || '',
    serialsInput: '',
  });

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Auto-generate preview barcode if empty
  useEffect(() => {
    if (!formData.barcode && formData.code) {
      setFormData((prev) => ({ ...prev, barcode: generateBarcode(prev.code) }));
    }
  }, [formData.code]);

  // When category changes, auto-suggest technical group
  const handleCategoryChange = (newCat: string) => {
    const suggestedGroup = inferGroupFromCategory(newCat, formData.name);
    setFormData((prev) => ({
      ...prev,
      category: newCat,
      group: suggestedGroup,
    }));
  };

  // Helper to generate sequential serial numbers
  const handleAutoGenerateSerials = () => {
    const baseCode = formData.code.trim() || formData.name.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, 'EQ');
    const count = Math.max(1, Math.min(Number(formData.totalQuantity) || 1, 50));
    const generated: string[] = [];
    for (let i = 1; i <= count; i++) {
      generated.push(`${baseCode}-${String(i).padStart(2, '0')}`);
    }
    setFormData((prev) => ({
      ...prev,
      serialsInput: generated.join(', '),
    }));
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('El nombre del artículo es obligatorio.');
      return;
    }
    if (!formData.category) {
      setError('Debes seleccionar una categoría.');
      return;
    }
    if (!formData.group) {
      setError('Debes asignar el artículo a un grupo técnico (CABLEADO, MICROFONÍA, ETAPAS...).');
      return;
    }
    if (formData.totalQuantity < 0) {
      setError('La cantidad total no puede ser negativa.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const loc = locations.find((l) => l.id === formData.defaultLocationId);

      // Parse serial numbers if provided
      let initialSerialNumbers: string[] | undefined;
      if (formData.hasSerialNumbers && formData.serialsInput.trim()) {
        initialSerialNumbers = formData.serialsInput
          .split(/[,;\n]+/)
          .map((s) => s.trim())
          .filter(Boolean);
      }

      await saveItem({
        id: itemToEdit?.id,
        code: formData.code.trim() || undefined,
        name: formData.name.trim(),
        group: formData.group,
        category: formData.category,
        subcategory: formData.subcategory.trim() || 'General',
        brand: formData.brand.trim() || 'Genérica',
        model: formData.model.trim(),
        description: formData.description.trim(),
        barcode: formData.barcode.trim() || undefined,
        unit: formData.unit,
        hasSerialNumbers: formData.hasSerialNumbers,
        totalQuantity: Number(formData.totalQuantity),
        defaultLocationId: formData.defaultLocationId,
        defaultLocationName: loc ? `${loc.warehouse} - ${loc.zone}` : 'Nave Central',
        supplier: formData.supplier,
        purchasePrice: Number(formData.purchasePrice),
        acquisitionDate: formData.acquisitionDate,
        minStock: Number(formData.minStock),
        notes: formData.notes,
        initialSerialNumbers,
      });

      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el artículo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto no-print">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#30363d] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {itemToEdit ? 'Editar Referencia de Material AV' : 'Alta de Nuevo Material AV'}
              </h2>
              <p className="text-[11px] text-zinc-400">
                Organización por grupo técnico, código QR, código de barras y gestión de N/S
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
          {error && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Group and Category Row (Critical Requirement) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 rounded-xl bg-gradient-to-r from-amber-500/10 via-[#0d1117] to-[#0d1117] border border-amber-500/30">
            <div>
              <label className="block text-amber-400 font-bold mb-1 flex items-center gap-1.5">
                <span>GRUPO TÉCNICO AV *</span>
                <span className="text-[10px] text-zinc-400 font-normal">(Requisito empresa)</span>
              </label>
              <select
                value={formData.group}
                onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                className="w-full bg-[#161b22] border border-amber-500/50 rounded-lg px-3 py-2 text-amber-300 font-bold focus:outline-none focus:border-amber-400"
              >
                {AV_GROUPS.map((grp) => (
                  <option key={grp} value={grp}>
                    {grp}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-zinc-400 mt-1 block">
                Clasifica equipos en: CABLEADO, MICROFONÍA, ETAPAS, ROBÓTICA...
              </span>
            </div>

            <div>
              <label className="block text-zinc-300 font-semibold mb-1">Categoría General *</label>
              <select
                value={formData.category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-zinc-400 mt-1 block">
                Sección dentro del almacén y árbol de filtrado
              </span>
            </div>
          </div>

          {/* Equipment Name and Code */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-300 font-semibold mb-1">Nombre del Equipo / Artículo *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej. Shure Axient AD2/SM58, Robe Pointe, Powersoft X4..."
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-semibold mb-1">
                Código Interno (Autogenerado si vacío)
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="Ej. MIC-AXNT-001, AMP-PWR4-001..."
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 font-mono focus:outline-none focus:border-amber-500 uppercase"
              />
            </div>
          </div>

          {/* Brand, Model, Subcategory */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-zinc-300 font-semibold mb-1">Marca / Fabricante</label>
              <input
                type="text"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                placeholder="Ej. Shure, Robe, Yamaha, Klotz..."
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-semibold mb-1">Modelo Exacto</label>
              <input
                type="text"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                placeholder="Ej. AD2/B58, X4 Dante, Pointe..."
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-semibold mb-1">Subcategoría</label>
              <input
                type="text"
                value={formData.subcategory}
                onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                placeholder="Ej. Inalámbricos, 4 Canales..."
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Barcode & QR Automatic Generation Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 rounded-xl bg-[#0d1117] border border-[#30363d]">
            <div>
              <label className="block text-zinc-300 font-semibold mb-1 flex items-center gap-1.5">
                <Barcode className="w-3.5 h-3.5 text-amber-400" />
                <span>Código de Barras (EAN-13 Autogenerado)</span>
              </label>
              <input
                type="text"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                placeholder="Autogenerado al guardar (ej. 8437001...)"
                className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 font-mono text-xs focus:outline-none focus:border-amber-500"
              />
              <span className="text-[10px] text-zinc-500 mt-1 block">
                Compatible con lectores láser USB y pistolas de código de barras
              </span>
            </div>

            <div>
              <label className="block text-zinc-300 font-semibold mb-1 flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-amber-400" />
                <span>Identificador QR para Smartphone</span>
              </label>
              <div className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 text-amber-400 font-mono text-xs truncate">
                {formData.code ? `QR-${formData.code.toUpperCase()}` : 'QR-[CÓDIGO_INTERNO]'}
              </div>
              <span className="text-[10px] text-zinc-500 mt-1 block">
                Genera automáticamente etiqueta imprimible con QR 2D
              </span>
            </div>
          </div>

          {/* Quantities & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-3 rounded-xl bg-[#0d1117] border border-[#30363d]">
            <div>
              <label className="block text-zinc-300 font-semibold mb-1">Cantidad Total *</label>
              <input
                type="number"
                min="0"
                required
                value={formData.totalQuantity}
                onChange={(e) => setFormData({ ...formData, totalQuantity: Number(e.target.value) })}
                className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 font-bold focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-semibold mb-1">Stock Mínimo</label>
              <input
                type="number"
                min="0"
                value={formData.minStock}
                onChange={(e) => setFormData({ ...formData, minStock: Number(e.target.value) })}
                className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-semibold mb-1">Ubicación Habitual</label>
              <select
                value={formData.defaultLocationId}
                onChange={(e) => setFormData({ ...formData, defaultLocationId: e.target.value })}
                className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.warehouse} — {l.zone}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Serialization toggle & N/S Definition */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-amber-300 block">
                  Gestión por Número de Serie (N/S) & QR Individual
                </span>
                <span className="text-[11px] text-zinc-400">
                  Crea unidades físicas identificables individualmente para microfonía, etapas, focos o mesas.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.hasSerialNumbers}
                  onChange={(e) => setFormData({ ...formData, hasSerialNumbers: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            {formData.hasSerialNumbers && (
              <div className="pt-2 border-t border-amber-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-zinc-300 font-semibold text-[11px]">
                    Números de Serie Iniciales (separados por coma o salto de línea):
                  </label>
                  <button
                    type="button"
                    onClick={handleAutoGenerateSerials}
                    className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 font-semibold transition"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Autogenerar {formData.totalQuantity} N/S</span>
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={formData.serialsInput}
                  onChange={(e) => setFormData({ ...formData, serialsInput: e.target.value })}
                  placeholder="Ej. SH-AX-001, SH-AX-002, SH-AX-003... (Si lo dejas vacío se crearán automáticamente con el código)"
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 font-mono text-[11px] focus:outline-none focus:border-amber-500"
                />
              </div>
            )}
          </div>

          {/* Supplier, Price, Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-zinc-300 font-semibold mb-1">Proveedor</label>
              <input
                type="text"
                value={formData.supplier}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                placeholder="Earpro, Equipson, Thomann..."
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-semibold mb-1">Precio Compra (€ sin IVA)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.purchasePrice}
                onChange={(e) => setFormData({ ...formData, purchasePrice: Number(e.target.value) })}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-semibold mb-1">Unidad de Medida</label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
              >
                <option value="Uds">Unidades (Uds)</option>
                <option value="Metros">Metros (m)</option>
                <option value="Kits">Kits / Sets</option>
                <option value="Cajas">Cajas / Baúles</option>
                <option value="Pares">Pares</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-zinc-300 font-semibold mb-1">Descripción Técnica / Accesorios</label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Especificaciones técnicas, mangueras, conectores, flight case de transporte..."
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Footer Submit */}
          <div className="pt-3 border-t border-[#30363d] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#30363d] hover:bg-zinc-800 text-zinc-300 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold transition shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{submitting ? 'Guardando...' : 'Guardar Artículo'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
