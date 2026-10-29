import React, { useState } from 'react';
import { Download, Smartphone, Share2, PlusSquare, CheckCircle2, X } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall.ts';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already installed and running in standalone mode, hide button
  if (isInstalled) {
    return null;
  }

  return (
    <>
      {/* Chromium / Android / Desktop flow */}
      {isInstallable && (
        <button
          onClick={install}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-bold shadow-md shadow-amber-500/20 transition cursor-pointer"
          title="Instalar JD Control de Stock como aplicación en tu dispositivo"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Instalar App</span>
        </button>
      )}

      {/* iOS Safari flow */}
      {isIOS && !isInstallable && (
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-amber-500/30 text-xs font-semibold transition cursor-pointer"
          title="Añadir JD Stock a la pantalla de inicio de tu iPhone / iPad"
        >
          <Smartphone className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Instalar en iOS</span>
        </button>
      )}

      {/* iOS Safari step-by-step guidance modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#161b22] border border-[#30363d] p-6 shadow-2xl text-left space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#30363d]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Instalar en iPhone / iPad</h3>
                  <p className="text-[11px] text-zinc-400">Sin descargas de la App Store</p>
                </div>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-zinc-300">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-[#0d1117] border border-[#30363d]">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 font-bold text-xs">
                  1
                </div>
                <div>
                  <p className="font-semibold text-white flex items-center gap-1.5">
                    Toca el botón <Share2 className="w-3.5 h-3.5 text-blue-400 inline" /> Compartir
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    En la barra inferior de Safari de tu iPhone.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-[#0d1117] border border-[#30363d]">
                <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 font-bold text-xs">
                  2
                </div>
                <div>
                  <p className="font-semibold text-white flex items-center gap-1.5">
                    Selecciona <PlusSquare className="w-3.5 h-3.5 text-amber-400 inline" /> Añadir a pantalla de inicio
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Desliza hacia abajo en el menú de compartir.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-[#0d1117] border border-[#30363d]">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 font-bold text-xs">
                  3
                </div>
                <div>
                  <p className="font-semibold text-white flex items-center gap-1.5">
                    Pulsa <strong className="text-emerald-400">Añadir</strong>
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Se creará el icono de JD Stock en tu escritorio con acceso a cámara a pantalla completa.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
