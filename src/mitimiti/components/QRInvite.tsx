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
      errorCorrectionLevel: 'M',
    });
  }, [inviteToken, size]);

  return (
    <div className="relative flex items-center justify-center">
      {/* Esquinas decorativas estilo DeUna */}
      <div className="absolute top-0 left-0 w-5 h-5 border-t-[3px] border-l-[3px] border-[#4C1D80] rounded-tl-sm" />
      <div className="absolute top-0 right-0 w-5 h-5 border-t-[3px] border-r-[3px] border-[#4C1D80] rounded-tr-sm" />
      <div className="absolute bottom-0 left-0 w-5 h-5 border-b-[3px] border-l-[3px] border-[#4C1D80] rounded-bl-sm" />
      <div className="absolute bottom-0 right-0 w-5 h-5 border-b-[3px] border-r-[3px] border-[#4C1D80] rounded-br-sm" />

      <canvas ref={canvasRef} className="rounded-lg" />

      {/* Logo d! centrado */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-white rounded-full w-10 h-10 flex items-center justify-center shadow-[0_0_0_4px_white]">
          <span className="text-[#4C1D80] font-black text-lg italic tracking-tighter">d!</span>
        </div>
      </div>
    </div>
  );
}
