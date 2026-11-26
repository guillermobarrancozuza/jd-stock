import React, { useEffect, useState } from 'react';
import {
  X,
  Smartphone,
  QrCode,
  Copy,
  Check,
  MessageCircle,
  Wifi,
  Monitor,
  Camera,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { generateQrDataUrl } from '../../lib/barcodeUtils.ts';
import { getRemoteScannerUrl } from '../../lib/scannerBridge.ts';

interface RemoteScannerLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  isMobileOnline: boolean;
  lastRemoteScan?: { code: string; timestamp: string } | null;
}

export const RemoteScannerLinkModal: React.FC<RemoteScannerLinkModalProps> = ({
  isOpen,
  onClose,
  isMobileOnline,
  lastRemoteScan,
}) => {
  const { userProfile } = useAuth();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const remoteUrl = getRemoteScannerUrl();

  useEffect(() => {
    if (!isOpen) return;
    generateQrDataUrl(remoteUrl)
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [isOpen, remoteUrl]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(remoteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
    `📷 Enlace directo de Escáner QR Vinculado (JD Control de Stock):\n${remoteUrl}\n\nÁbrelo en tu móvil con tu usuario (@${
      userProfile?.username || userProfile?.email?.split('@')[0] || 'tu_usuario'
    }) y todo lo que escanees saldrá directamente en la pantalla de tu PC.`
  )}`;

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto no-print">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#30363d] flex items-center justify-between bg-gradient-to-r from-emerald-950/40 via-[#161b22] to-[#161b22]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Vincular Escáner Móvil con tu PC
              </h2>
              <p className="text-[11px] text-zinc-400">
                Un solo enlace abre únicamente la cámara — sin instalar nada de App Store / Play Store
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Live Connection Status */}
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
              isMobileOnline
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                : 'bg-[#0d1117] border-[#30363d] text-zinc-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  isMobileOnline ? 'bg-emerald-400 animate-ping' : 'bg-zinc-500'
                }`}
              />
              <div>
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5" />
                  <span>
                    {isMobileOnline
                      ? 'Móvil Escáner Vinculado en Vivo'
                      : 'Esperando conexión desde tu móvil...'}
                  </span>
                </div>
                <div className="text-[11px] opacity-85 mt-0.5">
                  Cuenta vinculada:{' '}
                  <strong className="text-white">
                    {userProfile?.name} (@{userProfile?.username || userProfile?.email?.split('@')[0]})
                  </strong>
                </div>
              </div>
            </div>
            {lastRemoteScan && (
              <div className="text-right text-[10px] font-mono text-emerald-300 shrink-0">
                <div>Último QR:</div>
                <div className="font-bold truncate max-w-[110px]">{lastRemoteScan.code}</div>
              </div>
            )}
          </div>

          {/* QR Code + Direct Link */}
          <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-4 items-center p-4 rounded-xl bg-[#0d1117] border border-[#30363d]">
            <div className="flex flex-col items-center justify-center">
              <div className="bg-white p-2.5 rounded-xl shadow-md">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="QR de enlace directo al Escáner Móvil"
                    className="w-32 h-32 block"
                  />
                ) : (
                  <div className="w-32 h-32 flex items-center justify-center text-zinc-500">
                    <QrCode className="w-10 h-10" />
                  </div>
                )}
              </div>
              <span className="text-[10px] text-zinc-400 mt-1.5 font-semibold text-center">
                Escanea con la cámara de tu móvil
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-amber-300 uppercase tracking-wider block mb-1">
                  Enlace Único Directo a Cámara
                </label>
                <div className="p-2 rounded-lg bg-[#161b22] border border-[#30363d] font-mono text-[11px] text-zinc-200 break-all">
                  {remoteUrl}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? '¡Enlace copiado!' : 'Copiar Enlace'}</span>
                </button>

                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-bold text-xs transition"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>
          </div>

          {/* Clear How-It-Works Box */}
          <div className="p-4 rounded-xl bg-[#0d1117] border border-[#30363d] space-y-2.5">
            <div className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>¿Cómo funciona sin bajar ninguna app externa?</span>
            </div>
            <div className="space-y-2 text-[11px] text-zinc-300">
              <div className="flex items-start gap-2">
                <Camera className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">1. Solo cámara en el móvil:</strong> Al abrir el enlace con tu mismo usuario, se abre directamente la cámara a pantalla completa (sin menús ni paneles). Puedes pulsar <em>«Añadir a pantalla de inicio»</em> para tenerlo como un icono propio en tu móvil.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Monitor className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">2. Aparece directo en tu PC estés donde estés:</strong> Cada QR que dispares con el móvil salta al instante en esta pantalla del PC (o verifica automáticamente el material si tienes abierto un albarán en <em>Verificar Salida QR</em>).
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#30363d] bg-[#0d1117] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
