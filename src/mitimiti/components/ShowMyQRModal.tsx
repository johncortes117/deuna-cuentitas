import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { getUserProfile } from '../utils';

interface ShowMyQRModalProps {
  onClose: () => void;
}

export default function ShowMyQRModal({ onClose }: ShowMyQRModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const profile = getUserProfile();

  useEffect(() => {
    if (!canvasRef.current || !profile) return;

    const data = JSON.stringify({
      type: 'deuna_personal',
      userId: profile.userId,
      displayName: profile.displayName,
    });

    QRCode.toCanvas(canvasRef.current, data, {
      width: 250,
      margin: 2,
      color: {
        dark: '#1a1a1a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    });
  }, [profile]);

  return (
    <div className="mitimiti-backdrop z-50 absolute inset-0 flex flex-col justify-end" onClick={onClose} style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
      <div
        className="mitimiti-modal mitimiti-slide-up flex flex-col items-center pb-10 bg-white w-full rounded-t-[30px] pt-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        
        <h2 className="text-[20px] font-bold text-[#1a1a1a] mb-2">Tu código QR</h2>
        <p className="text-[15px] text-gray-500 text-center mb-6 px-4">
          Muestra este código para que te paguen directamente o te incluyan en un MitiMiti.
        </p>

        <div className="relative p-6 mb-6">
          <div className="absolute top-0 left-0 w-8 h-8 border-t-[4px] border-l-[4px] border-[#4C1D80]" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-[4px] border-r-[4px] border-[#4C1D80]" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[4px] border-l-[4px] border-[#4C1D80]" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[4px] border-r-[4px] border-[#4C1D80]" />
          
          <canvas ref={canvasRef} />
          
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-white rounded-full w-14 h-14 flex items-center justify-center shadow-[0_0_0_4px_white]">
              <span className="text-[#2FD9A9] font-black text-2xl italic tracking-tighter">d!</span>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-[90%] py-4 rounded-[14px] bg-gray-100 text-[#1a1a1a] text-[16px] font-bold active:scale-[0.98] transition-transform"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
