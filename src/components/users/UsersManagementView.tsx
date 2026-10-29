import React, { useState } from 'react';
import {
  Users,
  Shield,
  ShieldCheck,
  KeyRound,
  Lock,
  Search,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Sparkles,
  Mail,
  Calendar,
  Save,
  Copy,
  Check,
  Eye,
  EyeOff,
  UserPlus,
  RefreshCw,
  X,
  RotateCcw,
  Trash2,
  Database,
} from 'lucide-react';
import { useAuth, DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_LOGIN } from '../../context/AuthContext.tsx';
import { useInventory } from '../../context/InventoryContext.tsx';
import { UserProfile, UserRole } from '../../types/inventory.ts';

export const UsersManagementView: React.FC = () => {
  const {
    userProfile,
    isAdmin,
    allUsers,
    updateUserRole,
    adminMasterPassword,
    updateAdminPassword,
  } = useAuth();
  const { seedInitialData, clearAllDemoData } = useInventory();

  const [showDemoModal, setShowDemoModal] = useState(false);
  const [demoModalTab, setDemoModalTab] = useState<'wipe' | 'users'>('wipe');
  const [isSeedingDemo, setIsSeedingDemo] = useState(false);
  const [isClearingDemo, setIsClearingDemo] = useState(false);
  const [confirmWipeOpen, setConfirmWipeOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUpdatingUser, setIsUpdatingUser] = useState<string | null>(null);

  // Master password change state
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // If not admin, show access denied notice
  if (!isAdmin) {
    return (
      <div className="p-8 text-center bg-[#161b22] border border-[#30363d] rounded-2xl max-w-xl mx-auto my-12">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto mb-4">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Acceso Exclusivo al Administrador Jefe</h2>
        <p className="text-sm text-zinc-400 mb-6">
          Solo el administrador jefe tiene permisos para gestionar personal, asignar roles y configurar la contraseña única maestra.
        </p>
      </div>
    );
  }

  const roleDefinitions: Record<
    UserRole,
    { label: string; badge: string; desc: string; icon: string }
  > = {
    admin: {
      label: 'Administrador (Jefe)',
      badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      desc: 'Control absoluto del sistema: contratos, presupuestos, cobro del 10%, gestión de roles y finanzas.',
      icon: '👑',
    },
    warehouse_manager: {
      label: 'Encargado de Almacén',
      badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      desc: 'Gestión de stock, almacenes, entradas, albaranes de salida y taller SAT. Sin acceso a contratos ni dinero.',
      icon: '📦',
    },
    technician: {
      label: 'Técnico',
      badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
      desc: 'Preparación y picking de salidas, lecturas QR de albaranes y partes de avería SAT. Sin acceso a contratos ni dinero.',
      icon: '🔧',
    },
    pending: {
      label: 'Pendiente de Asignación',
      badge: 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold animate-pulse',
      desc: 'Usuario recién registrado con Google. Esperando que el Administrador Jefe le asigne su rol.',
      icon: '⏳',
    },
  };

  const filteredUsers = allUsers.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const totalAdmins = allUsers.filter((u) => u.role === 'admin').length;
  const totalManagers = allUsers.filter((u) => u.role === 'warehouse_manager').length;
  const totalTechnicians = allUsers.filter((u) => u.role === 'technician').length;
  const totalPending = allUsers.filter((u) => u.role === 'pending').length;

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      setIsUpdatingUser(userId);
      setErrorMessage(null);
      await updateUserRole(userId, newRole);
      setSuccessMessage(`Rol actualizado con éxito a "${roleDefinitions[newRole].label}".`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Error al actualizar rol');
    } finally {
      setIsUpdatingUser(null);
    }
  };

  const handleSaveMasterPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (newPassword.trim().length < 6) {
      setErrorMessage('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Las dos contraseñas introducidas no coinciden.');
      return;
    }

    try {
      setIsSavingPassword(true);
      await updateAdminPassword(newPassword.trim());
      setSuccessMessage('✓ Contraseña única de Administrador Jefe actualizada correctamente.');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordSection(false);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Error al actualizar contraseña');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleCopyGoogleInstructions = () => {
    const text =
      `Para registrarte en JD Control de Stock, accede a la aplicación y pulsa en "Google Login" con tu cuenta de correo de Google. El Administrador Jefe activará tu rol técnico de inmediato.`;
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCreateTestUser = () => {
    const testId = `usr-test-${Date.now()}`;
    const testUser: UserProfile = {
      id: testId,
      name: 'Técnico Demo (Google)',
      email: `tecnico.demo.${Math.floor(Math.random() * 900 + 100)}@gmail.com`,
      role: 'pending',
      provider: 'google',
      status: 'pending',
      lastLogin: new Date().toISOString(),
      assignedBy: 'Pendiente de asignación por Admin Jefe',
      createdAt: new Date().toISOString(),
    };
    const saved = localStorage.getItem('jd_all_users');
    const list: UserProfile[] = saved ? JSON.parse(saved) : allUsers;
    const updated = [testUser, ...list.filter((u) => u.id !== testId)];
    localStorage.setItem('jd_all_users', JSON.stringify(updated));
    setSuccessMessage('✓ Creado usuario de prueba en estado "Pendiente". Puedes asignarle un rol para probar.');
    setShowDemoModal(false);
    setTimeout(() => setSuccessMessage(null), 4000);
    // Reload state if possible
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-linear-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-black font-black shadow-lg shadow-amber-500/20 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-wide">
                  Gestión de Personal & Roles (Google)
                </h1>
                <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded uppercase">
                  Exclusivo Administrador
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
                Los técnicos y encargados se registran directamente iniciando sesión con Google. Solo tú como <strong>Administrador Jefe</strong> puedes asignar los roles del personal.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowPasswordSection(!showPasswordSection)}
              className="px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-xs"
            >
              <KeyRound className="w-4 h-4" />
              <span>Contraseña Única</span>
            </button>

            <button
              onClick={handleCopyGoogleInstructions}
              className="px-3 py-2 rounded-xl bg-[#0d1117] hover:bg-[#21262d] text-zinc-300 border border-[#30363d] text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
              title="Copiar instrucciones de registro de Google para nuevos técnicos"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-cyan-400" />}
              <span>{copiedLink ? 'Copiado' : 'Invitar Personal'}</span>
            </button>

            {/* Unique DEMO button in administration requested by user */}
            <button
              onClick={() => setShowDemoModal(true)}
              className="px-3 py-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/40 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              title="Panel temporal DEMO para pruebas de administración"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>DEMO</span>
            </button>
          </div>
        </div>

        {/* Notifications */}
        {successMessage && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-2 text-xs font-semibold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-2 text-xs font-semibold animate-in fade-in">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Admin Unique Password Configuration Card */}
      {showPasswordSection && (
        <div className="bg-[#161b22] border-2 border-amber-500/40 rounded-2xl p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between pb-3 border-b border-[#30363d]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Configuración de Login y Contraseña Única del Administrador Jefe
                </h3>
                <p className="text-[11px] text-zinc-400">
                  Esta contraseña te permite autenticarte de forma única en cualquier momento.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowPasswordSection(false)}
              className="text-zinc-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-[#30363d]"
            >
              ✕ Cerrar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-[#0d1117] border border-[#30363d] space-y-2">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                Credenciales de Acceso Actuales
              </span>
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Usuario de acceso:</span>
                  <span className="font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                    {DEFAULT_ADMIN_LOGIN}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Correo del Administrador:</span>
                  <span className="font-mono text-zinc-200">{DEFAULT_ADMIN_EMAIL}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Contraseña única actual:</span>
                  <span className="font-mono text-cyan-300 font-bold bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40">
                    {showPasswordText ? adminMasterPassword : '••••••••••••'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordText(!showPasswordText)}
                className="mt-2 text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold cursor-pointer"
              >
                {showPasswordText ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                <span>{showPasswordText ? 'Ocultar contraseña' : 'Ver contraseña actual'}</span>
              </button>
            </div>

            <form onSubmit={handleSaveMasterPassword} className="space-y-3">
              <div>
                <label className="block text-zinc-300 font-semibold mb-1 text-[11px]">
                  Nueva Contraseña Maestra Única
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Introduce nueva contraseña segura..."
                  required
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1 text-[11px]">
                  Confirmar Nueva Contraseña
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite la nueva contraseña..."
                  required
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSavingPassword || !newPassword}
                className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingPassword ? 'Guardando...' : 'Guardar Nueva Contraseña Única'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d]">
          <span className="text-zinc-400 text-[11px] block font-medium">Personal Registrado</span>
          <span className="text-2xl font-bold text-white mt-1 block">{allUsers.length}</span>
          <span className="text-[10px] text-zinc-500 block mt-0.5">Google Workspace & Maestros</span>
        </div>

        <div className={`p-4 rounded-xl border ${totalPending > 0 ? 'bg-amber-500/10 border-amber-500/50 shadow-md shadow-amber-500/10' : 'bg-[#161b22] border-[#30363d]'}`}>
          <span className="text-amber-400 text-[11px] block font-semibold flex items-center gap-1">
            <span>⏳</span> Pendientes de Rol
          </span>
          <span className={`text-2xl font-black mt-1 block ${totalPending > 0 ? 'text-amber-300 animate-pulse' : 'text-zinc-400'}`}>
            {totalPending}
          </span>
          <span className="text-[10px] text-amber-400/80 block mt-0.5">Registros Google por asignar</span>
        </div>

        <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30">
          <span className="text-amber-400 text-[11px] block font-semibold flex items-center gap-1">
            <span>👑</span> Administradores (Jefes)
          </span>
          <span className="text-2xl font-black text-amber-300 mt-1 block">{totalAdmins}</span>
          <span className="text-[10px] text-amber-400/80 block mt-0.5">Acceso total & Contratos</span>
        </div>

        <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
          <span className="text-emerald-400 text-[11px] block font-semibold flex items-center gap-1">
            <span>📦</span> Encargados de Almacén
          </span>
          <span className="text-2xl font-black text-emerald-300 mt-1 block">{totalManagers}</span>
          <span className="text-[10px] text-emerald-400/80 block mt-0.5">Stock, Albaranes y SAT</span>
        </div>

        <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/30">
          <span className="text-blue-400 text-[11px] block font-semibold flex items-center gap-1">
            <span>🔧</span> Técnicos Audiovisuales
          </span>
          <span className="text-2xl font-black text-blue-300 mt-1 block">{totalTechnicians}</span>
          <span className="text-[10px] text-blue-400/80 block mt-0.5">Picking, Salidas y Averías</span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o correo de Google..."
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {(
            [
              { id: 'all', label: 'Todos' },
              { id: 'pending', label: `⏳ Pendientes (${totalPending})` },
              { id: 'admin', label: '👑 Administradores' },
              { id: 'warehouse_manager', label: '📦 Encargados' },
              { id: 'technician', label: '🔧 Técnicos' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setRoleFilter(tab.id)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition shrink-0 cursor-pointer ${
                roleFilter === tab.id
                  ? 'bg-amber-500 text-black shadow-xs font-bold'
                  : 'bg-[#0d1117] text-zinc-400 hover:text-white border border-[#30363d]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Users List & Role Assignment Table */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 border-b border-[#30363d] flex items-center justify-between bg-[#161b22]">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan-400" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              Listado de Personas y Asignación de Roles ({filteredUsers.length})
            </h2>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">
            Solo el Administrador Jefe puede modificar roles
          </span>
        </div>

        <div className="divide-y divide-[#30363d] text-xs">
          {filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">
              No se han encontrado usuarios con los criterios de búsqueda.
            </div>
          ) : (
            filteredUsers.map((user) => {
              const roleMeta = roleDefinitions[user.role] || roleDefinitions.technician;
              const isCurrentUser = userProfile?.id === user.id || userProfile?.email === user.email;
              const isPrimaryAdmin = user.provider === 'admin_credentials' || user.id === 'usr-admin-master';

              return (
                <div
                  key={user.id}
                  className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#1c2128] transition"
                >
                  {/* Left: User details */}
                  <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-10 h-10 rounded-full object-cover border border-[#30363d] shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-linear-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 font-bold text-sm shrink-0">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-sm truncate">{user.name}</span>
                        {isCurrentUser && (
                          <span className="text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded">
                            Tú (Sesión activa)
                          </span>
                        )}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${roleMeta.badge}`}>
                          {roleMeta.icon} {roleMeta.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-zinc-400 mt-1 flex-wrap">
                        <span className="flex items-center gap-1 font-mono text-zinc-300">
                          <Mail className="w-3 h-3 text-zinc-500" />
                          {user.email}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {user.provider === 'google' ? 'Acceso con Google' : 'Acceso Maestro'}
                        </span>
                        {user.lastLogin && (
                          <span className="text-[10px] text-zinc-500">
                            Último acceso: {new Date(user.lastLogin).toLocaleDateString('es-ES')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Role Assignment Dropdown / Selector */}
                  <div className="flex items-center gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[#30363d]/50">
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold mb-1">
                        Asignar Rol
                      </span>
                      <div className="flex items-center gap-1.5">
                        {user.role === 'pending' && (
                          <div className="flex items-center gap-1 mr-1">
                            <button
                              type="button"
                              onClick={() => handleRoleChange(user.id, 'technician')}
                              className="px-2 py-1 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 text-[10px] font-bold transition cursor-pointer"
                              title="Asignar directamente como Técnico"
                            >
                              + Técnico
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRoleChange(user.id, 'warehouse_manager')}
                              className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold transition cursor-pointer"
                              title="Asignar directamente como Encargado de Almacén"
                            >
                              + Encargado
                            </button>
                          </div>
                        )}
                        <select
                          value={user.role}
                          disabled={isUpdatingUser === user.id || (isPrimaryAdmin && isCurrentUser)}
                          onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                          className={`bg-[#0d1117] border rounded-lg px-2.5 py-1.5 text-xs text-white font-medium focus:outline-none focus:border-amber-500 cursor-pointer disabled:opacity-50 ${user.role === 'pending' ? 'border-amber-500/80 text-amber-300 font-bold' : 'border-[#30363d]'}`}
                        >
                          <option value="pending">⏳ Pendiente (Sin rol asignado)</option>
                          <option value="technician">🔧 Técnico (Salidas, picking, SAT)</option>
                          <option value="warehouse_manager">📦 Encargado de Almacén (Stock, albaranes, SAT)</option>
                          <option value="admin">👑 Administrador (Acceso total & Contratos)</option>
                        </select>

                        {isUpdatingUser === user.id && (
                          <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Permissions Reference Matrix */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-[#30363d]">
          <Shield className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Matriz de Permisos por Rol (Normativa Empresarial)
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-base">👑</span>
              <strong className="text-amber-300 font-bold">Administrador (Jefe)</strong>
            </div>
            <p className="text-[11px] text-zinc-400">
              Acceso sin restricciones a toda la empresa:
            </p>
            <ul className="space-y-1 text-[11px] text-zinc-300">
              <li>✓ Generar contratos y presupuestos</li>
              <li>✓ Pasarela de pago y abono 10% reserva</li>
              <li>✓ Ver precios de coste e informes económicos</li>
              <li>✓ Asignar roles a los usuarios de Google</li>
              <li>✓ Cambiar contraseña única del administrador</li>
              <li>✓ Control completo de inventario y almacenes</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-base">📦</span>
              <strong className="text-emerald-300 font-bold">Encargado de Almacén</strong>
            </div>
            <p className="text-[11px] text-zinc-400">
              Control operativo del material y logística:
            </p>
            <ul className="space-y-1 text-[11px] text-zinc-300">
              <li>✓ Altas, bajas y edición de inventario</li>
              <li>✓ Albaranes de salida y preparación de pedidos</li>
              <li>✓ Recepción y control de devoluciones</li>
              <li>✓ Taller SAT y partes de averías</li>
              <li>✓ Auditorías y compras de reposición</li>
              <li className="text-rose-400">✗ Sin acceso a contratos ni reservas</li>
              <li className="text-rose-400">✗ Sin acceso a datos económicos ni costes</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/30 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-base">🔧</span>
              <strong className="text-blue-300 font-bold">Técnico Audiovisual</strong>
            </div>
            <p className="text-[11px] text-zinc-400">
              Operativa de campo, picking y partes:
            </p>
            <ul className="space-y-1 text-[11px] text-zinc-300">
              <li>✓ Consulta de catálogo y ubicación de material</li>
              <li>✓ Preparación de salidas (picking y lectura QR)</li>
              <li>✓ Registrar devoluciones de eventos</li>
              <li>✓ Dar de alta averías en equipos al SAT</li>
              <li className="text-rose-400">✗ Sin acceso a contratos ni reservas</li>
              <li className="text-rose-400">✗ Sin acceso a información económica</li>
              <li className="text-rose-400">✗ No puede asignar ni cambiar roles</li>
            </ul>
          </div>
        </div>
      </div>

      {/* DEMO Modal (Temporary in administration) */}
      {showDemoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#161b22] border border-[#30363d] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="p-5 border-b border-[#30363d] flex items-center justify-between bg-linear-to-r from-[#161b22] to-[#1c2128]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Herramientas DEMO</span>
                    <span className="text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/40 px-1.5 py-0.2 rounded font-semibold">
                      ADMINISTRACIÓN
                    </span>
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Opciones de control para pruebas y puesta a cero del almacén
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowDemoModal(false);
                  setConfirmWipeOpen(false);
                }}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-[#30363d] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-[#30363d] bg-[#0d1117] px-5 pt-3 gap-2">
              <button
                type="button"
                onClick={() => setDemoModalTab('wipe')}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
                  demoModalTab === 'wipe'
                    ? 'border-rose-500 text-rose-400'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Empezar desde 0 / Datos</span>
              </button>

              <button
                type="button"
                onClick={() => setDemoModalTab('users')}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
                  demoModalTab === 'users'
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Simulación de Personal</span>
              </button>
            </div>

            {/* Tab 1: Wipe / Start from 0 */}
            {demoModalTab === 'wipe' && (
              <div className="p-6 space-y-4 text-xs">
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs space-y-2">
                  <div className="flex items-center gap-2 text-rose-400 font-bold">
                    <Trash2 className="w-4 h-4 shrink-0" />
                    <span>Vaciar Almacén para Empezar con tu Material Real</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-zinc-300">
                    Esta opción elimina por completo todos los artículos de muestra (Shure, Robe, Yamaha, etc.), unidades físicas con número de serie, movimientos históricos, albaranes y contratos de prueba.
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    Tu usuario de <strong>Administrador Jefe</strong>, los almacenes y las categorías técnicas se conservarán limpios para que puedas empezar a cargar tu flota real.
                  </p>

                  {!confirmWipeOpen ? (
                    <button
                      type="button"
                      onClick={() => setConfirmWipeOpen(true)}
                      className="mt-2 w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-md shadow-rose-600/20 text-xs"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Eliminar todos los datos DEMO y dejar a 0</span>
                    </button>
                  ) : (
                    <div className="mt-3 p-3 rounded-lg bg-[#0d1117] border border-rose-500/60 space-y-2.5 animate-in fade-in">
                      <div className="text-amber-300 font-bold text-xs flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>¿Estás seguro de que deseas vaciar todos los datos demo?</span>
                      </div>
                      <p className="text-[11px] text-zinc-400">
                        El catálogo se quedará en 0 artículos y listo para que des de alta tus propios equipos.
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          disabled={isClearingDemo}
                          onClick={async () => {
                            try {
                              setIsClearingDemo(true);
                              await clearAllDemoData();
                              setSuccessMessage('✓ Se han eliminado todos los datos de demostración. El catálogo está a 0 listo para meter tu material.');
                              setShowDemoModal(false);
                              setConfirmWipeOpen(false);
                              setTimeout(() => setSuccessMessage(null), 5000);
                            } catch (e) {
                              setErrorMessage('Error al vaciar los datos.');
                            } finally {
                              setIsClearingDemo(false);
                            }
                          }}
                          className="flex-1 py-2 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition cursor-pointer disabled:opacity-50"
                        >
                          {isClearingDemo ? 'Vaciando almacén...' : 'Sí, vaciar todo ahora'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmWipeOpen(false)}
                          className="py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Reload demo option */}
                <div className="pt-2 border-t border-[#30363d]/60">
                  <span className="text-[11px] text-zinc-400 block mb-2">
                    ¿Quieres volver a tener datos de prueba más adelante?
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        setIsSeedingDemo(true);
                        await seedInitialData();
                        setSuccessMessage('✓ Datos de demostración restaurados correctamente.');
                        setShowDemoModal(false);
                        setTimeout(() => setSuccessMessage(null), 4000);
                      } catch (e) {
                        setErrorMessage('Error al restaurar datos de demo.');
                      } finally {
                        setIsSeedingDemo(false);
                      }
                    }}
                    disabled={isSeedingDemo}
                    className="w-full py-2 px-3 rounded-xl bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] hover:border-amber-500/40 text-zinc-300 font-semibold flex items-center justify-between transition cursor-pointer text-xs"
                  >
                    <div className="flex items-center gap-2 text-left">
                      <RotateCcw className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <div>
                        <span className="block text-zinc-200">Volver a Cargar Datos Demo (Shure, Robe, Yamaha...)</span>
                        <span className="text-[10px] text-zinc-500 font-normal">Restablece 8 equipos con reservas y stock de muestra</span>
                      </div>
                    </div>
                    <span className="text-zinc-500 text-xs">➔</span>
                  </button>
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDemoModal(false);
                      setConfirmWipeOpen(false);
                    }}
                    className="w-full py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition cursor-pointer text-xs"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}

            {/* Tab 2: Personnel Simulation */}
            {demoModalTab === 'users' && (
              <div className="p-6 space-y-4 text-xs">
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-200 text-[11px] leading-relaxed">
                  Esta herramienta te permite simular un técnico que se registra por primera vez mediante Google, para que puedas verificar cómo el Administrador Jefe le asigna rol.
                </div>

                <button
                  type="button"
                  onClick={handleCreateTestUser}
                  className="w-full py-2.5 px-3.5 rounded-xl bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] hover:border-purple-500/50 text-white font-semibold flex items-center justify-between transition cursor-pointer text-xs"
                >
                  <div className="flex items-center gap-2.5 text-left">
                    <UserPlus className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div>
                      <span className="block font-bold">Simular Usuario Google Pendiente</span>
                      <span className="text-[10px] text-zinc-400 font-normal">Crea un técnico ficticio para probar la asignación de rol</span>
                    </div>
                  </div>
                  <span className="text-zinc-500 text-xs">➔</span>
                </button>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDemoModal(false);
                      setConfirmWipeOpen(false);
                    }}
                    className="w-full py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition cursor-pointer text-xs"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
