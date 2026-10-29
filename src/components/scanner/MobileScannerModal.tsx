import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import {
  X,
  Camera,
  Flashlight,
  RefreshCw,
  Search,
  Package,
  CheckCircle2,
  AlertTriangle,
  FileSignature,
  ArrowRight,
  Truck,
  RotateCcw,
  Wrench,
  Volume2,
  VolumeX,
  History,
  Layers,
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext.tsx';
import { Item, ItemUnit } from '../../types/inventory.ts';

interface MobileScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToView?: (view: string, filter?: string) => void;
  onSelectScannedItem?: (item: Item, unit?: ItemUnit) => void;
}

interface ScanRecord {
  code: string;
  timestamp: string;
  item?: Item;
  unit?: ItemUnit;
  contractCode?: string;
  isRecognized: boolean;
}

export const MobileScannerModal: React.FC<MobileScannerModalProps> = ({
  isOpen,
  onClose,
  onNavigateToView,
  onSelectScannedItem,
}) => {
  const { items, itemUnits, contracts } = useInventory();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchAvailable, setTorchAvailable] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [continuousMode, setContinuousMode] = useState<boolean>(false);

  const [manualCode, setManualCode] = useState<string>('');
  const [lastScannedResult, setLastScannedResult] = useState<ScanRecord | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'scanner' | 'history'>('scanner');

  // Cooldown to avoid duplicate rapid triggers of the same code
  const lastCodeRef = useRef<string | null>(null);
  const lastTimeRef = useRef<number>(0);

  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // High pleasant beep
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // AudioContext could be blocked by autoplay policies
    }
  };

  const triggerVibrate = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(80);
      }
    } catch {
      // Ignore vibration error
    }
  };

  const resolveScannedCode = (rawCode: string): ScanRecord => {
    const trimmed = rawCode.trim();
    const cleanLookup = trimmed
      .replace(/^QR-|^BAR-|^ITEM-|^REF-|^UNIT-|^CTR-/i, '')
      .toUpperCase();

    // 1. Check in physical units (Serial Number / unit QR)
    const matchedUnit = itemUnits.find(
      (u: ItemUnit) =>
        u.serialNumber.toUpperCase() === cleanLookup ||
        u.serialNumber.toUpperCase() === trimmed.toUpperCase() ||
        (u.qrCode && u.qrCode.toUpperCase() === trimmed.toUpperCase()) ||
        u.id === trimmed
    );

    let matchedItem: Item | undefined;
    if (matchedUnit) {
      matchedItem = items.find((it) => it.id === matchedUnit.itemId);
    } else {
      // 2. Check in items (by code, barcode, qrCode, or name)
      matchedItem = items.find(
        (it) =>
          it.code.toUpperCase() === cleanLookup ||
          it.code.toUpperCase() === trimmed.toUpperCase() ||
          (it.barcode && it.barcode === trimmed) ||
          (it.qrCode && it.qrCode.toUpperCase() === trimmed.toUpperCase()) ||
          it.id === trimmed
      );
    }

    // 3. Check in contracts
    const matchedContract = contracts.find(
      (c) =>
        c.code.toUpperCase() === cleanLookup ||
        c.code.toUpperCase() === trimmed.toUpperCase() ||
        c.id === trimmed
    );

    return {
      code: trimmed,
      timestamp: new Date().toLocaleTimeString(),
      item: matchedItem,
      unit: matchedUnit,
      contractCode: matchedContract?.code,
      isRecognized: !!(matchedItem || matchedUnit || matchedContract),
    };
  };

  const handleDetectedCode = (code: string) => {
    const now = Date.now();
    // Prevent duplicate triggers of same code within 1.8 seconds
    if (lastCodeRef.current === code && now - lastTimeRef.current < 1800) {
      return;
    }

    lastCodeRef.current = code;
    lastTimeRef.current = now;

    playBeep();
    triggerVibrate();

    const record = resolveScannedCode(code);
    setLastScannedResult(record);
    setScanHistory((prev) => [record, ...prev.slice(0, 19)]);

    if (onSelectScannedItem && record.item) {
      onSelectScannedItem(record.item, record.unit);
    }
  };

  // Start Camera
  const startCamera = async () => {
    stopCamera();
    setErrorMessage(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Tu navegador o dispositivo no soporta acceso directo a la cámara.');
      }

      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
      }

      setHasCameraPermission(true);

      // Check torch capabilities
      const track = stream.getVideoTracks()[0];
      if (track && track.getCapabilities) {
        const capabilities = track.getCapabilities() as any;
        setTorchAvailable(!!capabilities.torch);
      }

      // Start recognition loop
      startScanLoop();
    } catch (err: any) {
      console.error('Error accessing camera:', err);
      setHasCameraPermission(false);
      setErrorMessage(
        err.name === 'NotAllowedError'
          ? 'Permiso denegado para usar la cámara. Autoriza el acceso a la cámara en los ajustes de tu navegador.'
          : 'No se pudo iniciar la cámara: ' + (err.message || 'Error desconocido')
      );
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

  // Toggle torch / flash
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track && track.applyConstraints) {
      try {
        const nextState = !torchOn;
        await track.applyConstraints({
          advanced: [{ torch: nextState } as any],
        });
        setTorchOn(nextState);
      } catch (err) {
        console.warn('Torch constraint error:', err);
      }
    }
  };

  // Scanning loop: supports native BarcodeDetector or jsQR
  const startScanLoop = () => {
    // Check if BarcodeDetector is available natively
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

            // 1. Try Native BarcodeDetector
            if (nativeDetector) {
              try {
                const barcodes = await nativeDetector.detect(video);
                if (barcodes && barcodes.length > 0) {
                  detectedRawValue = barcodes[0].rawValue;
                }
              } catch {
                // Ignore native error, fallback to jsQR
              }
            }

            // 2. Fallback to jsQR
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
                // Canvas read error
              }
            }

            if (detectedRawValue) {
              handleDetectedCode(detectedRawValue);
            }
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      setLastScannedResult(null);
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleDetectedCode(manualCode.trim());
    setManualCode('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col justify-between overflow-hidden">
      {/* Top Mobile App Bar */}
      <div className="p-3 sm:p-4 bg-[#161b22] border-b border-[#30363d] flex items-center justify-between text-xs z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm">Escáner Móvil JD</span>
              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] border border-amber-500/30">
                LÁSER ÓPTICO
              </span>
            </div>
            <span className="text-[10px] text-zinc-400">
              Lee QR, EAN-13, Code-128 y referencias
            </span>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-2">
          {torchAvailable && (
            <button
              onClick={toggleTorch}
              className={`p-2 rounded-lg border transition ${
                torchOn
                  ? 'bg-amber-500 text-black border-amber-400 font-bold'
                  : 'bg-[#0d1117] text-zinc-300 border-[#30363d] hover:text-white'
              }`}
              title="Encender Linterna / Flash"
            >
              <Flashlight className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
            className="p-2 rounded-lg bg-[#0d1117] text-zinc-300 border border-[#30363d] hover:text-white transition"
            title="Cambiar Cámara (Trasera / Frontal)"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-lg bg-[#0d1117] text-zinc-300 border border-[#30363d] hover:text-white transition"
            title={soundEnabled ? 'Silenciar Beep' : 'Activar Sonido Beep'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-zinc-500" />}
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 transition ml-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Viewport: Camera Video + Reticle */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
        {hasCameraPermission === false ? (
          <div className="p-6 text-center max-w-sm space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-bold text-white">Cámara No Disponible</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {errorMessage || 'Permite el acceso a la cámara en el navegador de tu móvil para escanear.'}
            </p>
            <button
              onClick={startCamera}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-lg transition"
            >
              Reintentar Conexión
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

            {/* Target Reticle / Aim Finder */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
              <div className="relative w-64 h-64 sm:w-80 sm:h-80 border-2 border-dashed border-amber-400/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]">
                {/* Corner Marks */}
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-amber-400 rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-amber-400 rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-amber-400 rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-amber-400 rounded-br-lg" />

                {/* Animated Red/Cyan Laser Scan Line */}
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-rose-500 to-transparent shadow-[0_0_8px_#f43f5e] animate-bounce my-auto mt-32" />

                <div className="absolute bottom-2 inset-x-0 text-center">
                  <span className="font-mono text-[10px] text-amber-300 bg-black/70 px-2.5 py-0.5 rounded-full backdrop-blur-xs font-semibold">
                    Enfoca el código QR o código de barras
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Scanned Result Float Card */}
        {lastScannedResult && (
          <div className="absolute bottom-4 inset-x-4 max-w-lg mx-auto bg-[#161b22]/95 backdrop-blur-md border border-amber-500/50 p-4 rounded-2xl shadow-2xl z-30 animate-in slide-in-from-bottom">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0">
                  {lastScannedResult.contractCode ? (
                    <FileSignature className="w-5 h-5" />
                  ) : (
                    <Package className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs">
                      {lastScannedResult.item?.name ||
                        (lastScannedResult.contractCode
                          ? `Contrato: ${lastScannedResult.contractCode}`
                          : 'Código Detectado')}
                    </span>
                    {lastScannedResult.isRecognized ? (
                      <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 rounded text-[9px] font-bold border border-emerald-500/30">
                        En Almacén
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.2 bg-zinc-700 text-zinc-300 rounded text-[9px]">
                        No registrado
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-zinc-300 font-mono mt-0.5">
                    {lastScannedResult.unit ? (
                      <span>N/S: <strong className="text-amber-400">{lastScannedResult.unit.serialNumber}</strong> • Ubicación: {lastScannedResult.unit.locationName}</span>
                    ) : lastScannedResult.item ? (
                      <span>REF: <strong className="text-amber-400">{lastScannedResult.item.code}</strong> • Disp: {lastScannedResult.item.availableQuantity} {lastScannedResult.item.unit}</span>
                    ) : (
                      <span className="text-zinc-400">{lastScannedResult.code}</span>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setLastScannedResult(null)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Action Buttons for the scanned equipment */}
            {lastScannedResult.isRecognized && onNavigateToView && (
              <div className="mt-3 pt-3 border-t border-[#30363d] grid grid-cols-3 gap-2 text-[10px]">
                <button
                  onClick={() => {
                    onClose();
                    onNavigateToView('dispatches');
                  }}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 font-semibold transition"
                >
                  <Truck className="w-3 h-3" />
                  <span>Salida</span>
                </button>

                <button
                  onClick={() => {
                    onClose();
                    onNavigateToView('returns');
                  }}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-semibold transition"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Devolver</span>
                </button>

                <button
                  onClick={() => {
                    onClose();
                    onNavigateToView('maintenance');
                  }}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 font-semibold transition"
                >
                  <Wrench className="w-3 h-3" />
                  <span>Avería</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Tray: Manual Input Fallback & Recent Scans */}
      <div className="p-3 sm:p-4 bg-[#161b22] border-t border-[#30363d] z-20 space-y-2.5">
        {/* Manual Keyboard Input */}
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="¿Código dañado? Escribe N/S, REF o código de barras..."
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition shadow-sm"
          >
            Buscar
          </button>
        </form>

        {/* History preview bar */}
        {scanHistory.length > 0 && (
          <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
            <span className="flex items-center gap-1 font-medium">
              <History className="w-3.5 h-3.5 text-amber-400" />
              Últimos escaneados ({scanHistory.length})
            </span>
            <div className="flex items-center gap-1 overflow-x-auto max-w-[240px]">
              {scanHistory.slice(0, 3).map((item, idx) => (
                <span
                  key={idx}
                  onClick={() => setLastScannedResult(item)}
                  className="px-2 py-0.5 rounded bg-[#0d1117] border border-[#30363d] text-[10px] text-zinc-300 font-mono truncate max-w-[80px] cursor-pointer hover:border-amber-500"
                >
                  {item.code}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
