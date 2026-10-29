import React, { useState } from 'react';
import {
  Search,
  Bell,
  PlusCircle,
  Truck,
  RotateCcw,
  Wrench,
  Shield,
  UserCheck,
  LogOut,
  LogIn,
  AlertTriangle,
  Package,
  KeyRound,
  Users,
  Menu,
  X as XIcon,
  Camera,
  Smartphone,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useInventory } from '../../context/InventoryContext.tsx';
import { UserRole } from '../../types/inventory.ts';
import { AdminLoginModal } from '../auth/AdminLoginModal.tsx';
import { PWAInstallButton } from '../pwa/PWAInstallButton.tsx';

interface NavbarProps {
  onNavigate: (view: string) => void;
  onOpenQuickAction: (action: 'dispatch' | 'return' | 'incident' | 'item' | 'purchase') => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
  onOpenScanner?: () => void;
  onOpenMobileAppModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onNavigate,
  onOpenQuickAction,
  searchQuery,
  onSearchChange,
  onToggleMobileMenu,
  isMobileMenuOpen,
  onOpenScanner,
  onOpenMobileAppModal,
}) => {
  const { currentUser, userProfile, isAdmin, loginWithGoogle, logout } = useAuth();
  const { events, incidents, items } = useInventory();
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showAlertsMenu, setShowAlertsMenu] = useState(false);

  // Compute urgent alerts
  const overdueReturns = events.filter((e) => {
    if (e.status !== 'pending_return' && e.status !== 'dispatched') return false;
    return new Date(e.returnDate).getTime() < Date.now();
  });

  const criticalIncidents = incidents.filter(
    (i) => (i.priority === 'critical' || i.priority === 'high') && i.status !== 'closed' && i.status !== 'repaired'
  );

  const lowStockItems = items.filter(
    (i) => i.status === 'active' && i.availableQuantity <= i.minStock
  );

  const totalAlerts = overdueReturns.length + criticalIncidents.length + lowStockItems.length;

  const roleLabels: Record<UserRole, { label: string; desc: string; color: string }> = {
    admin: { label: 'Administrador (Jefe)', desc: 'Acceso total: contratos, reservas, precios y config.', color: 'bg-amber-500/20 text-amber-400 border-amber-500/40' },
    warehouse_manager: { label: 'Encargado de Almacén', desc: 'Control de stock, albaranes, SAT y recepciones', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' },
    technician: { label: 'Técnico', desc: 'Preparación de salidas, picking y partes SAT', color: 'bg-blue-500/20 text-blue-400 border-blue-500/40' },
    pending: { label: 'Pendiente de Asignación', desc: 'Esperando validación del Administrador Jefe', color: 'bg-zinc-700/50 text-zinc-300 border-zinc-600' },
  };

  const currentRole = (userProfile?.role === ('viewer' as any) ? 'technician' : (userProfile?.role || 'admin')) as UserRole;

  return (
    <header className="sticky top-0 z-30 h-16 bg-[#161b22] border-b border-[#30363d] px-4 sm:px-6 flex items-center justify-between no-print">
      {/* Brand & Global Search */}
      <div className="flex items-center gap-3 sm:gap-4 flex-1 max-w-xl">
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="lg:hidden p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-[#0d1117] transition cursor-pointer"
            aria-label="Abrir menú de navegación"
          >
            {isMobileMenuOpen ? <XIcon className="w-5 h-5 text-amber-400" /> : <Menu className="w-5 h-5" />}
          </button>
        )}

        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => onNavigate('dashboard')}>
          <img
            src="/assets/logo_transparent.png"
            alt="JD Control de Stock"
            className="w-10 h-10 object-contain rounded-lg p-0.5"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/assets/logo_jd.png';
            }}
          />
          <div className="hidden sm:block leading-tight">
            <span className="font-extrabold text-white text-base tracking-wide flex items-center gap-1.5">
              <span className="bg-gradient-to-r from-cyan-400 to-fuchsia-500 bg-clip-text text-transparent font-black">
                JD
              </span>
              <span>Control de Stock</span>
            </span>
            <span className="text-[11px] text-zinc-400 block font-medium">Gestión Integral de Almacén</span>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="relative flex-1 max-w-md hidden sm:block">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por código, N/S, artículo, evento o marca..."
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-300"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Quick Action Buttons & User Controls */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* PWA Install Button (Chromium / iOS) */}
        <PWAInstallButton />

        {/* Mobile Camera QR & Barcode Scanner Button */}
        {onOpenScanner && (
          <button
            onClick={onOpenScanner}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition shadow-xs cursor-pointer"
            title="Abrir Escáner de Cámara para Códigos QR y Códigos de Barras"
          >
            <Camera className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Escanear QR</span>
          </button>
        )}

        {/* Link Phone / PWA Info Modal */}
        {onOpenMobileAppModal && (
          <button
            onClick={onOpenMobileAppModal}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 text-xs font-medium transition cursor-pointer"
            title="Conectar con tu móvil y ver guía de instalación PWA"
          >
            <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
            <span>App Móvil</span>
          </button>
        )}

        {/* Quick Action: Salida */}
        <button
          onClick={() => onOpenQuickAction('dispatch')}
          className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold transition"
          title="Preparar y registrar salida de material para evento"
        >
          <Truck className="w-3.5 h-3.5" />
          <span>Salida</span>
        </button>

        {/* Quick Action: Devolución */}
        <button
          onClick={() => onOpenQuickAction('return')}
          className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition"
          title="Registrar devolución de material y comprobación técnica"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Devolución</span>
        </button>

        {/* Quick Action: Incidencia */}
        <button
          onClick={() => onOpenQuickAction('incident')}
          className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold transition"
          title="Dar de alta avería o equipo en reparación"
        >
          <Wrench className="w-3.5 h-3.5" />
          <span>Avería</span>
        </button>

        {/* Alerts Bell */}
        <div className="relative">
          <button
            onClick={() => {
              setShowAlertsMenu(!showAlertsMenu);
            }}
            className="relative p-2 rounded-lg bg-[#0d1117] border border-[#30363d] text-zinc-300 hover:text-white hover:border-zinc-500 transition"
          >
            <Bell className="w-4 h-4" />
            {totalAlerts > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white font-bold text-[10px] flex items-center justify-center animate-pulse">
                {totalAlerts}
              </span>
            )}
          </button>

          {/* Alerts Dropdown */}
          {showAlertsMenu && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl p-4 z-50 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#30363d] mb-3">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Alertas del Almacén ({totalAlerts})
                </span>
                <button
                  onClick={() => setShowAlertsMenu(false)}
                  className="text-zinc-400 hover:text-zinc-200"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2.5 max-h-72 overflow-y-auto">
                {overdueReturns.length > 0 && (
                  <div>
                    <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider block mb-1">
                      Devoluciones Atrasadas ({overdueReturns.length})
                    </span>
                    {overdueReturns.map((ev) => (
                      <div
                        key={ev.id}
                        onClick={() => {
                          onNavigate('returns');
                          setShowAlertsMenu(false);
                        }}
                        className="p-2 rounded bg-rose-950/40 border border-rose-800/40 hover:bg-rose-900/40 cursor-pointer transition mb-1"
                      >
                        <div className="font-medium text-rose-200">{ev.name}</div>
                        <div className="text-[10px] text-rose-400">
                          Prevista: {new Date(ev.returnDate).toLocaleDateString()} — Cliente: {ev.clientName}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {criticalIncidents.length > 0 && (
                  <div>
                    <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block mb-1">
                      Averías Técnicas Críticas ({criticalIncidents.length})
                    </span>
                    {criticalIncidents.map((inc) => (
                      <div
                        key={inc.id}
                        onClick={() => {
                          onNavigate('maintenance');
                          setShowAlertsMenu(false);
                        }}
                        className="p-2 rounded bg-amber-950/40 border border-amber-800/40 hover:bg-amber-900/40 cursor-pointer transition mb-1"
                      >
                        <div className="font-medium text-amber-200">{inc.itemName}</div>
                        <div className="text-[10px] text-amber-400">
                          {inc.code} — {inc.description}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {lowStockItems.length > 0 && (
                  <div>
                    <span className="text-[11px] font-semibold text-orange-400 uppercase tracking-wider block mb-1">
                      Stock Bajo Mínimo ({lowStockItems.length})
                    </span>
                    {lowStockItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          onNavigate('inventory');
                          setShowAlertsMenu(false);
                        }}
                        className="p-2 rounded bg-orange-950/30 border border-orange-800/30 hover:bg-orange-900/30 cursor-pointer transition mb-1"
                      >
                        <div className="font-medium text-orange-200">{item.name}</div>
                        <div className="text-[10px] text-orange-400">
                          Disponibles: {item.availableQuantity} {item.unit} (Mínimo: {item.minStock})
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {totalAlerts === 0 && (
                  <div className="text-center py-6 text-zinc-400">
                    ✓ Sin incidencias críticas ni alertas de material pendientes.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Role & Administration Widget */}
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <div className="flex items-center gap-1.5">
              <div
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-xs"
                title="Sesión de Administrador Jefe activa"
              >
                <span>👑</span>
                <span className="hidden sm:inline">Admin Jefe</span>
              </div>

              <button
                onClick={() => onNavigate('users')}
                className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0d1117] hover:bg-[#21262d] text-cyan-300 border border-cyan-800/40 text-xs font-semibold transition cursor-pointer"
                title="Gestionar usuarios registrados con Google y asignar roles"
              >
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span>Gestión de Roles</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold ${roleLabels[currentRole].color}`}
                title={`Rol asignado por el Administrador: ${roleLabels[currentRole].label}`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{roleLabels[currentRole].label}</span>
              </div>

              <button
                onClick={() => setShowAdminModal(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition cursor-pointer shadow-xs"
                title="Iniciar sesión con usuario y contraseña única de Administrador Jefe"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Acceso Admin</span>
              </button>
            </div>
          )}
        </div>

        {/* User Profile & Auth */}
        <div className="flex items-center gap-2 pl-2 border-l border-[#30363d]">
          {userProfile ? (
            <div className="flex items-center gap-2">
              {(userProfile.avatar || currentUser?.photoURL) ? (
                <img
                  src={(userProfile.avatar || currentUser?.photoURL) as string}
                  alt={userProfile?.name || 'Usuario'}
                  className="w-8 h-8 rounded-full object-cover border border-cyan-500/50"
                  title={`${userProfile?.name} (${userProfile?.email})`}
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-300 font-bold text-xs"
                  title={userProfile?.email}
                >
                  {userProfile?.name?.charAt(0) || 'U'}
                </div>
              )}
              <div className="hidden xl:block leading-tight text-left">
                <span className="block text-xs font-bold text-white truncate max-w-[120px]">
                  {userProfile?.name?.split(' ')[0]}
                </span>
                <span className="block text-[10px] text-zinc-400 truncate max-w-[120px]">
                  {roleLabels[currentRole].label.split(' ')[0]}
                </span>
              </div>
              <button
                onClick={logout}
                className="p-1.5 text-zinc-400 hover:text-rose-400 transition cursor-pointer"
                title="Cerrar sesión y volver al login"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={loginWithGoogle}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition cursor-pointer"
                title="Registrarse o iniciar sesión directamente con cuenta de Google Workspace"
              >
                <LogIn className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Google Login</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Admin Login Modal (Unique Username & Password) */}
      <AdminLoginModal
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
        onSuccess={() => onNavigate('dashboard')}
      />
    </header>
  );
};
