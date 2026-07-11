import { useState } from 'react';

interface SimulatedPaymentViewProps {
  targetName: string;
  onPayAlone: (amountStr: string) => void;
  onPayMitiMiti: (roomName: string, amountStr: string) => void;
  onClose: () => void;
}

export default function SimulatedPaymentView({ targetName, onPayAlone, onPayMitiMiti, onClose }: SimulatedPaymentViewProps) {
  const [amount, setAmount] = useState('0');
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [roomName, setRoomName] = useState(targetName);

  const handleKey = (key: string) => {
    if (key === 'del') {
      setAmount(prev => (prev.length <= 1 ? '0' : prev.slice(0, -1)));
      return;
    }
    if (key === ',') {
      if (amount.includes(',')) return;
      setAmount(prev => prev + ',');
      return;
    }
    if (amount.includes(',')) {
      const decimals = amount.split(',')[1];
      if (decimals && decimals.length >= 2) return;
    }
    setAmount(prev => (prev === '0' ? key : prev + key));
  };

  const hasAmount = amount !== '0' && amount !== '';

  const handleMitiMitiClick = () => {
    setShowRoomModal(true);
  };

  const handleCreateRoom = () => {
    if (roomName.trim()) {
      onPayMitiMiti(roomName.trim(), amount);
    }
  };

  return (
    <div className="flex flex-col flex-1 h-full bg-white absolute inset-0 z-50">
      {/* Header */}
      <div className="flex items-center px-5 pt-14 pb-3 shrink-0 border-b border-gray-100">
        <button onClick={onClose} className="mr-3">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="flex-1 text-center pr-8">
          <p className="text-[14px] text-gray-500 font-medium">Pagar a</p>
          <h1 className="text-[17px] font-bold text-[#1a1a1a]">{targetName}</h1>
        </div>
      </div>

      {/* Monto */}
      <div className="text-center mt-8 mb-6 shrink-0">
        <p className="text-[#4C1D80] text-[13px] font-medium mb-1">
          Ingresa el valor a pagar
        </p>
        <p className="text-[54px] font-bold text-[#1a1a1a] leading-none tracking-tight">
          $ {amount}
        </p>
      </div>

      {/* Teclado numérico */}
      <div className="grid grid-cols-3 gap-y-3 px-5 flex-1 content-center">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'del'].map(key => (
          <button
            key={key}
            onClick={() => handleKey(key)}
            className="flex items-center justify-center py-4 rounded-xl text-[32px] font-semibold text-[#4C1D80] active:bg-gray-100 transition-colors"
          >
            {key === 'del' ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4C1D80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                <line x1="18" y1="9" x2="12" y2="15" />
                <line x1="12" y1="9" x2="18" y2="15" />
              </svg>
            ) : key}
          </button>
        ))}
      </div>

      {/* Acciones */}
      <div className="px-5 pb-8 shrink-0 flex gap-3">
        <button
          onClick={() => onPayAlone(amount)}
          disabled={!hasAmount}
          className={`flex-1 py-4 rounded-[16px] text-[15px] font-bold transition-all ${
            hasAmount
              ? 'bg-gray-100 text-[#1a1a1a] active:bg-gray-200'
              : 'bg-gray-50 text-gray-400 cursor-not-allowed'
          }`}
        >
          Pagar ${amount}
        </button>

        <button
          onClick={handleMitiMitiClick}
          disabled={!hasAmount}
          className={`flex-1 py-4 rounded-[16px] text-[15px] font-bold transition-all flex items-center justify-center gap-2 ${
            hasAmount
              ? 'bg-[#4C1D80] text-white active:scale-[0.98]'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          <span>🤝</span>
          <span>MitiMiti</span>
        </button>
      </div>

      {/* Modal para Nombre de Sala */}
      {showRoomModal && (
        <div className="absolute inset-0 bg-black/60 z-50 flex items-start justify-center pt-[8vh] sm:pt-[15vh] animate-fadeIn px-5" onClick={() => setShowRoomModal(false)}>
          <div className="bg-white w-full max-w-[400px] rounded-[24px] p-6 shadow-2xl animate-slideDown" onClick={e => e.stopPropagation()}>
            <h3 className="text-[22px] font-bold text-[#1a1a1a] mb-2 text-center">Nombra tu sala</h3>
            <p className="text-[15px] text-gray-500 mb-6 text-center leading-tight">Para crear la sala de pago grupal, ponle un nombre (ej. {targetName})</p>
            
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Nombre de la sala"
              className="w-full bg-[#F8F8FA] border border-gray-100 rounded-2xl py-4 px-5 text-[16px] text-[#1a1a1a] focus:outline-none focus:border-[#4C1D80] focus:ring-1 focus:ring-[#4C1D80] transition-colors mb-6"
              autoFocus
            />

            <button
              onClick={handleCreateRoom}
              disabled={!roomName.trim()}
              className={`w-full py-4 rounded-[16px] text-[16px] font-bold transition-all ${
                roomName.trim()
                  ? 'bg-[#4C1D80] text-white active:scale-[0.98]'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Crear sala y Pagar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
