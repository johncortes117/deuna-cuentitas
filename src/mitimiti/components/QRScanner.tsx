// ─── QRScanner: Escáner QR in-app con cámara ─────────────────
import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface QRScannerProps {
  onScan: (data: string) => void;
  onBack: () => void;
}

export default function QRScanner({ onScan, onBack }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasScanned = useRef(false);

  useEffect(() => {
    const scannerId = 'mitimiti-qr-reader';

    // Esperar a que el DOM esté listo
    const timeout = setTimeout(async () => {
      try {
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
              onScan(decodedText);
              try {
                scanner.stop().catch(() => {});
              } catch (e) {
                // Ignorar error síncrono si ya está detenido o no ha iniciado completamente
              }
            }
          },
          () => {
            // QR no detectado, continuar escaneando
          },
        );
      } catch (err) {
        console.error('Error starting scanner:', err);
        setError('No se pudo acceder a la cámara. Permite el acceso e intenta de nuevo.');
      }
    }, 100);

    return () => {
      clearTimeout(timeout);
      if (scannerRef.current) {
        try {
          scannerRef.current.stop().catch(() => {});
        } catch (e) {
          // Ignorar error al desmontar
        }
        scannerRef.current = null;
      }
    };
  }, [onScan]);

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
        <button className="w-full bg-white/20 backdrop-blur-md border border-white/20 text-white py-[18px] rounded-[18px] text-[16px] font-bold flex items-center justify-center gap-3 active:scale-[0.98] transition-transform">
          <span className="text-[13px] font-black tracking-widest bg-white/20 px-2 py-0.5 rounded">123</span>
          Código único de pago
        </button>
      </div>
    </div>
  );
}
