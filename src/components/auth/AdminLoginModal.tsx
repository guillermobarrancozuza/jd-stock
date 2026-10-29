import React, { useState } from 'react';
import {
  Lock,
  KeyRound,
  ShieldCheck,
  X,
  Eye,
  EyeOff,
  UserCheck,
  Sparkles,
  AlertCircle,
  LogIn,
} from 'lucide-react';
import { useAuth, DEFAULT_ADMIN_LOGIN, DEFAULT_ADMIN_EMAIL } from '../../context/AuthContext.tsx';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { loginWithAdminCredentials, loginWithGoogle } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await loginWithAdminCredentials(username, password);
      if (res.success) {
        onSuccess?.();
        onClose();
      } else {
        setError(res.error || 'Credenciales no válidas');
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Error de autenticación');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-[#161b22] border border-[#30363d] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-5 border-b border-[#30363d] flex items-center justify-between bg-linear-to-r from-[#161b22] to-[#1c2128]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-black font-black shadow-lg shadow-amber-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Acceso Administrador Jefe</span>
              </h2>
              <p className="text-[11px] text-zinc-400">
                Introduce credenciales de Administrador Jefe
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-[#30363d] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-zinc-300 mb-1 font-semibold">
              Usuario de Administrador
            </label>
            <div className="relative">
              <UserCheck className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Introduce usuario..."
                required
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg pl-9 pr-3 py-2 text-white focus:outline-none focus:border-amber-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-zinc-300 mb-1 font-semibold">
              Contraseña
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Introduce tu contraseña..."
                required
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg pl-9 pr-10 py-2 text-white font-mono focus:outline-none focus:border-amber-500 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-xl bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>{isSubmitting ? 'Verificando...' : 'Acceder como Administrador Jefe'}</span>
            </button>
          </div>

          <div className="relative my-3">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#30363d]"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-[#161b22] px-2 text-zinc-500 font-mono">o si prefieres</span>
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              try {
                await loginWithGoogle();
                onClose();
              } catch (err) {
                // error handled in context
              }
            }}
            className="w-full py-2 px-3 rounded-xl bg-[#0d1117] hover:bg-[#21262d] text-zinc-200 border border-[#30363d] flex items-center justify-center gap-2 font-semibold transition cursor-pointer"
          >
            <LogIn className="w-4 h-4 text-cyan-400" />
            <span>Acceder mediante Cuenta de Google</span>
          </button>
        </form>

        <div className="p-4 bg-[#0d1117]/70 border-t border-[#30363d] text-[11px] text-zinc-400 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            Solo el Administrador Jefe tiene privilegios para ver contratos, finanzas y asignar roles al resto del equipo.
          </span>
        </div>
      </div>
    </div>
  );
};
