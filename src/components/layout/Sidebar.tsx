import React from 'react';
import {
  LayoutDashboard,
  Package,
  Layers,
  MapPin,
  CalendarCheck,
  Truck,
  RotateCcw,
  Wrench,
  ShoppingCart,
  ClipboardList,
  Users,
  History,
  BarChart3,
  QrCode,
  RefreshCw,
  Sliders,
  FileSignature,
  ShieldCheck,
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, onClose }) => {
  const { seedInitialData, events, incidents, items, contracts } = useInventory();
  const { canManageInventory, canViewContracts, canManageUsers } = useAuth();

  const activeIncidents = incidents.filter((i) => i.status !== 'closed' && i.status !== 'repaired').length;
  const activeEvents = events.filter((e) => ['confirmed', 'preparing', 'prepared', 'dispatched', 'pending_return'].includes(e.status)).length;
  const lowStock = items.filter((i) => i.status === 'active' && i.availableQuantity <= i.minStock).length;
  const pendingContracts = contracts.filter((c) => c.status === 'sent' || c.status === 'draft').length;

  const operationItems = [
    { id: 'events', label: 'Eventos y Agenda', icon: CalendarCheck, badge: activeEvents > 0 ? `${activeEvents}` : undefined, badgeColor: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' },
    ...(canViewContracts
      ? [{ id: 'contracts', label: 'Contratos & Reserva 10%', icon: FileSignature, badge: pendingContracts > 0 ? `${pendingContracts} pend.` : undefined, badgeColor: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' }]
      : []),
    { id: 'dispatches', label: 'Salidas y Albaranes', icon: Truck },
    { id: 'returns', label: 'Devoluciones y Control', icon: RotateCcw },
    { id: 'maintenance', label: 'Averías y Taller SAT', icon: Wrench, badge: activeIncidents > 0 ? `${activeIncidents}` : undefined, badgeColor: 'bg-rose-500/20 text-rose-400 border border-rose-500/30' },
  ];

  const navGroups = [
    {
      title: 'PRINCIPAL',
      items: [
        { id: 'dashboard', label: 'Panel General', icon: LayoutDashboard },
      ],
    },
    {
      title: 'INVENTARIO',
      items: [
        { id: 'inventory', label: 'Catálogo de Artículos', icon: Package, badge: lowStock > 0 ? `${lowStock} bajo mín.` : undefined, badgeColor: 'bg-orange-500/20 text-orange-400 border border-orange-500/30' },
        { id: 'units', label: 'Unidades y N/S', icon: QrCode },
        { id: 'categories', label: 'Categorías de Material', icon: Layers },
        { id: 'locations', label: 'Almacenes y Ubicaciones', icon: MapPin },
      ],
    },
    {
      title: 'OPERACIONES',
      items: operationItems,
    },
    {
      title: 'GESTIÓN & AUDITORÍA',
      items: [
        { id: 'purchases', label: 'Compras y Recepciones', icon: ShoppingCart },
        { id: 'audit', label: 'Inventarios Físicos', icon: ClipboardList },
        { id: 'partners', label: 'Clientes y Proveedores', icon: Users },
        { id: 'movements', label: 'Historial Inmutable', icon: History },
        { id: 'reports', label: 'Informes y Métricas', icon: BarChart3 },
      ],
    },
    ...(canManageUsers
      ? [
          {
            title: 'ADMINISTRACIÓN (JEFE)',
            items: [
              {
                id: 'users',
                label: 'Personal & Roles Google',
                icon: ShieldCheck,
                badge: 'Admin',
                badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
              },
            ],
          },
        ]
      : []),
  ];

  return (
    <aside className="w-64 bg-[#161b22] border-r border-[#30363d] flex flex-col justify-between h-[calc(100vh-4rem)] sticky top-16 no-print overflow-y-auto">
      <div className="py-4 px-3 space-y-6">
        {navGroups.map((group) => (
          <div key={group.title}>
            <div className="px-3 text-[10px] font-bold text-zinc-500 tracking-wider mb-2 font-mono">
              {group.title}
            </div>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigate(item.id);
                      if (onClose) onClose();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                      isActive
                        ? 'bg-amber-500 text-black font-semibold shadow-md shadow-amber-500/10'
                        : 'text-zinc-300 hover:text-white hover:bg-[#0d1117]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-black' : 'text-zinc-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${
                          isActive ? 'bg-black text-amber-400' : item.badgeColor
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
};
