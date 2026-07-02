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
            qrbox: { width: 220, height: 220 },
            aspectRatio: 1,
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
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-5 pt-14 pb-4">
        <button
          onClick={onBack}
          className="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="text-white text-[16px] font-bold">Escanear QR</span>
        <div className="w-9" />
      </div>

      {/* Scanner container */}
      <div className="flex-1 flex items-center justify-center">
        <div id="mitimiti-qr-reader" className="w-full max-w-[300px]" />
      </div>

      {/* Overlay decorativo */}
      <div className="mitimiti-scanner-overlay pointer-events-none">
        <div className="mitimiti-scanner-frame">
          <div className="mitimiti-scanner-corner tl" />
          <div className="mitimiti-scanner-corner tr" />
          <div className="mitimiti-scanner-corner bl" />
          <div className="mitimiti-scanner-corner br" />
          <div className="mitimiti-scan-line" />
        </div>
      </div>

      {/* Instrucción inferior */}
      <div className="absolute bottom-0 left-0 right-0 pb-8 pt-4 text-center z-10">
        <p className="text-white/80 text-[14px] font-medium">
          Apunta al código QR
        </p>
        {error && (
          <p className="text-red-400 text-[13px] mt-2 px-6">{error}</p>
        )}
      </div>
    </div>
  );
}
