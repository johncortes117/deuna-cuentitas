// ─── QRInvite: QR de invitación con URL real ─────────────────
import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { encodeInviteQR } from '../utils';

interface QRInviteProps {
  inviteToken: string;
  size?: number;
}

const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;

export default function QRInvite({ inviteToken, size = 200 }: QRInviteProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const url = encodeInviteQR(inviteToken, APP_URL);

    QRCode.toCanvas(canvasRef.current, url, {
      width: size,
      margin: 2,
      color: {
        dark: '#1a1a1a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    });
  }, [inviteToken, size]);

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
