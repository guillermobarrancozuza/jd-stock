import React, { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext.tsx';
import { InventoryProvider } from './context/InventoryContext.tsx';
import { testConnection } from './lib/firebase.ts';
import { Navbar } from './components/layout/Navbar.tsx';
import { Sidebar } from './components/layout/Sidebar.tsx';
import { DashboardView } from './components/dashboard/DashboardView.tsx';
import { InventoryView } from './components/inventory/InventoryView.tsx';
import { UnitsView } from './components/inventory/UnitsView.tsx';
import { CategoriesView } from './components/inventory/CategoriesView.tsx';
import { LocationsView } from './components/inventory/LocationsView.tsx';
import { EventsView } from './components/events/EventsView.tsx';
import { DispatchesView } from './components/dispatches/DispatchesView.tsx';
import { ReturnsView } from './components/returns/ReturnsView.tsx';
import { MaintenanceView } from './components/maintenance/MaintenanceView.tsx';
import { PurchasesView } from './components/purchases/PurchasesView.tsx';
import { InventoryAuditView } from './components/audit/InventoryAuditView.tsx';
import { ClientsSuppliersView } from './components/clients/ClientsSuppliersView.tsx';
import { MovementsView } from './components/movements/MovementsView.tsx';
import { ReportsView } from './components/reports/ReportsView.tsx';
import { ContractsView } from './components/contracts/ContractsView.tsx';
import { UsersManagementView } from './components/users/UsersManagementView.tsx';
import { LoginPage } from './components/auth/LoginPage.tsx';
import { Clock } from 'lucide-react';

import { useAuth } from './context/AuthContext.tsx';

function MainApp() {
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [initialDispatchEventId, setInitialDispatchEventId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { canViewContracts, canManageUsers } = useAuth();

  // If user role is not admin, prevent access to contracts and users views
  useEffect(() => {
    if (!canViewContracts && currentView === 'contracts') {
      setCurrentView('dashboard');
    }
    if (!canManageUsers && currentView === 'users') {
      setCurrentView('dashboard');
    }
  }, [canViewContracts, canManageUsers, currentView]);

  // Validate connection to Firestore on boot as required by Firebase skill
  useEffect(() => {
    testConnection();
  }, []);

  const handleOpenQuickAction = (
    action: 'dispatch' | 'return' | 'incident' | 'item' | 'purchase'
  ) => {
    if (action === 'dispatch') setCurrentView('dispatches');
    else if (action === 'return') setCurrentView('returns');
    else if (action === 'incident') setCurrentView('maintenance');
    else if (action === 'item') setCurrentView('inventory');
    else if (action === 'purchase') setCurrentView('purchases');
  };

  const handleOpenDispatchForEvent = (eventId: string) => {
    setInitialDispatchEventId(eventId);
    setCurrentView('dispatches');
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3] flex flex-col">
      {/* Top Navigation */}
      <Navbar
        onNavigate={setCurrentView}
        onOpenQuickAction={handleOpenQuickAction}
        searchQuery={globalSearch}
        onSearchChange={setGlobalSearch}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        isMobileMenuOpen={isMobileMenuOpen}
      />

      <div className="flex flex-1 relative">
        {/* Left Desktop Sidebar */}
        <div className="hidden lg:block shrink-0">
          <Sidebar currentView={currentView} onNavigate={setCurrentView} />
        </div>

        {/* Mobile Drawer Overlay */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="fixed inset-0 bg-black/80 backdrop-blur-xs transition-opacity animate-in fade-in"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="relative z-50 w-72 max-w-[85vw] h-full bg-[#161b22] border-r border-[#30363d] overflow-y-auto shadow-2xl animate-in slide-in-from-left">
              <Sidebar
                currentView={currentView}
                onNavigate={setCurrentView}
                onClose={() => setIsMobileMenuOpen(false)}
              />
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
          {currentView === 'dashboard' && (
            <DashboardView
              onNavigate={setCurrentView}
              onOpenQuickAction={handleOpenQuickAction}
            />
          )}

          {currentView === 'inventory' && (
            <InventoryView searchQuery={globalSearch} />
          )}

          {currentView === 'units' && <UnitsView />}

          {currentView === 'categories' && <CategoriesView />}

          {currentView === 'locations' && <LocationsView />}

          {currentView === 'events' && (
            <EventsView onOpenDispatch={handleOpenDispatchForEvent} />
          )}

          {currentView === 'contracts' && <ContractsView onNavigate={setCurrentView} />}

          {currentView === 'dispatches' && (
            <DispatchesView
              initialEventId={initialDispatchEventId}
              onClearInitialEvent={() => setInitialDispatchEventId(null)}
            />
          )}

          {currentView === 'returns' && <ReturnsView />}

          {currentView === 'maintenance' && <MaintenanceView />}

          {currentView === 'purchases' && <PurchasesView />}

          {currentView === 'audit' && <InventoryAuditView />}

          {currentView === 'partners' && <ClientsSuppliersView />}

          {currentView === 'movements' && <MovementsView />}

          {currentView === 'reports' && <ReportsView />}

          {currentView === 'users' && <UsersManagementView />}
        </main>
      </div>
    </div>
  );
}

function PendingApprovalView() {
  const { userProfile, logout } = useAuth();
  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3] flex flex-col items-center justify-center p-4">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto shadow-md shadow-amber-500/10">
          <Clock className="w-8 h-8 animate-pulse" />
        </div>
        <h2 className="text-lg font-bold text-white">Registro con Google Completado</h2>
        <p className="text-xs text-zinc-300">
          Hola, <strong className="text-white">{userProfile?.name}</strong> (<span className="font-mono text-zinc-400">{userProfile?.email}</span>).
        </p>
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs text-left space-y-1">
          <span className="font-bold block text-amber-200">⏳ Pendiente de asignación de rol:</span>
          <span>
            Tu cuenta ha sido registrada con éxito. Solo el <strong>ADMINISTRADOR JEFE</strong> puede asignarte tu rol de trabajo (<strong>Encargado de Almacén</strong> o <strong>Técnico</strong>) para darte acceso al inventario y albaranes.
          </span>
        </div>
        <p className="text-[11px] text-zinc-500">
          Pide al Administrador Jefe que active tu rol desde el panel de Personal.
        </p>
        <button
          onClick={logout}
          className="w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition cursor-pointer"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

function RootApp() {
  const { isAuthenticated, userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-zinc-400 font-mono">Cargando JD Control de Stock...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  if (userProfile?.role === 'pending') {
    return <PendingApprovalView />;
  }

  return <MainApp />;
}

export default function App() {
  return (
    <AuthProvider>
      <InventoryProvider>
        <RootApp />
      </InventoryProvider>
    </AuthProvider>
  );
}

