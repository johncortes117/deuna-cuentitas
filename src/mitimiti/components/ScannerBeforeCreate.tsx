import { useState } from 'react';
import QRScanner from './QRScanner';
import { decodeQR } from '../utils';

interface ScannerBeforeCreateProps {
  onScanComplete: (commerceName: string) => void;
  onBack: () => void;
}

export default function ScannerBeforeCreate({ onScanComplete, onBack }: ScannerBeforeCreateProps) {
  const [error, setError] = useState<string | null>(null);

  const handleScan = (dataStr: string) => {
    const data = decodeQR(dataStr);
    if (!data) {
      setError("Código QR no válido");
      return;
    }
    
    // Si escaneó el QR personal (simulando local), pasar el nombre
    if (data.type === 'deuna_personal') {
      onScanComplete(data.displayName || 'Comercio');
    } else if (data.type === 'mitimiti_invite') {
      // Si escaneó una invitación a sala mientras intentaba crear una, redirigir a unirse
      window.location.hash = `#/mitimiti/join/${data.token}`;
    } else {
      setError("QR no soportado");
    }
  };

  return (
    <div className="flex flex-col flex-1 h-full relative">
      <QRScanner onScan={handleScan} onBack={onBack} />
      
      {/* Toast de Error */}
      {error && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-semibold z-50 shadow-lg">
          {error}
        </div>
      )}

      {/* Header/Overlay Específico para este flujo */}
      <div className="absolute top-32 left-0 right-0 text-center px-8 z-30 pointer-events-none">
         <p className="text-white text-[16px] font-bold bg-black/40 inline-block px-4 py-2 rounded-xl backdrop-blur-sm">
           Escanea el QR del local primero
         </p>
      </div>
    </div>
  );
}
