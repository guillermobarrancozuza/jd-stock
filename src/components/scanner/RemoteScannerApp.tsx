import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  Flashlight,
  RefreshCw,
  Volume2,
  VolumeX,
  CheckCircle2,
  AlertTriangle,
  Wifi,
  Search,
  Send,
  Monitor,
  LogOut,
  ExternalLink,
  Smartphone,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useInventory } from '../../context/InventoryContext.tsx';
import { findUnitOrItemByCode } from '../../lib/qrScannerUtils.ts';
import {
  publishRemoteQrScan,
  sendMobileScannerHeartbeat,
} from '../../lib/scannerBridge.ts';
import { PWAInstallButton } from '../pwa/PWAInstallButton.tsx';

interface RemoteScannerAppProps {
  onExitToFullApp: () => void;
}

interface SentScanFeedback {
  code: string;
  label: string;
  subtitle: string;
  timestamp: string;
  recognized: boolean;
}

export const RemoteScannerApp: React.FC<RemoteScannerAppProps> = ({ onExitToFullApp }) => {
  const { currentUser, userProfile, logout } = useAuth();
  const { items, itemUnits, equipmentKits, cableBoxes, contracts } = useInventory();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const [isSynced, setIsSynced] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [sentCount, setSentCount] = useState(0);
  const [lastSent, setLastSent] = useState<SentScanFeedback | null>(null);
  const [flashGreen, setFlashGreen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [sendingManual, setSendingManual] = useState(false);

  // Refs to avoid stale closures inside requestAnimationFrame
  const lastCodeRef = useRef<string | null>(null);
  const lastTimeRef = useRef<number>(0);
  const soundEnabledRef = useRef(soundEnabled);
  const inventoryRef = useRef({ items, itemUnits, equipmentKits, cableBoxes, contracts });

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    inventoryRef.current = { items, itemUnits, equipmentKits, cableBoxes, contracts };
  }, [items, itemUnits, equipmentKits, cableBoxes, contracts]);

  // Keep live presence heartbeat with user's open PC session
  useEffect(() => {
    if (!currentUser?.uid) return;
    let cancelled = false;

    const ping = async () => {
      try {
        await sendMobileScannerHeartbeat({
          userId: currentUser.uid,
          senderName: userProfile?.name || currentUser.displayName || 'Móvil',
        });
        if (!cancelled) {
          setIsSynced(true);
          setSyncError(null);
        }
      } catch (err: any) {
        if (!cancelled) {
          setIsSynced(false);
          setSyncError(err?.message || 'Sin conexión con tu sesión del PC.');
        }
      }
    };

    ping();
    const interval = window.setInterval(ping, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [currentUser?.uid, userProfile?.name, currentUser?.displayName]);

  const playBeep = () => {
    if (!soundEnabledRef.current) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046, ctx.currentTime);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.14);
    } catch {
      // Ignore audio autoplay block
    }
  };

  const triggerVibrate = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([70, 40, 70]);
      }
    } catch {
      // Ignore vibration errors
    }
  };

  const dispatchCodeToPc = async (rawCode: string, force = false) => {
    const clean = rawCode.trim();
    if (!clean || !currentUser?.uid) return;

    const now = Date.now();
    if (!force && lastCodeRef.current === clean && now - lastTimeRef.current < 2200) {
      return;
    }

    lastCodeRef.current = clean;
    lastTimeRef.current = now;

    playBeep();
    triggerVibrate();

    // Local preview resolution so the phone operator immediately knows what they shot
    const inv = inventoryRef.current;
    const match = findUnitOrItemByCode(
      clean,
      inv.itemUnits,
      inv.items,
      inv.equipmentKits,
      inv.cableBoxes,
      inv.contracts
    );

    const label =
      match.kit?.name ||
      match.cableBox?.name ||
      match.item?.name ||
      (match.contract ? `Contrato ${match.contract.code}` : clean);

    const subtitle = match.kit
      ? `QR Conjunto · ${match.kit.components.length} componentes`
      : match.cableBox
      ? `Caja Cables · ${match.cableBox.currentQuantity}/${match.cableBox.initialQuantity} útiles`
      : match.unit
      ? `N/S ${match.unit.serialNumber} · ${match.unit.locationName}`
      : match.item
      ? `REF ${match.item.code} · Disp: ${match.item.availableQuantity}`
      : 'Enviado a la pantalla del PC';

    try {
      await publishRemoteQrScan({
        userId: currentUser.uid,
        senderName: userProfile?.name || currentUser.displayName || 'Móvil',
        code: clean,
      });

      setIsSynced(true);
      setSyncError(null);
      setSentCount((c) => c + 1);
      setLastSent({
        code: clean,
        label,
        subtitle,
        timestamp: new Date().toLocaleTimeString('es-ES'),
        recognized: match.isDirectMatch,
      });
      setFlashGreen(true);
      window.setTimeout(() => setFlashGreen(false), 650);
    } catch (err: any) {
      setSyncError(err?.message || 'Error al enviar el QR al PC. Revisa tu conexión.');
    }
  };

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setTorchOn(false);
  };

  const startScanLoop = () => {
    const hasNativeBarcodeDetector =
      typeof window !== 'undefined' && 'BarcodeDetector' in window;
    let nativeDetector: any = null;

    if (hasNativeBarcodeDetector) {
      try {
        nativeDetector = new (window as any).BarcodeDetector({
          formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a'],
        });
      } catch {
        nativeDetector = null;
      }
    }

    const tick = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && video.readyState === video.HAVE_ENOUGH_DATA && canvas) {
        const width = video.videoWidth;
        const height = video.videoHeight;

        if (width > 0 && height > 0) {
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });

          if (ctx) {
            ctx.drawImage(video, 0, 0, width, height);
            let detectedRawValue: string | null = null;

            if (nativeDetector) {
              try {
                const barcodes = await nativeDetector.detect(video);
                if (barcodes && barcodes.length > 0) {
                  detectedRawValue = barcodes[0].rawValue;
                }
              } catch {
                // fallback to jsQR
              }
            }

            if (!detectedRawValue) {
              try {
                const imageData = ctx.getImageData(0, 0, width, height);
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                  inversionAttempts: 'dontInvert',
                });
                if (code && code.data) {
                  detectedRawValue = code.data;
                }
              } catch {
                // ignore frame error
              }
            }

            if (detectedRawValue) {
              dispatchCodeToPc(detectedRawValue);
            }
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);
  };

  const startCamera = async () => {
    stopCamera();
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Este navegador no permite acceso directo a la cámara.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
      }

      setHasCameraPermission(true);

      const track = stream.getVideoTracks()[0];
      if (track && track.getCapabilities) {
        const capabilities = track.getCapabilities() as any;
        setTorchAvailable(!!capabilities.torch);
      }

      startScanLoop();
    } catch (err: any) {
      setHasCameraPermission(false);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Permiso de cámara denegado. Permite el acceso a la cámara en tu navegador.'
          : 'No se pudo iniciar la cámara: ' + (err.message || 'Error desconocido')
      );
    }
  };

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [facingMode]);

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track && track.applyConstraints) {
      try {
        const next = !torchOn;
        await track.applyConstraints({ advanced: [{ torch: next } as any] });
        setTorchOn(next);
      } catch {
        // ignore
      }
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    setSendingManual(true);
    try {
      await dispatchCodeToPc(manualCode.trim(), true);
      setManualCode('');
    } finally {
      setSendingManual(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col overflow-hidden select-none">
      {/* Compact Linked Scanner Header */}
      <header className="px-3 py-2.5 bg-[#161b22] border-b border-[#30363d] flex items-center justify-between gap-2 z-20 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0">
            <Camera className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm text-white truncate">
                Escáner Remoto JD
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                  isSynced
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isSynced ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
                {isSynced ? 'Vinculado al PC' : 'Conectando...'}
              </span>
            </div>
            <div className="text-[11px] text-zinc-400 truncate flex items-center gap-1.5">
              <Monitor className="w-3 h-3 text-cyan-400 shrink-0" />
              <span className="truncate">
                Perfil: <strong className="text-zinc-200">{userProfile?.name}</strong> (
                @{userProfile?.username || userProfile?.email?.split('@')[0]})
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <PWAInstallButton />

          {torchAvailable && (
            <button
              type="button"
              onClick={toggleTorch}
              className={`p-2 rounded-lg border transition cursor-pointer ${
                torchOn
                  ? 'bg-amber-500 text-black border-amber-400'
                  : 'bg-[#0d1117] text-zinc-300 border-[#30363d]'
              }`}
              title="Linterna"
            >
              <Flashlight className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setFacingMode((p) => (p === 'environment' ? 'user' : 'environment'))}
            className="p-2 rounded-lg bg-[#0d1117] text-zinc-300 border border-[#30363d] cursor-pointer"
            title="Cambiar cámara"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setSoundEnabled((s) => !s)}
            className="p-2 rounded-lg bg-[#0d1117] text-zinc-300 border border-[#30363d] cursor-pointer"
            title={soundEnabled ? 'Silenciar sonido' : 'Activar sonido'}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-zinc-500" />
            )}
          </button>
        </div>
      </header>

      {/* Live Camera Viewport */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
        {hasCameraPermission === false ? (
          <div className="p-6 text-center max-w-sm space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h2 className="text-base font-bold text-white">Activa la cámara para escanear</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {cameraError || 'Concede permiso de cámara en tu móvil para enviar los QR directamente a tu PC.'}
            </p>
            <button
              type="button"
              onClick={startCamera}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs cursor-pointer"
            >
              Reintentar Cámara
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              muted
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Full-screen green pulse flash on successful send */}
            {flashGreen && (
              <div className="absolute inset-0 bg-emerald-500/25 border-4 border-emerald-400 pointer-events-none z-20 transition-opacity" />
            )}

            {/* Reticle */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
              <div
                className={`relative w-64 h-64 sm:w-80 sm:h-80 border-2 border-dashed rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] transition-colors ${
                  flashGreen ? 'border-emerald-400' : 'border-amber-400/85'
                }`}
              >
                <div className="absolute -top-1 -left-1 w-7 h-7 border-t-4 border-l-4 border-amber-400 rounded-tl-xl" />
                <div className="absolute -top-1 -right-1 w-7 h-7 border-t-4 border-r-4 border-amber-400 rounded-tr-xl" />
                <div className="absolute -bottom-1 -left-1 w-7 h-7 border-b-4 border-l-4 border-amber-400 rounded-bl-xl" />
                <div className="absolute -bottom-1 -right-1 w-7 h-7 border-b-4 border-r-4 border-amber-400 rounded-br-xl" />

                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_10px_#34d399] animate-bounce mt-32" />

                <div className="absolute -top-9 inset-x-0 flex justify-center">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/75 border border-emerald-500/40 text-[11px] font-bold text-emerald-300 backdrop-blur-xs">
                    <Wifi className="w-3.5 h-3.5" />
                    Directo a tu PC · Salida, Entrada, SAT o Inventario ({sentCount})
                  </span>
                </div>

                <div className="absolute bottom-2.5 inset-x-0 text-center">
                  <span className="font-mono text-[10px] text-amber-300 bg-black/75 px-2.5 py-1 rounded-full">
                    Apunta al QR del equipo, carro o caja
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Sync Error Alert */}
        {syncError && (
          <div className="absolute top-3 inset-x-3 max-w-md mx-auto p-3 rounded-xl bg-rose-950/90 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2 z-30">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{syncError}</span>
          </div>
        )}

        {/* Last Sent Confirmation Toast */}
        {lastSent && (
          <div className="absolute bottom-3 inset-x-3 max-w-md mx-auto p-3.5 rounded-2xl bg-[#161b22]/95 border border-emerald-500/50 shadow-2xl z-30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    ✓ Enviado al PC · {lastSent.timestamp}
                  </span>
                </div>
                <div className="text-xs font-bold text-white truncate">{lastSent.label}</div>
                <div className="text-[11px] text-zinc-400 truncate font-mono">
                  {lastSent.subtitle}
                </div>
              </div>
            </div>
            <span className="px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono text-xs font-bold shrink-0">
              #{sentCount}
            </span>
          </div>
        )}
      </div>

      {/* Bottom Controls: Manual Code Fallback + Switch to Full App / Logout */}
      <footer className="p-3 bg-[#161b22] border-t border-[#30363d] space-y-2.5 z-20 shrink-0">
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="¿QR dañado? Escribe código y envíalo al PC..."
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <button
            type="submit"
            disabled={sendingManual || !manualCode.trim()}
            className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Enviar</span>
          </button>
        </form>

        <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-0.5">
          <button
            type="button"
            onClick={onExitToFullApp}
            className="inline-flex items-center gap-1.5 text-zinc-300 hover:text-amber-300 font-semibold cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Entrar a la plataforma completa</span>
          </button>

          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1 text-zinc-400 hover:text-rose-400 font-semibold cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Salir</span>
          </button>
        </div>

        <div className="text-[10px] text-zinc-500 flex items-center justify-center gap-1">
          <Smartphone className="w-3 h-3 text-amber-400" />
          <span>Guarda este enlace en la pantalla de inicio de tu móvil para abrir solo la cámara en 1 toque.</span>
        </div>
      </footer>
    </div>
  );
};
