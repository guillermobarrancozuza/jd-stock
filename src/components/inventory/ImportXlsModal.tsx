import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Layers,
  Trash2,
  Package,
  QrCode,
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext.tsx';
import {
  downloadEmptyExcelTemplate,
  parseUploadedSpreadsheet,
  ParsedItemRow,
} from '../../lib/barcodeUtils.ts';
import { AV_GROUPS } from '../../types/inventory.ts';

interface ImportXlsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportXlsModal: React.FC<ImportXlsModalProps> = ({ isOpen, onClose }) => {
  const { importItemsFromSpreadsheet } = useInventory();

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedItemRow[]>([]);
  const [importedResult, setImportedResult] = useState<{
    imported: number;
    unitsCount: number;
    errors: string[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (selectedFile: File) => {
    try {
      setLoading(true);
      setError(null);
      setFile(selectedFile);

      const rows = await parseUploadedSpreadsheet(selectedFile);
      if (rows.length === 0) {
        setError('El archivo no contiene filas válidas o las columnas no coinciden con la plantilla.');
        setParsedRows([]);
      } else {
        setParsedRows(rows);
      }
    } catch (err: any) {
      setError(`Error al leer el archivo Excel: ${err.message || 'Formato no soportado'}`);
      setParsedRows([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleRemoveRow = (index: number) => {
    setParsedRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleGroupChange = (index: number, newGroup: string) => {
    setParsedRows((prev) =>
      prev.map((row, idx) => (idx === index ? { ...row, group: newGroup } : row))
    );
  };

  const handleConfirmImport = async () => {
    if (parsedRows.length === 0) return;

    try {
      setLoading(true);
      setError(null);

      const result = await importItemsFromSpreadsheet(parsedRows);
      setImportedResult(result);
    } catch (err: any) {
      setError(`Error durante la importación: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const totalUnitsToCreate = parsedRows.reduce((sum, r) => {
    if (r.hasSerialNumbers && r.serialNumbers.length > 0) {
      return sum + r.serialNumbers.length;
    }
    return sum + (r.hasSerialNumbers ? r.totalQuantity : 0);
  }, 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto no-print">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#30363d] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Importador de Inventario desde Excel / CSV</h2>
              <p className="text-xs text-zinc-400">
                Organización automática por grupo técnico, generación de N/S y códigos QR / barras
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* Download Template Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-amber-300 text-sm">¿Necesitas la plantilla vacía para tu cliente?</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-mono text-[10px]">
                  .XLSX Oficial
                </span>
              </div>
              <p className="text-zinc-300 text-[11px] max-w-xl leading-relaxed">
                Descarga este archivo Excel con los 14 grupos técnicos AV oficiales (
                <code className="text-amber-300 font-mono">CABLEADO</code>,{' '}
                <code className="text-amber-300 font-mono">MICROFONÍA</code>,{' '}
                <code className="text-amber-300 font-mono">ETAPAS</code>...) y columnas preparadas para que el cliente meta
                todo el material y números de serie.
              </p>
            </div>
            <button
              onClick={downloadEmptyExcelTemplate}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold transition shadow-lg shadow-amber-500/20 shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Descargar Plantilla XLS</span>
            </button>
          </div>

          {/* Success Result View */}
          {importedResult ? (
            <div className="py-8 px-4 text-center space-y-4 bg-[#0d1117] rounded-xl border border-emerald-500/30">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">¡Material Importado con Éxito!</h3>
                <p className="text-zinc-400 text-xs mt-1">
                  Se han registrado <span className="font-bold text-emerald-400">{importedResult.imported}</span> referencias
                  en el catálogo y generado <span className="font-bold text-amber-400">{importedResult.unitsCount}</span> unidades
                  físicas con sus respectivos números de serie y códigos QR.
                </p>
              </div>

              {importedResult.errors.length > 0 && (
                <div className="text-left p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] max-w-lg mx-auto">
                  <span className="font-bold block mb-1">Avisos durante la carga:</span>
                  <ul className="list-disc list-inside space-y-0.5">
                    {importedResult.errors.map((e, idx) => (
                      <li key={idx}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="pt-2">
                <button
                  onClick={onClose}
                  className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition"
                >
                  Ver en Inventario
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* File Upload Zone */}
              {!file && (
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#30363d] hover:border-amber-500/70 hover:bg-amber-500/5 rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-3"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => e.target.files && e.target.files[0] && handleFileChange(e.target.files[0])}
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-xl bg-zinc-800 text-zinc-300 flex items-center justify-center">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-white block">Arrastra aquí el archivo Excel del cliente o haz clic</span>
                    <span className="text-xs text-zinc-400 block mt-0.5">Formatos compatibles: .xlsx, .xls o .csv</span>
                  </div>
                  <span className="text-[11px] px-3 py-1 rounded-full bg-zinc-800 text-zinc-400 font-mono">
                    Plantilla_Importacion_Material_AV.xlsx
                  </span>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Parsed Rows Preview */}
              {parsedRows.length > 0 && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">Vista Previa del Material Detectado</span>
                      <span className="px-2 py-0.5 rounded bg-zinc-800 text-amber-400 font-mono font-bold">
                        {parsedRows.length} referencias
                      </span>
                      {totalUnitsToCreate > 0 && (
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                          +{totalUnitsToCreate} unidades N/S
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setFile(null);
                        setParsedRows([]);
                      }}
                      className="text-zinc-400 hover:text-rose-400 text-xs transition flex items-center gap-1 self-start sm:self-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Cargar otro archivo</span>
                    </button>
                  </div>

                  <div className="bg-[#0d1117] border border-[#30363d] rounded-xl overflow-x-auto max-h-[350px]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#161b22] text-zinc-400 uppercase font-semibold border-b border-[#30363d] text-[10px] sticky top-0">
                        <tr>
                          <th className="py-2.5 px-3">Grupo AV</th>
                          <th className="py-2.5 px-3">Artículo / Modelo</th>
                          <th className="py-2.5 px-3">Categoría</th>
                          <th className="py-2.5 px-3 text-center">Cant.</th>
                          <th className="py-2.5 px-3">Números de Serie</th>
                          <th className="py-2.5 px-3">Ubicación</th>
                          <th className="py-2.5 px-3 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#30363d]">
                        {parsedRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-zinc-800/40 transition">
                            <td className="py-2.5 px-3">
                              <select
                                value={row.group}
                                onChange={(e) => handleGroupChange(idx, e.target.value)}
                                className="bg-[#161b22] border border-[#30363d] rounded px-2 py-1 text-[11px] font-bold text-amber-400 focus:outline-none focus:border-amber-500"
                              >
                                {AV_GROUPS.map((g) => (
                                  <option key={g} value={g}>
                                    {g}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-white">{row.name}</div>
                              <div className="text-[10px] text-zinc-400">
                                {row.brand} {row.model}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-zinc-300">
                              <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px]">
                                {row.category}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-zinc-200">
                              {row.totalQuantity} <span className="text-[10px] text-zinc-500 font-normal">{row.unit}</span>
                            </td>
                            <td className="py-2.5 px-3">
                              {row.hasSerialNumbers ? (
                                <div className="space-y-0.5">
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono font-semibold">
                                    {row.serialNumbers.length > 0
                                      ? `${row.serialNumbers.length} N/S definidos`
                                      : 'Autogenerar N/S'}
                                  </span>
                                  {row.serialNumbers.length > 0 && (
                                    <div className="text-[10px] text-zinc-400 truncate max-w-[150px]">
                                      {row.serialNumbers.join(', ')}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-zinc-500 text-[11px]">No serializado</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-zinc-400 text-[11px]">
                              {row.defaultLocationName || 'Nave Central'}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                onClick={() => handleRemoveRow(idx)}
                                className="p-1 rounded text-zinc-500 hover:text-rose-400 transition"
                                title="Eliminar fila de importación"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!importedResult && (
          <div className="p-4 border-t border-[#30363d] bg-[#0d1117] flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#30363d] hover:bg-zinc-800 text-zinc-300 transition"
            >
              Cancelar
            </button>

            {parsedRows.length > 0 && (
              <button
                onClick={handleConfirmImport}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold transition shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                <span>
                  {loading
                    ? 'Procesando e Importando...'
                    : `Confirmar e Importar (${parsedRows.length} Referencias)`}
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
