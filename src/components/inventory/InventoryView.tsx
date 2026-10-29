import React, { useState, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  Layers,
  MapPin,
  AlertTriangle,
  QrCode,
  Eye,
  Edit,
  Boxes,
  CheckCircle,
  Truck,
  Wrench,
  Grid,
  List as ListIcon,
  Archive,
  Download,
  Upload,
  Barcode as BarcodeIcon,
} from 'lucide-react';
import { Item, AV_GROUPS } from '../../types/inventory.ts';
import { useInventory } from '../../context/InventoryContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { ItemFormModal } from './ItemFormModal.tsx';
import { ItemDetailModal } from './ItemDetailModal.tsx';
import { ImportXlsModal } from './ImportXlsModal.tsx';
import { QrBarcodeModal } from './QrBarcodeModal.tsx';
import { downloadEmptyExcelTemplate } from '../../lib/barcodeUtils.ts';

interface InventoryViewProps {
  searchQuery?: string;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ searchQuery = '' }) => {
  const { items, categories, locations } = useInventory();
  const { canManageInventory, canViewContracts } = useAuth();

  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<string>('all');
  const [localSearch, setLocalSearch] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<Item | null>(null);
  const [itemToView, setItemToView] = useState<Item | null>(null);
  const [qrModalItem, setQrModalItem] = useState<Item | null>(null);

  const query = (localSearch || searchQuery).toLowerCase().trim();

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Group filter (CABLEADO, MICROFONÍA, ETAPAS...)
      if (selectedGroup !== 'all' && item.group !== selectedGroup) {
        return false;
      }

      // Category filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }

      // Stock status filter
      if (stockStatusFilter === 'available' && item.availableQuantity <= 0) return false;
      if (stockStatusFilter === 'out' && item.outQuantity <= 0) return false;
      if (stockStatusFilter === 'damaged' && item.damagedQuantity <= 0) return false;
      if (stockStatusFilter === 'low_stock' && item.availableQuantity > item.minStock) return false;
      if (stockStatusFilter === 'archived' && item.status !== 'archived') return false;
      if (stockStatusFilter !== 'archived' && item.status === 'archived') return false;

      // Text query
      if (!query) return true;
      return (
        item.name.toLowerCase().includes(query) ||
        item.code.toLowerCase().includes(query) ||
        (item.group && item.group.toLowerCase().includes(query)) ||
        (item.barcode && item.barcode.toLowerCase().includes(query)) ||
        item.brand.toLowerCase().includes(query) ||
        item.model.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        item.defaultLocationName.toLowerCase().includes(query)
      );
    });
  }, [items, selectedGroup, selectedCategory, stockStatusFilter, query]);

  const handleOpenCreate = () => {
    setItemToEdit(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (it: Item) => {
    setItemToEdit(it);
    setIsFormOpen(true);
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-[#30363d]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            Catálogo de Inventario
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono font-medium">
              {filteredItems.length} referencias
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Control integral de material clasificado por grupos técnicos, códigos QR, barras y trazabilidad de N/S.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-[#161b22] border border-[#30363d] rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded transition ${viewMode === 'table' ? 'bg-zinc-800 text-amber-400' : 'text-zinc-400'}`}
              title="Vista de tabla"
            >
              <ListIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded transition ${viewMode === 'cards' ? 'bg-zinc-800 text-amber-400' : 'text-zinc-400'}`}
              title="Vista de tarjetas"
            >
              <Grid className="w-4 h-4" />
            </button>
          </div>

          {/* Download Empty Excel Template Button */}
          <button
            onClick={downloadEmptyExcelTemplate}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-[#30363d] text-xs font-semibold transition cursor-pointer"
            title="Descargar plantilla Excel vacía para entregar al cliente"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Plantilla XLS Vacía</span>
          </button>

          {canManageInventory && (
            <>
              {/* Import Excel / CSV Button */}
              <button
                onClick={() => setIsImportOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold transition cursor-pointer"
                title="Importar catálogo desde archivo Excel o CSV"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-400" />
                <span>Importar XLS / CSV</span>
              </button>

              {/* Create Item Button */}
              <button
                onClick={handleOpenCreate}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold shadow-lg shadow-amber-500/20 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Alta de Material</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-[#161b22] p-3.5 rounded-xl border border-[#30363d] text-xs">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Buscar nombre, código, marca, barcode..."
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg pl-9 pr-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Technical Group Filter (CABLEADO, MICROFONÍA, ETAPAS...) */}
        <div>
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="w-full bg-[#0d1117] border border-amber-500/40 rounded-lg px-3 py-2 text-amber-300 font-bold focus:outline-none focus:border-amber-400"
          >
            <option value="all" className="font-normal text-zinc-200">
              Todos los grupos técnicos ({AV_GROUPS.length})
            </option>
            {AV_GROUPS.map((grp) => (
              <option key={grp} value={grp}>
                GRUPO: {grp}
              </option>
            ))}
          </select>
        </div>

        {/* Category selector */}
        <div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
          >
            <option value="all">Todas las categorías ({categories.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Stock status filter */}
        <div className="flex items-center gap-2">
          <select
            value={stockStatusFilter}
            onChange={(e) => setStockStatusFilter(e.target.value)}
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
          >
            <option value="all">Todos los estados de stock</option>
            <option value="available">Solo con disponibles</option>
            <option value="low_stock">Stock bajo / agotado</option>
            <option value="out">En bolos (fuera)</option>
            <option value="damaged">Averiados / SAT</option>
            <option value="archived">Archivados</option>
          </select>

          {(selectedGroup !== 'all' || selectedCategory !== 'all' || stockStatusFilter !== 'all' || localSearch) && (
            <button
              onClick={() => {
                setSelectedGroup('all');
                setSelectedCategory('all');
                setStockStatusFilter('all');
                setLocalSearch('');
              }}
              className="px-2.5 py-2 rounded-lg border border-[#30363d] hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition shrink-0"
              title="Limpiar filtros"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Main Catalog View: Table or Cards */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-16 bg-[#161b22] border border-[#30363d] rounded-xl text-zinc-400 space-y-3">
          <Package className="w-12 h-12 text-zinc-600 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-zinc-200">No se encontraron artículos</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Prueba a modificar los filtros de búsqueda o grupo técnico, o importa un archivo Excel con el material.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={downloadEmptyExcelTemplate}
              className="px-3 py-1.5 rounded-lg border border-[#30363d] hover:bg-zinc-800 text-zinc-300 text-xs transition"
            >
              Descargar Plantilla XLS
            </button>
            {canManageInventory && (
              <button
                onClick={handleOpenCreate}
                className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition"
              >
                + Alta de Material
              </button>
            )}
          </div>
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-x-auto shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0d1117] text-zinc-400 uppercase font-semibold border-b border-[#30363d] text-[11px] font-mono">
              <tr>
                <th className="py-3 px-4">Código / QR</th>
                <th className="py-3 px-4">Grupo Técnico</th>
                <th className="py-3 px-4">Artículo / Modelo</th>
                <th className="py-3 px-4 text-center">Total</th>
                <th className="py-3 px-4 text-center">Disponible</th>
                {canViewContracts && <th className="py-3 px-4 text-center">Reservado</th>}
                <th className="py-3 px-4 text-center">Fuera</th>
                <th className="py-3 px-4 text-center">Averiado</th>
                <th className="py-3 px-4">Ubicación</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#30363d]">
              {filteredItems.map((item) => {
                const isLow = item.availableQuantity <= item.minStock;
                return (
                  <tr
                    key={item.id}
                    onClick={() => setItemToView(item)}
                    className="hover:bg-[#0d1117]/60 cursor-pointer transition"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-amber-400">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setQrModalItem(item);
                          }}
                          className="p-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition"
                          title="Ver QR, código de barras y generar etiqueta"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                        </button>
                        <span>{item.code}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                        {item.group || 'GENERAL'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white flex items-center gap-2">
                        <span>{item.name}</span>
                        {item.hasSerialNumbers && (
                          <span className="text-[10px] px-1 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                            N/S
                          </span>
                        )}
                        {item.status === 'archived' && (
                          <span className="text-[10px] px-1 rounded bg-rose-950 text-rose-400 border border-rose-800">
                            Archivado
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-400 flex items-center gap-2">
                        <span>{item.brand} {item.model}</span>
                        {item.barcode && (
                          <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-0.5">
                            <BarcodeIcon className="w-3 h-3" />
                            {item.barcode}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-bold font-mono text-zinc-200">
                      {item.totalQuantity} <span className="text-[10px] text-zinc-500 font-normal">{item.unit}</span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold font-mono">
                      <span
                        className={`px-2 py-0.5 rounded ${
                          isLow
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                            : 'bg-emerald-500/20 text-emerald-400'
                        }`}
                      >
                        {item.availableQuantity}
                      </span>
                    </td>
                    {canViewContracts && (
                      <td className="py-3 px-4 text-center font-mono text-amber-400">
                        {item.reservedQuantity > 0 ? item.reservedQuantity : '-'}
                      </td>
                    )}
                    <td className="py-3 px-4 text-center font-mono text-purple-400">
                      {item.outQuantity > 0 ? item.outQuantity : '-'}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-rose-400">
                      {item.damagedQuantity > 0 ? item.damagedQuantity : '-'}
                    </td>
                    <td className="py-3 px-4 text-zinc-400 text-[11px]">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        <span className="truncate max-w-[130px]">{item.defaultLocationName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setQrModalItem(item)}
                          className="p-1 rounded hover:bg-zinc-800 text-amber-400"
                          title="Ver QR y Código de Barras"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setItemToView(item)}
                          className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                          title="Ver ficha técnica"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {canManageInventory && (
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-amber-400"
                            title="Editar referencia"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Cards View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => setItemToView(item)}
              className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] hover:border-zinc-500 cursor-pointer transition flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-zinc-800 text-amber-400 border border-amber-500/30">
                    {item.code}
                  </span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    {item.group || 'GENERAL'}
                  </span>
                </div>
                <h3 className="font-bold text-white text-sm mt-1">{item.name}</h3>
                <p className="text-xs text-zinc-400">
                  {item.brand} {item.model}
                </p>
              </div>

              {/* Stock Mini Bar */}
              <div className="grid grid-cols-4 gap-1 p-2 rounded-lg bg-[#0d1117] text-center font-mono text-xs">
                <div>
                  <span className="text-[10px] text-zinc-500 block">Total</span>
                  <span className="font-bold text-zinc-200">{item.totalQuantity}</span>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-500 block">Disp.</span>
                  <span className="font-bold text-emerald-400">{item.availableQuantity}</span>
                </div>
                <div>
                  <span className="text-[10px] text-purple-500 block">Fuera</span>
                  <span className="font-bold text-purple-400">{item.outQuantity}</span>
                </div>
                <div>
                  <span className="text-[10px] text-rose-500 block">SAT</span>
                  <span className="font-bold text-rose-400">{item.damagedQuantity}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-2 border-t border-[#30363d]">
                <span className="truncate max-w-[150px]">{item.defaultLocationName}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setQrModalItem(item);
                    }}
                    className="flex items-center gap-1 text-amber-400 hover:text-amber-300 transition"
                    title="Ver QR / Código de barras"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>QR</span>
                  </button>
                  {item.hasSerialNumbers && (
                    <span className="text-zinc-400 font-mono text-[10px] px-1 rounded bg-zinc-800">
                      N/S
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Item Form Modal */}
      {isFormOpen && (
        <ItemFormModal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          itemToEdit={itemToEdit}
        />
      )}

      {/* Item Detail Drawer */}
      {itemToView && (
        <ItemDetailModal
          item={itemToView}
          onClose={() => setItemToView(null)}
          onEdit={(it) => {
            setItemToView(null);
            handleOpenEdit(it);
          }}
        />
      )}

      {/* Excel / CSV Import Modal */}
      {isImportOpen && (
        <ImportXlsModal
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
        />
      )}

      {/* QR & Barcode Viewer Modal */}
      {qrModalItem && (
        <QrBarcodeModal
          isOpen={Boolean(qrModalItem)}
          onClose={() => setQrModalItem(null)}
          item={qrModalItem}
        />
      )}
    </div>
  );
};
