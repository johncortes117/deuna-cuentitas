// ─── QRScanner: Escáner QR in-app con cámara ─────────────────
import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import ShowMyQRModal from './ShowMyQRModal';
import { exitFullscreenSafe, getFullscreenElement } from '../../fullscreen';

interface QRScannerProps {
  onScan: (data: string) => void;
  onBack: () => void;
}

export default function QRScanner({ onScan, onBack }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showMyQR, setShowMyQR] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasScanned = useRef(false);

  // Mantener la última versión de onScan sin que sea dependencia del efecto:
  // con `[onScan]` (arrow inline en App) el efecto se destruía y recreaba en
  // CADA re-render del padre, reiniciando la cámara y dejando streams huérfanos.
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    const scannerId = 'mitimiti-qr-reader';
    let cancelled = false;

    // Forzar la liberación del hardware de cámara. No confiamos únicamente en
    // scanner.stop() porque en Chrome mobile suele fallar y deja el MediaStream
    // vivo — y una cámara activa interfiere con la pantalla completa en Android.
    const releaseCamera = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          try { track.stop(); } catch { /* noop */ }
        });
        streamRef.current = null;
      }
      // Por si acaso, también detenemos cualquier <video> con stream que quedara.
      const video = document.querySelector<HTMLVideoElement>(`#${scannerId} video`);
      const src = video?.srcObject;
      if (src instanceof MediaStream) {
        src.getTracks().forEach((track) => {
          try { track.stop(); } catch { /* noop */ }
        });
      }
    };

    const stopScanner = () => {
      const scanner = scannerRef.current;
      scannerRef.current = null;
      // Primero matamos los tracks (libera el hardware YA), luego dejamos que
      // la librería limpie su estado/DOM; sus errores no nos importan.
      releaseCamera();
      if (scanner) {
        try {
          scanner.stop().then(releaseCamera).catch(releaseCamera);
        } catch {
          releaseCamera();
        }
      }
    };

    // Esperar a que el DOM esté listo
    const timeout = setTimeout(async () => {
      try {
        // CRÍTICO: salir de pantalla completa ANTES de encender la cámara.
        // Si la cámara arranca estando en fullscreen, Android Chrome sale
        // visualmente pero deja `fullscreenElement` seteado — un estado
        // "zombi" irrecuperable desde JS (exit se cuelga, requests son
        // no-ops que consumen la activación del usuario). Al salir limpio
        // aquí, el estado queda consistente y la vista de pago puede volver
        // a pantalla completa sin problema. Reintentamos por si el tap que
        // abrió el escáner dejó una transición de fullscreen a medio camino.
        for (let attempt = 0; attempt < 3 && !cancelled; attempt++) {
          await exitFullscreenSafe(400);
          if (!getFullscreenElement()) break;
          await new Promise((r) => setTimeout(r, 150));
        }
        if (cancelled) return;

        const scanner = new Html5Qrcode(scannerId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
          },
          (decodedText) => {
            if (!hasScanned.current) {
              hasScanned.current = true;
              // Liberamos la cámara de inmediato antes de pasar a la vista de pago.
              stopScanner();
              onScanRef.current(decodedText);
            }
          },
          () => {
            // QR no detectado, continuar escaneando
          },
        );

        // Guardamos la referencia al MediaStream real que abrió la librería,
        // para poder cerrarlo nosotros mismos con total garantía.
        const video = document.querySelector<HTMLVideoElement>(`#${scannerId} video`);
        if (video?.srcObject instanceof MediaStream) {
          streamRef.current = video.srcObject;
        }

        // Carrera de desmontaje: si el componente se desmontó mientras start()
        // seguía pendiente, la limpieza ya corrió y nadie apagará esta cámara.
        // La apagamos aquí mismo.
        if (cancelled) {
          stopScanner();
        }
      } catch (err) {
        console.error('Error starting scanner:', err);
        if (!cancelled) {
          setError('No se pudo acceder a la cámara. Permite el acceso e intenta de nuevo.');
        }
      }
    }, 100);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      stopScanner();
    };
  }, []);

  return (
    <div className="flex flex-col flex-1 bg-black relative" ref={containerRef}>
      {/* Scanner container - occupies full screen */}
      <div className="absolute inset-0">
        {/* We need html5-qrcode to fill this container, styling will be via css if needed */}
        <style>
          {`
            #mitimiti-qr-reader {
              width: 100% !important;
              height: 100% !important;
              border: none !important;
            }
            #mitimiti-qr-reader video {
              width: 100% !important;
              height: 100% !important;
              object-fit: cover !important;
            }
          `}
        </style>
        <div id="mitimiti-qr-reader" className="w-full h-full" />
      </div>

      {/* Overlay to dim the outside of the scan area */}
      <div className="absolute inset-0 pointer-events-none" style={{
        boxShadow: 'inset 0 0 0 5000px rgba(0,0,0,0.5)',
        // we use a clip-path or a custom div layout for the hole.
        // Actually, html5-qrcode adds its own shading, but we want a custom one.
        // A simple way is a massive border with border-radius.
      }}>
        <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[280px] h-[280px] rounded-[30px] shadow-[0_0_0_4000px_rgba(0,0,0,0.4)] border-2 border-white/40" />
      </div>

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 pt-16">
        <button
          onClick={onBack}
          className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <button className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg">
          {/* Flashlight off icon */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.9 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/><line x1="2" y1="2" x2="22" y2="22"/>
          </svg>
        </button>
      </div>

      {/* Texto central */}
      <div className="absolute top-[55%] left-0 right-0 text-center px-8 z-20">
        <p className="text-white text-[18px] font-bold mb-1 tracking-tight drop-shadow-md">
          Escanea un QR <span className="text-[#2FD9A9] italic font-black">deuna!</span>
        </p>
        <p className="text-white/90 text-[14px] leading-tight drop-shadow-md">
          para hacer pagos, retiros o verificaciones
        </p>
        {error && (
          <p className="text-red-400 text-[13px] mt-4 font-medium bg-black/50 py-1 px-3 rounded-lg inline-block">{error}</p>
        )}
      </div>

      {/* Botón Flotante Inferior */}
      <div className="absolute bottom-10 left-5 right-5 z-20">
        <button 
          onClick={() => setShowMyQR(true)}
          className="w-full bg-white/20 backdrop-blur-md border border-white/20 text-white py-[18px] rounded-[18px] text-[16px] font-bold flex items-center justify-center gap-3 active:scale-[0.98] transition-transform"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="3" height="3"/><path d="M21 14h-3v3"/><path d="M21 21h-3v-3"/></svg>
          Mostrar Mi QR
        </button>
      </div>

      {showMyQR && <ShowMyQRModal onClose={() => setShowMyQR(false)} />}
    </div>
  );
}
