import React, { useEffect, useState } from 'react';
import {
  X,
  Smartphone,
  QrCode,
  Camera,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  Layers,
  Copy,
  Check,
} from 'lucide-react';
import { generateQrDataUrl } from '../../lib/barcodeUtils.ts';

interface MobileAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenScanner?: () => void;
}

export const MobileAppModal: React.FC<MobileAppModalProps> = ({
  isOpen,
  onClose,
  onOpenScanner,
}) => {
  const [appUrlQr, setAppUrlQr] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const currentUrl = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    if (isOpen && currentUrl) {
      generateQrDataUrl(currentUrl).then((url) => {
        setAppUrlQr(url);
      });
    }
  }, [isOpen, currentUrl]);

  if (!isOpen) return null;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden text-xs">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#30363d] flex items-center justify-between bg-[#161b22]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500/20 to-amber-500/40 text-amber-400 border border-amber-500/40 flex items-center justify-center shadow-md shadow-amber-500/10">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Vincular con tu Móvil (PWA)</h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                  Sin descargas de tienda
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Convierte cualquier smartphone en una pistola escáner de códigos QR y de barras
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition p-1.5 rounded-lg hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          {/* Explanation Callout */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 text-zinc-300 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <Sparkles className="w-4 h-4" />
              <span>¿Cómo funciona la conexión Móvil + Almacén?</span>
            </div>
            <p className="text-xs leading-relaxed text-zinc-300">
              No necesitas programar una aplicación nativa ni pagar cuentas de Google Play o Apple Store.
              Esta app está configurada como una <strong>PWA (Progressive Web App)</strong>: se instala directamente
              desde el navegador de tu móvil, tiene su propio icono en el escritorio, funciona a pantalla completa
              y <strong>usa la cámara de tu teléfono</strong> para leer cualquier etiqueta de almacén o contrato.
            </p>
          </div>

          {/* QR code and Steps Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
            {/* Left: QR to scan with phone */}
            <div className="p-4 rounded-xl bg-[#0d1117] border border-[#30363d] flex flex-col items-center text-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-2">
                1. Escanea este QR con tu móvil
              </span>
              <div className="bg-white p-2.5 rounded-xl border-2 border-zinc-300 shadow-md my-1">
                {appUrlQr ? (
                  <img src={appUrlQr} alt="QR App URL" className="w-40 h-40 object-contain" />
                ) : (
                  <div className="w-40 h-40 bg-zinc-200 animate-pulse rounded" />
                )}
              </div>
              <span className="text-[10px] text-zinc-400 mt-2">
                Apunta con la cámara de tu iPhone o Android para abrir JD Stock al instante.
              </span>

              {/* URL fallback */}
              <div className="mt-3 w-full flex items-center justify-between bg-[#161b22] px-2.5 py-1.5 rounded-lg border border-[#30363d]">
                <span className="font-mono text-[10px] text-zinc-400 truncate max-w-[170px]">
                  {currentUrl}
                </span>
                <button
                  onClick={handleCopyUrl}
                  className="flex items-center gap-1 text-[10px] font-semibold text-amber-400 hover:text-amber-300"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>
            </div>

            {/* Right: How to install steps */}
            <div className="space-y-3.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 block">
                2. Instalar en 2 toques:
              </span>

              <div className="p-3 rounded-xl bg-[#0d1117] border border-[#30363d] space-y-1">
                <div className="flex items-center gap-2 font-bold text-white text-xs">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px]">
                    A
                  </span>
                  <span>En Android (Google Chrome):</span>
                </div>
                <p className="text-[11px] text-zinc-400 pl-7 leading-snug">
                  Pulsa en el aviso <strong>"Instalar aplicación"</strong> o abre el menú de tres puntos (⋮) y selecciona <strong>"Instalar aplicación"</strong>.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#0d1117] border border-[#30363d] space-y-1">
                <div className="flex items-center gap-2 font-bold text-white text-xs">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px]">
                    B
                  </span>
                  <span>En iPhone / iPad (Safari):</span>
                </div>
                <p className="text-[11px] text-zinc-400 pl-7 leading-snug">
                  Toca el botón <strong>Compartir</strong> (icono de cuadrado con flecha arriba) y selecciona <strong>"Añadir a pantalla de inicio"</strong>.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#0d1117] border border-[#30363d] space-y-1">
                <div className="flex items-center gap-2 font-bold text-white text-xs">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px]">
                    C
                  </span>
                  <span>¡Listo para escanear!</span>
                </div>
                <p className="text-[11px] text-zinc-400 pl-7 leading-snug">
                  Se abrirá como una aplicación sin marco de navegador y se sincronizará automáticamente con el ordenador del almacén.
                </p>
              </div>
            </div>
          </div>

          {/* Advantages Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#30363d]">
            <div className="p-3 rounded-xl bg-[#0d1117] border border-[#30363d] space-y-1">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                <Camera className="w-3.5 h-3.5" />
                <span>Cámara como Pistola</span>
              </div>
              <p className="text-[10px] text-zinc-400">
                Escaneo instantáneo de códigos QR y códigos de barras EAN/128 con sonido de confirmación y linterna.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[#0d1117] border border-[#30363d] space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <Zap className="w-3.5 h-3.5" />
                <span>Sincronización Total</span>
              </div>
              <p className="text-[10px] text-zinc-400">
                Todo lo que escanees en una nave o furgoneta se actualiza en tiempo real en la base de datos de JD Stock.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[#0d1117] border border-[#30363d] space-y-1">
              <div className="flex items-center gap-1.5 text-blue-400 font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Roles y Permisos</span>
              </div>
              <p className="text-[10px] text-zinc-400">
                Tus técnicos solo ven las operaciones de salida y devolución; los contratos y finanzas quedan protegidos.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#30363d] bg-[#0d1117] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[#30363d] hover:bg-zinc-800 text-zinc-300 text-xs transition"
          >
            Cerrar
          </button>

          {onOpenScanner && (
            <button
              onClick={() => {
                onClose();
                onOpenScanner();
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Probar Escáner en este Dispositivo</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
