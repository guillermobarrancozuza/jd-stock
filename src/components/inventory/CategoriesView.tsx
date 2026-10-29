import React, { useState } from 'react';
import { Layers, Plus, Edit, Tag, Boxes, Trash2 } from 'lucide-react';
import { useInventory } from '../../context/InventoryContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';

export const CategoriesView: React.FC = () => {
  const { categories, items, saveCategory } = useInventory();
  const { canManageInventory } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleOpenCreate = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: any) => {
    setEditingId(c.id);
    setName(c.name);
    setDescription(c.description || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await saveCategory({
      id: editingId || undefined,
      name: name.trim(),
      description: description.trim(),
    });

    setIsModalOpen(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#30363d]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            Categorías Técnicas de Material
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono font-medium">
              {categories.length} categorías
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Organización del inventario y clasificación de material en almacén.
          </p>
        </div>

        {canManageInventory && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Categoría</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((c) => {
          const itemCount = items.filter((i) => i.category === c.name && i.status === 'active').length;
          const totalUnits = items
            .filter((i) => i.category === c.name && i.status === 'active')
            .reduce((acc, i) => acc + i.totalQuantity, 0);

          return (
            <div
              key={c.id}
              className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Layers className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-white text-sm">{c.name}</h3>
                  </div>
                  {canManageInventory && (
                    <button
                      onClick={() => handleOpenEdit(c)}
                      className="p-1 text-zinc-400 hover:text-amber-400 transition"
                      title="Editar categoría"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {c.description && <p className="text-xs text-zinc-400 mt-2">{c.description}</p>}
              </div>

              <div className="pt-3 border-t border-[#30363d] flex items-center justify-between text-xs text-zinc-400">
                <span>
                  <strong>{itemCount}</strong> referencias
                </span>
                <span className="font-mono text-amber-400">
                  <strong>{totalUnits}</strong> unidades totales
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-md p-5 space-y-4">
            <h3 className="font-bold text-white text-base">
              {editingId ? 'Editar Categoría' : 'Nueva Categoría de Material'}
            </h3>
            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Nombre *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Microfonía, Robótica..."
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Descripción</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descripción de los equipos incluidos..."
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg p-2 text-zinc-100"
                />
              </div>

              <div className="pt-3 border-t border-[#30363d] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-[#30363d] text-zinc-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
