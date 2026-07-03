import { useState } from 'react';
import { useDebts } from '../useDebts';
import { useBalance } from '../useBalance';
import { formatMoney } from '../utils';

export default function DebtsView({ onBack }: { onBack: () => void }) {
  const { debtsIOwe, debtsOwedToMe, history, settleDebt, forgiveDebt } = useDebts();
  const { balance, deduct } = useBalance();
  const [tab, setTab] = useState<'owe' | 'owed' | 'history'>('owe');

  const handlePay = async (debtId: string, amount: number) => {
    if (balance < amount) {
      alert('No tienes saldo suficiente para pagar esta deuda.');
      return;
    }
    await settleDebt(debtId);
    deduct(amount);
    alert('Deuda pagada correctamente.');
  };

  const handleForgive = async (debtId: string) => {
    if (confirm('¿Estás seguro de que quieres perdonar esta deuda?')) {
      await forgiveDebt(debtId);
      alert('Deuda perdonada.');
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-[#F8F8FA] h-full">
      {/* Header */}
      <div className="bg-white flex items-center px-5 pt-14 pb-4 shrink-0 shadow-sm z-10 relative">
        <button onClick={onBack} className="absolute left-5">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="text-[17px] font-bold text-[#1a1a1a] w-full text-center">Mis Deudas</h1>
      </div>

      {/* Tabs */}
      <div className="bg-white px-5 pt-2 pb-0 flex gap-4 border-b border-gray-100 shrink-0">
        <button 
          onClick={() => setTab('owe')}
          className={`pb-3 font-semibold text-[14px] px-1 relative ${tab === 'owe' ? 'text-[#4C1D80]' : 'text-gray-400'}`}
        >
          Debes
          {debtsIOwe.length > 0 && <span className="ml-1.5 bg-[#00C2E0] text-white text-[10px] px-1.5 py-0.5 rounded-full">{debtsIOwe.length}</span>}
          {tab === 'owe' && <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#4C1D80] rounded-t-md" />}
        </button>
        <button 
          onClick={() => setTab('owed')}
          className={`pb-3 font-semibold text-[14px] px-1 relative ${tab === 'owed' ? 'text-[#4C1D80]' : 'text-gray-400'}`}
        >
          Te deben
          {debtsOwedToMe.length > 0 && <span className="ml-1.5 bg-[#00C2E0] text-white text-[10px] px-1.5 py-0.5 rounded-full">{debtsOwedToMe.length}</span>}
          {tab === 'owed' && <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#4C1D80] rounded-t-md" />}
        </button>
        <button 
          onClick={() => setTab('history')}
          className={`pb-3 font-semibold text-[14px] px-1 relative ml-auto ${tab === 'history' ? 'text-[#4C1D80]' : 'text-gray-400'}`}
        >
          Historial
          {tab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#4C1D80] rounded-t-md" />}
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        
        {tab === 'owe' && (
          <div className="space-y-4 animate-fadeIn">
            {debtsIOwe.length === 0 ? (
              <p className="text-gray-400 text-center mt-10">No debes nada a nadie 🎉</p>
            ) : (
              debtsIOwe.map(debt => (
                <div key={debt.id} className="bg-white p-4 rounded-[20px] shadow-sm border border-[#EBE3F5] flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[12px] text-gray-500 font-medium">Le debes a</p>
                      <p className="text-[16px] font-bold text-[#1a1a1a]">{debt.creditor_name}</p>
                    </div>
                    <span className="text-[20px] font-black text-[#1a1a1a]">{formatMoney(debt.amount_cents)}</span>
                  </div>
                  <button 
                    onClick={() => handlePay(debt.id, debt.amount_cents)}
                    className="w-full py-3 bg-[#4C1D80] text-white rounded-[14px] font-bold text-[15px] active:scale-95 transition-transform"
                  >
                    Pagar ahora
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'owed' && (
          <div className="space-y-4 animate-fadeIn">
            {debtsOwedToMe.length === 0 ? (
              <p className="text-gray-400 text-center mt-10">Nadie te debe dinero</p>
            ) : (
              debtsOwedToMe.map(debt => (
                <div key={debt.id} className="bg-white p-4 rounded-[20px] shadow-sm border border-[#EBE3F5] flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[12px] text-gray-500 font-medium">Te debe</p>
                      <p className="text-[16px] font-bold text-[#1a1a1a]">{debt.debtor_name}</p>
                    </div>
                    <span className="text-[20px] font-black text-[#1a1a1a]">{formatMoney(debt.amount_cents)}</span>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => alert('Simulación: Notificación enviada a ' + debt.debtor_name)}
                      className="flex-1 py-3 bg-[#F8F5FB] text-[#4C1D80] rounded-[14px] font-bold text-[15px] active:scale-95 transition-transform"
                    >
                      Recordar
                    </button>
                    <button 
                      onClick={() => handleForgive(debt.id)}
                      className="px-4 py-3 bg-[#FCEBEB] text-[#A32D2D] rounded-[14px] font-bold text-[14px] active:scale-95 transition-transform"
                    >
                      Perdonar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'history' && (
          <div className="space-y-3 animate-fadeIn">
            {history.length === 0 ? (
              <p className="text-gray-400 text-center mt-10">No hay historial</p>
            ) : (
              history.map(debt => {
                return (
                  <div key={debt.id} className="bg-white p-3 rounded-[16px] border border-gray-100 flex items-center justify-between">
                    <div>
                      <p className="text-[14px] font-semibold text-[#1a1a1a]">
                        {debt.status === 'paid' ? 'Pagado' : 'Perdonado'}
                      </p>
                      <p className="text-[12px] text-gray-500">
                        {debt.debtor_name} → {debt.creditor_name}
                      </p>
                    </div>
                    <span className={`font-bold text-[14px] ${debt.status === 'paid' ? 'text-gray-700' : 'text-gray-400 line-through'}`}>
                      {formatMoney(debt.amount_cents)}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
