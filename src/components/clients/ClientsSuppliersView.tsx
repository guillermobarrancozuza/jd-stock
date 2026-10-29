import React, { useState } from 'react';
import { Users, Plus, Phone, Mail, MapPin, Building, Edit, Truck, Tag } from 'lucide-react';
import { Client, Supplier } from '../../types/inventory.ts';
import { useInventory } from '../../context/InventoryContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';

export const ClientsSuppliersView: React.FC = () => {
  const { clients, suppliers, saveClient, saveSupplier } = useInventory();
  const { canManageInventory } = useAuth();

  const [activeTab, setActiveTab] = useState<'clients' | 'suppliers'>('clients');

  // Client modal
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientData, setClientData] = useState<Partial<Client>>({});

  // Supplier modal
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [supplierData, setSupplierData] = useState<Partial<Supplier>>({});

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientData.name?.trim()) return;

    await saveClient({
      id: clientData.id,
      name: clientData.name.trim(),
      taxId: clientData.taxId?.trim(),
      contactPerson: clientData.contactPerson?.trim(),
      phone: clientData.phone?.trim() || '',
      email: clientData.email?.trim() || '',
      address: clientData.address?.trim() || '',
      notes: clientData.notes?.trim(),
    });

    setIsClientModalOpen(false);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierData.name?.trim()) return;

    await saveSupplier({
      id: supplierData.id,
      name: supplierData.name.trim(),
      taxId: supplierData.taxId?.trim(),
      contactPerson: supplierData.contactPerson?.trim(),
      phone: supplierData.phone?.trim() || '',
      email: supplierData.email?.trim() || '',
      address: supplierData.address?.trim() || '',
      suppliedCategories: supplierData.suppliedCategories?.trim(),
      notes: supplierData.notes?.trim(),
    });

    setIsSupplierModalOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#30363d]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-amber-400" />
            Clientes y Proveedores
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Fichero de productoras de eventos, recintos, teatros, distribuidores y marcas audiovisuales.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canManageInventory && (
            <button
              onClick={() => {
                if (activeTab === 'clients') {
                  setClientData({});
                  setIsClientModalOpen(true);
                } else {
                  setSupplierData({});
                  setIsSupplierModalOpen(true);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{activeTab === 'clients' ? 'Nuevo Cliente' : 'Nuevo Proveedor'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-[#30363d] text-xs font-semibold">
        <button
          onClick={() => setActiveTab('clients')}
          className={`py-2.5 px-4 border-b-2 transition ${
            activeTab === 'clients'
              ? 'border-amber-500 text-amber-400 font-bold'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          Clientes y Productoras ({clients.length})
        </button>
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`py-2.5 px-4 border-b-2 transition ${
            activeTab === 'suppliers'
              ? 'border-amber-500 text-amber-400 font-bold'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          Proveedores y Distribuidores ({suppliers.length})
        </button>
      </div>

      {/* Clients Tab */}
      {activeTab === 'clients' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((cli) => (
            <div
              key={cli.id}
              className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] space-y-3 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      <Building className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">{cli.name}</h3>
                      {cli.taxId && <span className="text-[10px] text-zinc-500 font-mono">CIF: {cli.taxId}</span>}
                    </div>
                  </div>
                  {canManageInventory && (
                    <button
                      onClick={() => {
                        setClientData(cli);
                        setIsClientModalOpen(true);
                      }}
                      className="p-1 text-zinc-400 hover:text-amber-400"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-zinc-300">
                  {cli.contactPerson && (
                    <div className="text-zinc-400">Contacto: <strong>{cli.contactPerson}</strong></div>
                  )}
                  {cli.phone && (
                    <div className="flex items-center gap-1.5 text-zinc-400">
                      <Phone className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      <span>{cli.phone}</span>
                    </div>
                  )}
                  {cli.email && (
                    <div className="flex items-center gap-1.5 text-zinc-400">
                      <Mail className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      <span className="truncate">{cli.email}</span>
                    </div>
                  )}
                  {cli.address && (
                    <div className="flex items-center gap-1.5 text-zinc-400">
                      <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      <span className="truncate">{cli.address}</span>
                    </div>
                  )}
                </div>

                {cli.notes && (
                  <p className="mt-2 text-[11px] text-zinc-500 border-t border-[#30363d] pt-2">
                    {cli.notes}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Suppliers Tab */}
      {activeTab === 'suppliers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((sup) => (
            <div
              key={sup.id}
              className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] space-y-3 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">{sup.name}</h3>
                      {sup.taxId && <span className="text-[10px] text-zinc-500 font-mono">CIF: {sup.taxId}</span>}
                    </div>
                  </div>
                  {canManageInventory && (
                    <button
                      onClick={() => {
                        setSupplierData(sup);
                        setIsSupplierModalOpen(true);
                      }}
                      className="p-1 text-zinc-400 hover:text-amber-400"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-zinc-300">
                  {sup.contactPerson && (
                    <div className="text-zinc-400">Contacto: <strong>{sup.contactPerson}</strong></div>
                  )}
                  {sup.phone && (
                    <div className="flex items-center gap-1.5 text-zinc-400">
                      <Phone className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      <span>{sup.phone}</span>
                    </div>
                  )}
                  {sup.email && (
                    <div className="flex items-center gap-1.5 text-zinc-400">
                      <Mail className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      <span className="truncate">{sup.email}</span>
                    </div>
                  )}
                  {sup.suppliedCategories && (
                    <div className="text-[11px] text-amber-400/90 font-medium pt-1">
                      Material: {sup.suppliedCategories}
                    </div>
                  )}
                </div>

                {sup.notes && (
                  <p className="mt-2 text-[11px] text-zinc-500 border-t border-[#30363d] pt-2">
                    {sup.notes}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Client Modal */}
      {isClientModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-md p-5 space-y-4">
            <h3 className="font-bold text-white text-base">
              {clientData.id ? 'Editar Cliente' : 'Nuevo Cliente / Productora'}
            </h3>
            <form onSubmit={handleSaveClient} className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Nombre / Razón Social *</label>
                <input
                  type="text"
                  required
                  value={clientData.name || ''}
                  onChange={(e) => setClientData({ ...clientData, name: e.target.value })}
                  placeholder="Ej. Sonorama Producciones, Teatro Principal..."
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">CIF / NIF</label>
                  <input
                    type="text"
                    value={clientData.taxId || ''}
                    onChange={(e) => setClientData({ ...clientData, taxId: e.target.value })}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">Persona de Contacto</label>
                  <input
                    type="text"
                    value={clientData.contactPerson || ''}
                    onChange={(e) => setClientData({ ...clientData, contactPerson: e.target.value })}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={clientData.phone || ''}
                    onChange={(e) => setClientData({ ...clientData, phone: e.target.value })}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">Email</label>
                  <input
                    type="email"
                    value={clientData.email || ''}
                    onChange={(e) => setClientData({ ...clientData, email: e.target.value })}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Dirección</label>
                <input
                  type="text"
                  value={clientData.address || ''}
                  onChange={(e) => setClientData({ ...clientData, address: e.target.value })}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Observaciones</label>
                <input
                  type="text"
                  value={clientData.notes || ''}
                  onChange={(e) => setClientData({ ...clientData, notes: e.target.value })}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100"
                />
              </div>

              <div className="pt-3 border-t border-[#30363d] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsClientModalOpen(false)}
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

      {/* Supplier Modal */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-md p-5 space-y-4">
            <h3 className="font-bold text-white text-base">
              {supplierData.id ? 'Editar Proveedor' : 'Nuevo Proveedor'}
            </h3>
            <form onSubmit={handleSaveSupplier} className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Razón Social *</label>
                <input
                  type="text"
                  required
                  value={supplierData.name || ''}
                  onChange={(e) => setSupplierData({ ...supplierData, name: e.target.value })}
                  placeholder="Ej. Earpro, Thomann B2B..."
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">CIF / NIF</label>
                  <input
                    type="text"
                    value={supplierData.taxId || ''}
                    onChange={(e) => setSupplierData({ ...supplierData, taxId: e.target.value })}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">Contacto</label>
                  <input
                    type="text"
                    value={supplierData.contactPerson || ''}
                    onChange={(e) => setSupplierData({ ...supplierData, contactPerson: e.target.value })}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={supplierData.phone || ''}
                    onChange={(e) => setSupplierData({ ...supplierData, phone: e.target.value })}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">Email</label>
                  <input
                    type="email"
                    value={supplierData.email || ''}
                    onChange={(e) => setSupplierData({ ...supplierData, email: e.target.value })}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">Material Suministrado</label>
                <input
                  type="text"
                  placeholder="Shure, Robe, cables Neutrik, repuestos..."
                  value={supplierData.suppliedCategories || ''}
                  onChange={(e) => setSupplierData({ ...supplierData, suppliedCategories: e.target.value })}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-zinc-100"
                />
              </div>

              <div className="pt-3 border-t border-[#30363d] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
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
