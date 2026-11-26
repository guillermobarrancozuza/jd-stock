import React, { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { InventoryProvider, useInventory } from './context/InventoryContext.tsx';
import { db, testConnection } from './lib/firebase.ts';
import { Navbar } from './components/layout/Navbar.tsx';
import { Sidebar } from './components/layout/Sidebar.tsx';
import { DashboardView } from './components/dashboard/DashboardView.tsx';
import { InventoryView } from './components/inventory/InventoryView.tsx';
import { UnitsView } from './components/inventory/UnitsView.tsx';
import { KitsAndCablesView } from './components/inventory/KitsAndCablesView.tsx';
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
import { OficinaView } from './components/office/OficinaView.tsx';
import { LoginPage } from './components/auth/LoginPage.tsx';
import { MobileScannerModal } from './components/scanner/MobileScannerModal.tsx';
import { QrScanResultModal } from './components/scanner/QrScanResultModal.tsx';
import { RemoteScannerApp } from './components/scanner/RemoteScannerApp.tsx';
import { RemoteScannerLinkModal } from './components/scanner/RemoteScannerLinkModal.tsx';
import { OfflineIndicator } from './components/pwa/OfflineIndicator.tsx';
import { findUnitOrItemByCode, ScannedMatchResult } from './lib/qrScannerUtils.ts';
import {
  getLocalDeviceId,
  isRemoteScannerModeFromUrl,
  ScannerBridgeDoc,
} from './lib/scannerBridge.ts';
import { Clock, CheckCircle2, X, Smartphone } from 'lucide-react';

function MainApp() {
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [initialDispatchEventId, setInitialDispatchEventId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isRemoteLinkModalOpen, setIsRemoteLinkModalOpen] = useState(false);
  const [isMobileScannerOnline, setIsMobileScannerOnline] = useState(false);
  const [lastRemoteScan, setLastRemoteScan] = useState<{ code: string; timestamp: string } | null>(null);
  const [remoteScanToast, setRemoteScanToast] = useState<string | null>(null);
  const [scannedQrResult, setScannedQrResult] = useState<ScannedMatchResult | null>(null);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const { currentUser, userProfile, isAdmin } = useAuth();
  const {
    items,
    itemUnits,
    equipmentKits,
    cableBoxes,
    consumables,
    contracts,
  } = useInventory();

  const urlQrHandledRef = useRef(false);
  const mountTimeRef = useRef<number>(Date.now());
  const lastRemoteScanIdRef = useRef<string | null>(null);
  const lastMobileHeartbeatRef = useRef<number>(0);
  const inventorySnapshotRef = useRef({
    items,
    itemUnits,
    equipmentKits,
    cableBoxes,
    consumables,
    contracts,
  });

  useEffect(() => {
    inventorySnapshotRef.current = { items, itemUnits, equipmentKits, cableBoxes, consumables, contracts };
  }, [items, itemUnits, equipmentKits, cableBoxes, consumables, contracts]);

  // Real-time Phone-to-PC QR Scanner Bridge Listener (linked automatically by logged-in user UID)
  useEffect(() => {
    if (!currentUser?.uid) return;
    const localDeviceId = getLocalDeviceId();
    const bridgeRef = doc(db, 'scanner_bridge', currentUser.uid);

    const unsubscribe = onSnapshot(
      bridgeRef,
      (snap) => {
        if (!snap.exists()) {
          setIsMobileScannerOnline(false);
          return;
        }
        const data = snap.data() as ScannerBridgeDoc;

        if (typeof data.mobileActiveAt === 'number') {
          lastMobileHeartbeatRef.current = data.mobileActiveAt;
          setIsMobileScannerOnline(Date.now() - data.mobileActiveAt < 45000);
        }

        if (
          data.scanId &&
          data.lastCode &&
          data.senderDeviceId &&
          data.senderDeviceId !== localDeviceId &&
          data.scanId !== lastRemoteScanIdRef.current &&
          typeof data.scannedAt === 'number' &&
          data.scannedAt >= mountTimeRef.current - 4000
        ) {
          lastRemoteScanIdRef.current = data.scanId;
          const timeLabel = new Date(data.scannedAt).toLocaleTimeString('es-ES');
          setLastRemoteScan({ code: data.lastCode, timestamp: timeLabel });
          setRemoteScanToast(data.lastCode);
          window.setTimeout(() => {
            setRemoteScanToast((curr) => (curr === data.lastCode ? null : curr));
          }, 3500);

          // Let active specialized screens (e.g. Dispatch QR Verification modal) consume the scan first
          const remoteEvent = new CustomEvent('jd-remote-qr-scan', {
            detail: {
              code: data.lastCode,
              scanId: data.scanId,
              senderName: data.senderName || 'Móvil',
            },
            cancelable: true,
          });
          const consumedByActiveView = !window.dispatchEvent(remoteEvent);

          if (!consumedByActiveView) {
            const inv = inventorySnapshotRef.current;
            const match = findUnitOrItemByCode(
              data.lastCode,
              inv.itemUnits,
              inv.items,
              inv.equipmentKits,
              inv.cableBoxes,
              inv.contracts,
              inv.consumables
            );
            setScannedQrResult(match);
          }
        }
      },
      (err) => {
        console.warn('[ScannerBridge] Listener error:', err?.message || err);
      }
    );

    const statusTimer = window.setInterval(() => {
      const lastBeat = lastMobileHeartbeatRef.current;
      setIsMobileScannerOnline(lastBeat > 0 && Date.now() - lastBeat < 45000);
    }, 10000);

    return () => {
      unsubscribe();
      window.clearInterval(statusTimer);
    };
  }, [currentUser?.uid]);

  // Strict Chief-Admin-only guard for OFICINA (contracts, roles, backups)
  useEffect(() => {
    if (
      !isAdmin &&
      ['oficina', 'oficina_backup', 'contracts', 'users'].includes(currentView)
    ) {
      setCurrentView('dashboard');
    }
  }, [isAdmin, currentView]);

  // Validate connection to Firestore on boot as required by Firebase skill
  useEffect(() => {
    testConnection();
  }, []);

  // Direct-on-screen QR opening when arriving from a scanned URL (?qr=... or ?code=...)
  useEffect(() => {
    if (urlQrHandledRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const qrParam = params.get('qr') || params.get('code');
    if (!qrParam) return;
    if (items.length === 0 && equipmentKits.length === 0 && cableBoxes.length === 0 && consumables.length === 0) return;

    urlQrHandledRef.current = true;
    const match = findUnitOrItemByCode(
      qrParam,
      itemUnits,
      items,
      equipmentKits,
      cableBoxes,
      contracts,
      consumables
    );
    setScannedQrResult(match);

    // Clean query string so refreshing does not re-trigger
    try {
      const cleanUrl = `${window.location.pathname}${window.location.hash || ''}`;
      window.history.replaceState({}, document.title, cleanUrl);
    } catch {
      // Ignore history errors in restricted iframe contexts
    }
  }, [items, itemUnits, equipmentKits, cableBoxes, consumables, contracts]);

  // Global USB / Bluetooth QR & Barcode scanner listener -> pops up directly on screen
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      const now = Date.now();
      if (now - lastKeyTime > 80) {
        buffer = '';
      }
      lastKeyTime = now;

      if (e.key === 'Enter') {
        if (buffer.trim().length >= 4) {
          const code = buffer.trim();
          buffer = '';
          const match = findUnitOrItemByCode(
            code,
            itemUnits,
            items,
            equipmentKits,
            cableBoxes,
            contracts,
            consumables
          );
          setScannedQrResult(match);
        } else {
          buffer = '';
        }
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, itemUnits, equipmentKits, cableBoxes, consumables, contracts]);

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
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenBackupModal={() => setCurrentView('oficina_backup')}
        onOpenRemoteLinkModal={() => setIsRemoteLinkModalOpen(true)}
        isMobileScannerOnline={isMobileScannerOnline}
      />

      <div className="flex flex-1 relative">
        {/* Left Desktop Sidebar */}
        <div className="hidden lg:block shrink-0">
          <Sidebar
            currentView={currentView}
            onNavigate={setCurrentView}
            onOpenScanner={() => setIsScannerOpen(true)}
            onOpenRemoteLinkModal={() => setIsRemoteLinkModalOpen(true)}
            isMobileScannerOnline={isMobileScannerOnline}
          />
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
                onOpenScanner={() => setIsScannerOpen(true)}
                onOpenRemoteLinkModal={() => setIsRemoteLinkModalOpen(true)}
                isMobileScannerOnline={isMobileScannerOnline}
              />
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
          {/* First-Entry Welcome Banner after Chief Admin approves worker role */}
          {userProfile &&
            !isAdmin &&
            userProfile.role !== 'pending' &&
            !welcomeDismissed &&
            localStorage.getItem(`jd_welcome_seen_${userProfile.id}_${userProfile.role}`) !== 'true' && (
              <div className="mb-5 p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-start justify-between gap-3 no-print animate-in fade-in">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="text-xs">
                    <div className="font-bold text-emerald-200">
                      ¡Acceso aprobado por el Administrador Jefe!
                    </div>
                    <p className="text-zinc-200 mt-0.5">
                      Bienvenido/a, <strong>{userProfile.name}</strong>. Ya tienes activo tu rol de{' '}
                      <strong className="text-emerald-300">
                        {userProfile.role === 'warehouse_manager'
                          ? 'Encargado de Almacén'
                          : 'Técnico Audiovisual'}
                      </strong>{' '}
                      y puedes trabajar y escanear códigos QR directamente en pantalla.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem(
                      `jd_welcome_seen_${userProfile.id}_${userProfile.role}`,
                      'true'
                    );
                    setWelcomeDismissed(true);
                  }}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer shrink-0"
                  title="Entendido"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

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

          {currentView === 'kits_cables' && <KitsAndCablesView />}

          {currentView === 'categories' && <CategoriesView />}

          {currentView === 'locations' && <LocationsView />}

          {currentView === 'events' && (
            <EventsView onOpenDispatch={handleOpenDispatchForEvent} />
          )}

          {currentView === 'oficina' && (
            <OficinaView initialTab="resumen" onNavigate={setCurrentView} />
          )}

          {currentView === 'contracts' && (
            <OficinaView initialTab="contracts" onNavigate={setCurrentView} />
          )}

          {currentView === 'users' && (
            <OficinaView initialTab="users" onNavigate={setCurrentView} />
          )}

          {currentView === 'oficina_backup' && (
            <OficinaView initialTab="backup" onNavigate={setCurrentView} />
          )}

          {currentView === 'dispatches' && (
            <DispatchesView
              initialEventId={initialDispatchEventId}
              onClearInitialEvent={() => setInitialDispatchEventId(null)}
              onOpenRemoteLinkModal={() => setIsRemoteLinkModalOpen(true)}
              isMobileScannerOnline={isMobileScannerOnline}
            />
          )}

          {currentView === 'returns' && <ReturnsView />}

          {currentView === 'maintenance' && <MaintenanceView />}

          {currentView === 'purchases' && <PurchasesView />}

          {currentView === 'audit' && <InventoryAuditView />}

          {currentView === 'partners' && <ClientsSuppliersView />}

          {currentView === 'movements' && <MovementsView />}

          {currentView === 'reports' && (
            <ReportsView onOpenBackupModal={() => setCurrentView('oficina_backup')} />
          )}
        </main>
      </div>

      {/* Optical Camera QR / Barcode Scanner Modal -> pops up directly on screen */}
      <MobileScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onNavigateToView={(view) => setCurrentView(view)}
        onQrResolved={(match) => {
          setIsScannerOpen(false);
          setScannedQrResult(match);
        }}
        onOpenRemoteLinkModal={() => {
          setIsScannerOpen(false);
          setIsRemoteLinkModalOpen(true);
        }}
      />

      {/* Phone-to-PC Direct Camera Link & QR Modal */}
      <RemoteScannerLinkModal
        isOpen={isRemoteLinkModalOpen}
        onClose={() => setIsRemoteLinkModalOpen(false)}
        isMobileOnline={isMobileScannerOnline}
        lastRemoteScan={lastRemoteScan}
      />

      {/* Floating Toast when a QR arrives in real time from user's linked phone */}
      {remoteScanToast && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl bg-emerald-600 text-white border border-emerald-400/50 shadow-2xl flex items-center gap-2 text-xs font-bold no-print animate-in fade-in">
          <Smartphone className="w-4 h-4 shrink-0" />
          <span>QR recibido desde tu móvil: {remoteScanToast}</span>
        </div>
      )}

      {/* Direct-on-Screen QR Result Popup (Kits, Cable Boxes, Units, Items, Contracts) */}
      <QrScanResultModal
        result={scannedQrResult}
        onClose={() => setScannedQrResult(null)}
        onScanAgain={() => {
          setScannedQrResult(null);
          setIsScannerOpen(true);
        }}
        onNavigate={(view) => {
          setScannedQrResult(null);
          setCurrentView(view);
        }}
      />

      {/* PWA Offline Connectivity Indicator */}
      <OfflineIndicator />
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
        <h2 className="text-lg font-bold text-white">Cuenta Creada — Esperando Aprobación</h2>
        <p className="text-xs text-zinc-300">
          Hola, <strong className="text-white">{userProfile?.name}</strong> (
          <span className="font-mono text-amber-300">
            @{userProfile?.username || userProfile?.email?.split('@')[0]}
          </span>
          ).
        </p>
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs text-left space-y-1.5">
          <span className="font-bold block text-amber-200">🔒 Acceso bloqueado hasta asignación de rol:</span>
          <span>
            Tu usuario y contraseña se han creado correctamente, pero no puedes usar ninguna función de la app hasta que el <strong>ADMINISTRADOR JEFE</strong> te asigne un rol (<strong>Técnico</strong> o <strong>Encargado de Almacén</strong>).
          </span>
        </div>
        <p className="text-[11px] text-zinc-400">
          En cuanto el Administrador Jefe active tu rol desde el panel de Personal, esta pantalla se desbloqueará automáticamente.
        </p>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>Comprobando aprobación en tiempo real...</span>
        </div>
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
  const { isAuthenticated, userProfile, isPending, loading } = useAuth();
  const [isRemoteScannerMode, setIsRemoteScannerMode] = useState<boolean>(() =>
    isRemoteScannerModeFromUrl()
  );

  const handleExitRemoteScanner = () => {
    setIsRemoteScannerMode(false);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('scanner');
      url.searchParams.delete('mode');
      window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
    } catch {
      // ignore history errors
    }
  };

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

  if (!userProfile || isPending || userProfile.role === 'pending' || userProfile.status === 'pending') {
    return <PendingApprovalView />;
  }

  if (isRemoteScannerMode) {
    return <RemoteScannerApp onExitToFullApp={handleExitRemoteScanner} />;
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

