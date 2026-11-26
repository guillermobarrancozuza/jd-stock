import React, { useState } from 'react';
import {
  User,
  KeyRound,
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
  ShieldCheck,
  AlertCircle,
  Lock,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';

export const LoginPage: React.FC = () => {
  const { loginWithCredentials, registerWithCredentials } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const switchMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    setError(null);
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'register') {
      if (name.trim().length < 2) {
        setError('Introduce tu nombre y apellidos.');
        return;
      }
      if (password.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (mode === 'login') {
        const res = await loginWithCredentials(username, password);
        if (!res.success) {
          setError(res.error || 'Usuario o contraseña incorrectos.');
        }
      } else {
        const res = await registerWithCredentials(name, username, password);
        if (!res.success) {
          setError(res.error || 'No se pudo crear la cuenta.');
        }
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Error de autenticación.');
    } finally {
      setIsSubmitting(false);
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
            Gestión de Material Audiovisual, QR en Pantalla, Contratos y Albaranes
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 sm:p-7 shadow-2xl relative">
          {/* Mode Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#0d1117] border border-[#30363d] mb-5">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                mode === 'login'
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Iniciar Sesión</span>
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                mode === 'register'
                  ? 'bg-emerald-500 text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Crear Cuenta</span>
            </button>
          </div>

          <div className="mb-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              {mode === 'login' ? 'Iniciar Sesión (Admin y Personal)' : 'Registro de Usuarios (Solo Personal)'}
            </h2>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              {mode === 'login'
                ? 'El Administrador Jefe (admin) y el personal autorizado entran directamente aquí.'
                : 'Solo los usuarios nuevos crean cuenta. Quedarás bloqueado hasta que el Administrador te asigne tu rol.'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-2.5 text-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {mode === 'register' && (
              <div>
                <label className="block text-zinc-300 font-semibold mb-1 text-[11px]">
                  Nombre y Apellidos *
                </label>
                <div className="relative">
                  <UserCheck className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Carlos López"
                    required
                    autoComplete="name"
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl pl-9 pr-3 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition text-xs"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-zinc-300 font-semibold mb-1 text-[11px]">
                Usuario o Correo Electrónico *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={mode === 'register' ? 'Ej: carlos.sonido o tu correo' : 'Ej: admin, carlos.sonido...'}
                  required
                  autoComplete="username"
                  autoCapitalize="none"
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl pl-9 pr-3 py-2.5 text-white focus:outline-none focus:border-amber-500 transition text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-zinc-300 font-semibold mb-1 text-[11px]">
                Contraseña *
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Mínimo 6 caracteres...' : 'Introduce tu contraseña...'}
                  required
                  minLength={6}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
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

            {mode === 'register' && (
              <div>
                <label className="block text-zinc-300 font-semibold mb-1 text-[11px]">
                  Repetir Contraseña *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite tu contraseña..."
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl pl-9 pr-3 py-2.5 text-white font-mono focus:outline-none focus:border-emerald-500 transition text-xs"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition cursor-pointer text-xs disabled:opacity-60 ${
                mode === 'login'
                  ? 'bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black shadow-amber-500/20'
                  : 'bg-linear-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black shadow-emerald-500/20'
              }`}
            >
              {mode === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              <span>
                {isSubmitting
                  ? mode === 'login'
                    ? 'Verificando...'
                    : 'Creando cuenta...'
                  : mode === 'login'
                  ? 'Entrar a la Aplicación'
                  : 'Solicitar Acceso (Crear Cuenta)'}
              </span>
            </button>
          </form>

          {mode === 'register' && (
            <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 leading-relaxed">
              <strong>Solo para usuarios nuevos:</strong> Al crear tu cuenta quedarás en estado <strong>Pendiente</strong> sin poder entrar ni usar nada de la app hasta que el <strong>Administrador Jefe</strong> te elija tu rol.
            </div>
          )}

          {mode === 'login' && (
            <div className="mt-4 p-3 rounded-xl bg-zinc-900/70 border border-[#30363d] text-[11px] text-zinc-400 leading-relaxed">
              ¿Eres un trabajador nuevo? Pulsa en <button type="button" onClick={() => switchMode('register')} className="text-emerald-400 hover:underline font-semibold cursor-pointer">Crear Cuenta</button> para generar tu usuario y contraseña.
            </div>
          )}
        </div>

        {/* Security Policy Badge */}
        <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-500">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Acceso privado con usuario y contraseña • Aprobación obligatoria de rol</span>
        </div>
      </div>
    </div>
  );
};
