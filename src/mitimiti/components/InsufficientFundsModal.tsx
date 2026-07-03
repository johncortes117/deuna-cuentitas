import { formatMoney } from '../utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  amountCents: number;
  balanceCents: number;
  onRequestLoan: () => void;
}

export default function InsufficientFundsModal({ isOpen, onClose, amountCents, balanceCents, onRequestLoan }: Props) {
  if (!isOpen) return null;

  const deficit = amountCents - balanceCents;

  return (
    <>
      <div 
        className="absolute inset-0 bg-black/40 z-40 md:rounded-[43px] transition-opacity" 
        onClick={onClose}
      />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[32px] md:rounded-b-[43px] z-50 flex flex-col p-6 pt-4 animate-slideUp">
        
        <div className="flex flex-col items-center">
          <div className="w-10 h-1 bg-gray-200 rounded-full mb-6" />
          
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center text-[32px] mb-4">
            😕
          </div>
          
          <h2 className="text-[22px] font-bold text-[#1a1a1a] mb-2">No te alcanza</h2>
          
          <div className="w-full bg-[#F4F4F6] rounded-2xl p-4 mb-6">
            <div className="flex justify-between mb-2">
              <span className="text-gray-500">Tu parte</span>
              <span className="font-semibold text-[#1a1a1a]">{formatMoney(amountCents)}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-gray-500">Tu saldo</span>
              <span className="font-semibold text-[#1a1a1a]">{formatMoney(balanceCents)}</span>
            </div>
            <div className="h-px bg-gray-200 my-2" />
            <div className="flex justify-between">
              <span className="text-orange-600 font-bold">Te falta</span>
              <span className="font-bold text-orange-600">{formatMoney(deficit)}</span>
            </div>
          </div>
          
          <p className="text-[15px] text-gray-500 text-center mb-8 px-4">
            ¿Alguien de la sala te puede prestar? Se registrará como deuda en MitiMiti automáticamente.
          </p>

          <button
            onClick={onRequestLoan}
            className="w-full py-[16px] rounded-[18px] text-[17px] font-bold bg-[#4C1D80] text-white shadow-[0_8px_20px_rgba(76,29,128,0.25)] active:scale-[0.98] transition-all mb-3"
          >
            Pedir que me presten
          </button>
          
          <button
            onClick={onClose}
            className="w-full py-[16px] rounded-[18px] text-[17px] font-bold text-gray-500 bg-gray-100 active:scale-[0.98] transition-all"
          >
            Salir de la sala
          </button>
        </div>
      </div>
    </>
  );
}
