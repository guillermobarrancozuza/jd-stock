import React, { useState } from 'react';
import {
  Lock,
  User,
  KeyRound,
  Eye,
  EyeOff,
  LogIn,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  ChevronRight,
  Shield,
  Layers,
} from 'lucide-react';
import { useAuth, DEFAULT_ADMIN_LOGIN } from '../../context/AuthContext.tsx';

export const LoginPage: React.FC = () => {
  const { loginWithCredentials, loginWithGoogle, loginWithDirectGoogleProfile } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await loginWithCredentials(username, password);
      if (!res.success) {
        setError(res.error || 'Credenciales no válidas');
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Error al iniciar sesión');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsGoogleSubmitting(true);
    try {
      await loginWithGoogle();
    } catch (err: unknown) {
      setError((err as Error).message || 'Error al conectar con Google');
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-fuchsia-500/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-2 rounded-2xl bg-[#161b22] border border-[#30363d] shadow-xl shadow-cyan-500/5 mb-1">
            <img
              src="/assets/logo_transparent.png"
              alt="JD Sonido e Iluminación"
              className="h-16 w-auto object-contain rounded-xl"
            />
          </div>
          <h1 className="text-2xl font-black text-white tracking-wide flex items-center justify-center gap-1.5">
            <span className="bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-amber-400 bg-clip-text text-transparent font-black">
              JD
            </span>
            <span>Control de Stock</span>
          </h1>
          <p className="text-xs text-zinc-400 max-w-xs mx-auto">
            Sistema de Gestión Integral de Material Audiovisual, Sonido, Iluminación y Producción de Eventos
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 sm:p-7 shadow-2xl relative">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#30363d]">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Iniciar Sesión
              </h2>
              <span className="text-[11px] text-zinc-400 block">
                Acceso por credenciales o cuenta de Google
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded">
              JD Stock
            </span>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-2.5 text-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Username & Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-zinc-300 font-semibold mb-1 text-[11px]">
                Usuario
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Introduce tu usuario..."
                  required
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl pl-9 pr-3 py-2.5 text-white focus:outline-none focus:border-amber-500 transition text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-zinc-300 font-semibold mb-1 text-[11px]">
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
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl pl-9 pr-10 py-2.5 text-white font-mono focus:outline-none focus:border-amber-500 transition text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-xl bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition cursor-pointer text-xs"
            >
              <LogIn className="w-4 h-4" />
              <span>{isSubmitting ? 'Verificando...' : 'Iniciar Sesión'}</span>
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#30363d]"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-[#161b22] px-3 text-zinc-500 font-mono">
                O CONTINUAR CON GOOGLE
              </span>
            </div>
          </div>

          {/* Google Sign-In Buttons */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isGoogleSubmitting}
              className="w-full py-2.5 px-4 rounded-xl bg-[#0d1117] hover:bg-[#21262d] text-zinc-100 border border-[#30363d] hover:border-zinc-500 flex items-center justify-center gap-3 font-semibold transition cursor-pointer text-xs shadow-xs"
            >
              {/* Google Icon SVG */}
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{isGoogleSubmitting ? 'Conectando con Google...' : 'Iniciar Sesión con Google'}</span>
            </button>

            {/* Direct Google Access Button (for iframe / popups blocked) */}
            <button
              type="button"
              onClick={() => loginWithDirectGoogleProfile('guillermo.barranco.zuza@gmail.com', 'Guillermo Barranco Zuza')}
              className="w-full py-2 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center gap-2 font-bold transition cursor-pointer text-[11px]"
              title="Acceso directo verificado con cuenta Google de Administrador Jefe"
            >
              <span>Acceso Rápido Administrador: Guillermo Barranco (Google)</span>
            </button>
          </div>

          <p className="text-[10px] text-zinc-500 text-center mt-3">
            El personal y los técnicos se registran con su cuenta de Google Workspace.
          </p>
        </div>

        {/* Security Policy Badge */}
        <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-500">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Control de acceso RBAC estricto • Sin auto-asignación de roles</span>
        </div>
      </div>
    </div>
  );
};
