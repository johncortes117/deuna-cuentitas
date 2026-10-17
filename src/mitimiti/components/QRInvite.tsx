// ─── QRInvite: QR con la URL real de una sala o de una deuda ─
import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface QRInviteProps {
  // El mismo link que se comparte por WhatsApp (inviteLink / debtLink).
  url: string;
  size?: number;
}

export default function QRInvite({ url, size = 200 }: QRInviteProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Mismo link que se comparte por WhatsApp (antes el QR usaba VITE_APP_URL
    // y el botón de compartir window.location.origin: podían no coincidir).
    QRCode.toCanvas(canvasRef.current, url, {
      width: size,
      margin: 2,
      color: {
        dark: '#1a1a1a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    });
  }, [url, size]);

  return (
    <div className="relative p-6">
      {/* Esquinas decorativas gruesas estilo DeUna Consumer (Captura 3) */}
      <div className="absolute top-0 left-0 w-8 h-8 border-t-[4px] border-l-[4px] border-[#4C1D80]" />
      <div className="absolute top-0 right-0 w-8 h-8 border-t-[4px] border-r-[4px] border-[#4C1D80]" />
      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[4px] border-l-[4px] border-[#4C1D80]" />
      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[4px] border-r-[4px] border-[#4C1D80]" />

      <canvas ref={canvasRef} />

      {/* Logo d! centrado */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-white rounded-full w-14 h-14 flex items-center justify-center shadow-[0_0_0_4px_white]">
          <span className="text-[#2FD9A9] font-black text-2xl italic tracking-tighter">d!</span>
        </div>
      </div>
    </div>
  );
}
