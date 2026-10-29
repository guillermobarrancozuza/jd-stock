import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  Upload,
  X,
  CheckCircle,
  AlertTriangle,
  QrCode,
  Sparkles,
  RefreshCw,
  Video,
  Image as ImageIcon,
  Check,
} from 'lucide-react';
import { Item, ItemUnit } from '../../types/inventory.ts';
import { decodeQrFromImage, findUnitOrItemByCode, ScannedMatchResult } from '../../lib/qrScannerUtils.ts';
import jsQR from 'jsqr';

interface QrPhotoScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: Item[];
  itemUnits: ItemUnit[];
  onUnitSelected: (result: {
    unit: ItemUnit | null;
    item: Item | null;
    serialNumber: string;
  }) => void;
  title?: string;
}

export const QrPhotoScannerModal: React.FC<QrPhotoScannerModalProps> = ({
  isOpen,
  onClose,
  items,
  itemUnits,
  onUnitSelected,
  title = 'Escanear o Hacer Foto al QR de la Unidad',
}) => {
  const [activeTab, setActiveTab] = useState<'photo' | 'camera'>('photo');
  const [isProcessing, setIsProcessing] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScannedMatchResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Live video stream refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const directCameraInputRef = useRef<HTMLInputElement | null>(null);

  // Play a gentle confirmation chime using Web Audio API
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      osc.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch {
      // AudioContext not allowed or not supported, ignore silently
    }
  };

  const processImageElement = async (img: HTMLImageElement, dataUrl: string) => {
    setIsProcessing(true);
    setScanError(null);
    setScanResult(null);
    setPhotoPreview(dataUrl);

    try {
      const decodedText = await decodeQrFromImage(img);
      if (!decodedText) {
        setScanError(
          'No se ha detectado ningún código QR nítido en esta imagen. Asegúrate de que la etiqueta esté bien iluminada y enfocada, o tómala más de cerca.'
        );
        return;
      }

      playBeep();
      const match = findUnitOrItemByCode(decodedText, itemUnits, items);
      setScanResult(match);
    } catch (err: any) {
      console.error('Error processing image:', err);
      setScanError('Error al procesar la imagen: ' + (err.message || 'Formato desconocido'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const dataUrl = loadEvent.target?.result as string;
      const img = new Image();
      img.onload = () => {
        processImageElement(img, dataUrl);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);

    // Reset input value so same photo can be re-selected if needed
    e.target.value = '';
  };

  // Drag and drop handlers
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const dataUrl = loadEvent.target?.result as string;
        const img = new Image();
        img.onload = () => {
          processImageElement(img, dataUrl);
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    }
  };

  // Paste image from clipboard (Ctrl+V)
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (loadEvent) => {
              const dataUrl = loadEvent.target?.result as string;
              const img = new Image();
              img.onload = () => {
                processImageElement(img, dataUrl);
              };
              img.src = dataUrl;
            };
            reader.readAsDataURL(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, itemUnits, items]);

  // Live Camera Stream functions
  const stopLiveCamera = useCallback(() => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startLiveCamera = useCallback(async () => {
    stopLiveCamera();
    setScanError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // Live scan loop using hidden canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      const scanFrame = () => {
        if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
          scanLoopRef.current = requestAnimationFrame(scanFrame);
          return;
        }

        const v = videoRef.current;
        canvas.width = v.videoWidth;
        canvas.height = v.videoHeight;
        if (ctx && canvas.width > 0 && canvas.height > 0) {
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imgData.data, canvas.width, canvas.height, {
            inversionAttempts: 'attemptBoth',
          });

          if (code && code.data) {
            playBeep();
            const match = findUnitOrItemByCode(code.data, itemUnits, items);
            setScanResult(match);
            stopLiveCamera();
            setActiveTab('photo');
            return;
          }
        }

        scanLoopRef.current = requestAnimationFrame(scanFrame);
      };

      scanLoopRef.current = requestAnimationFrame(scanFrame);
    } catch (err: any) {
      console.warn('Could not start camera stream:', err);
      setScanError(
        'No se pudo acceder a la cámara en directo. Puedes usar el botón de "Hacer Foto" o subir una imagen de la galería.'
      );
      setActiveTab('photo');
    }
  }, [itemUnits, items, stopLiveCamera]);

  useEffect(() => {
    if (isOpen && activeTab === 'camera') {
      startLiveCamera();
    } else {
      stopLiveCamera();
    }
    return () => {
      stopLiveCamera();
    };
  }, [isOpen, activeTab, startLiveCamera, stopLiveCamera]);

  // Clean up on close
  const handleModalClose = () => {
    stopLiveCamera();
    setScanResult(null);
    setScanError(null);
    setPhotoPreview(null);
    onClose();
  };

  const handleConfirmAssignment = () => {
    if (!scanResult) return;
    onUnitSelected({
      unit: scanResult.unit,
      item: scanResult.item,
      serialNumber: scanResult.serialNumber,
    });
    handleModalClose();
  };

  const handleResetScan = () => {
    setScanResult(null);
    setScanError(null);
    setPhotoPreview(null);
    if (activeTab === 'camera') {
      startLiveCamera();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-3 sm:p-4 overflow-y-auto backdrop-blur-xs">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#30363d] flex items-center justify-between bg-linear-to-r from-[#161b22] to-[#1c2128]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">{title}</h2>
              <p className="text-[11px] text-zinc-400">
                Toma una foto de la etiqueta QR o código de barras para cargar el equipo al instante
              </p>
            </div>
          </div>
          <button
            onClick={handleModalClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex border-b border-[#30363d] bg-[#0d1117] text-xs">
          <button
            type="button"
            onClick={() => {
              setActiveTab('photo');
              stopLiveCamera();
            }}
            className={`flex-1 py-2.5 font-bold flex items-center justify-center gap-2 border-b-2 transition ${
              activeTab === 'photo'
                ? 'border-amber-500 text-amber-400 bg-amber-500/10'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Hacer Foto / Subir Imagen</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('camera')}
            className={`flex-1 py-2.5 font-bold flex items-center justify-center gap-2 border-b-2 transition ${
              activeTab === 'camera'
                ? 'border-cyan-500 text-cyan-400 bg-cyan-500/10'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Video className="w-4 h-4" />
            <span>Escáner en Directo (Vídeo)</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-5 space-y-4">
          {/* Hidden file inputs */}
          {/* 1. Direct camera snapshot input (opens camera directly on mobile) */}
          <input
            ref={directCameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
          {/* 2. Gallery / file browser */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* TAB 1: Photo Snapshot & Upload */}
          {activeTab === 'photo' && !scanResult && (
            <div className="space-y-4">
              {/* Primary Action: Direct Camera Snapshot */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => directCameraInputRef.current?.click()}
                  disabled={isProcessing}
                  className="p-4 rounded-xl bg-linear-to-tr from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold flex flex-col items-center justify-center gap-2 transition shadow-lg shadow-amber-500/20 active:scale-98 cursor-pointer"
                >
                  <Camera className="w-7 h-7" />
                  <span className="text-sm">Echar Foto al QR</span>
                  <span className="text-[10px] text-zinc-900 font-semibold opacity-90">
                    Abre la cámara del móvil al instante
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="p-4 rounded-xl bg-[#0d1117] hover:bg-[#1c2128] border border-[#30363d] hover:border-zinc-500 text-zinc-200 font-bold flex flex-col items-center justify-center gap-2 transition active:scale-98 cursor-pointer"
                >
                  <Upload className="w-7 h-7 text-cyan-400" />
                  <span className="text-sm">Seleccionar Foto de Archivo</span>
                  <span className="text-[10px] text-zinc-400 font-normal">
                    Galería, capturas o imágenes guardadas
                  </span>
                </button>
              </div>

              {/* Drag & Drop Zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#30363d] hover:border-amber-500/50 rounded-xl p-5 text-center bg-[#0d1117]/60 cursor-pointer transition"
              >
                <QrCode className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
                <p className="text-xs font-semibold text-zinc-300">
                  Arrastra aquí una foto de la etiqueta o pega con <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded text-[10px] font-mono text-zinc-200">Ctrl + V</kbd>
                </p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Formatos compatibles: JPG, PNG, WEBP, HEIC
                </p>
              </div>

              {/* Processing Loader */}
              {isProcessing && (
                <div className="p-4 rounded-xl bg-[#0d1117] border border-amber-500/40 flex items-center justify-center gap-3 text-amber-400 text-xs font-semibold animate-pulse">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Analizando y descodificando etiqueta QR de la foto...</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Live Video Stream */}
          {activeTab === 'camera' && !scanResult && (
            <div className="relative rounded-xl overflow-hidden bg-black aspect-4/3 flex items-center justify-center border border-[#30363d]">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Viewfinder Overlay with scan laser */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-52 h-52 sm:w-64 sm:h-64 border-2 border-cyan-400/80 rounded-2xl relative shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                  {/* Corner accents */}
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-cyan-400 -mt-1 -ml-1 rounded-tl" />
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-cyan-400 -mt-1 -mr-1 rounded-tr" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-cyan-400 -mb-1 -ml-1 rounded-bl" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-cyan-400 -mb-1 -mr-1 rounded-br" />

                  {/* Scanning Laser Beam */}
                  <div className="absolute left-2 right-2 h-0.5 bg-linear-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_8px_#22d3ee] animate-bounce top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div className="absolute bottom-3 left-3 right-3 text-center">
                <span className="bg-black/75 text-zinc-200 text-[11px] px-3 py-1 rounded-full border border-zinc-700 backdrop-blur-xs font-medium">
                  Apunta la cámara al código QR impreso en el equipo o flightcase
                </span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {scanError && (
            <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
              <div className="space-y-2 flex-1">
                <p>{scanError}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => directCameraInputRef.current?.click()}
                    className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] transition"
                  >
                    Repetir Foto
                  </button>
                  <button
                    type="button"
                    onClick={handleResetScan}
                    className="px-3 py-1 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white text-[11px]"
                  >
                    Reintentar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SUCCESS DETECTED CARD */}
          {scanResult && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/50 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                  <CheckCircle className="w-4 h-4" />
                  <span>¡Código QR Detectado con Éxito!</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Photo thumbnail if available */}
                  {photoPreview && (
                    <div className="w-24 h-24 rounded-lg overflow-hidden bg-black border border-zinc-700 shrink-0 self-center sm:self-start">
                      <img
                        src={photoPreview}
                        alt="Foto capturada del QR"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5 flex-1 text-xs">
                    {scanResult.unit ? (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Unidad Física Localizada
                          </span>
                          <span className="font-mono text-zinc-400 text-[10px]">
                            {scanResult.unit.itemCode}
                          </span>
                        </div>

                        <h3 className="font-bold text-white text-sm">
                          {scanResult.unit.itemName}
                        </h3>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-zinc-300 text-[11px]">
                          <span>
                            Número de Serie:{' '}
                            <strong className="font-mono text-amber-400 text-xs">
                              {scanResult.unit.serialNumber}
                            </strong>
                          </span>
                          <span>
                            Ubicación: <strong>{scanResult.unit.locationName}</strong>
                          </span>
                        </div>

                        <div className="text-[11px] text-zinc-400">
                          Estado actual:{' '}
                          <span
                            className={`font-semibold ${
                              scanResult.unit.status === 'available'
                                ? 'text-emerald-400'
                                : scanResult.unit.status === 'in_event'
                                ? 'text-cyan-400'
                                : 'text-amber-400'
                            }`}
                          >
                            {scanResult.unit.status === 'available'
                              ? 'Disponible en Almacén'
                              : scanResult.unit.status === 'in_event'
                              ? `En Evento: ${scanResult.unit.currentEventName || 'En Tránsito'}`
                              : scanResult.unit.status === 'maintenance'
                              ? 'En Mantenimiento'
                              : scanResult.unit.status}
                          </span>
                        </div>
                      </>
                    ) : scanResult.item ? (
                      <>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Referencia de Catálogo Detectada
                        </span>
                        <h3 className="font-bold text-white text-sm">
                          {scanResult.item.name}
                        </h3>
                        <p className="text-zinc-400 text-[11px]">
                          Código: <strong className="font-mono text-white">{scanResult.item.code}</strong> • Grupo: {scanResult.item.group}
                        </p>
                        {scanResult.serialNumber && (
                          <p className="text-amber-300 font-mono text-[11px]">
                            N/S detectado: <strong>{scanResult.serialNumber}</strong>
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                          Código QR Leído
                        </span>
                        <p className="text-white font-mono text-sm">
                          {scanResult.rawText}
                        </p>
                        <p className="text-zinc-400 text-[11px]">
                          Este código no coincide con ninguna unidad dada de alta previamente, pero se asignará como Número de Serie de la avería.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#30363d]">
                <button
                  type="button"
                  onClick={handleResetScan}
                  className="px-3 py-2 rounded-lg border border-[#30363d] text-zinc-300 hover:text-white text-xs font-semibold transition"
                >
                  Tomar Otra Foto
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAssignment}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-emerald-500/20"
                >
                  <Check className="w-4 h-4" />
                  <span>Asignar a la Avería</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-[#30363d] bg-[#0d1117] text-[11px] text-zinc-500 flex items-center justify-between">
          <span>JD Control de Stock • Reconocimiento Óptico 2D</span>
          <button
            onClick={handleModalClose}
            className="text-zinc-400 hover:text-white"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
