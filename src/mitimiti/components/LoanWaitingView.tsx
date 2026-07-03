import type { Participant, Debt } from '../types';
import { formatMoney } from '../utils';

interface Props {
  participant: Participant;
  debts: Debt[];
}

export default function LoanWaitingView({ participant, debts }: Props) {
  const deficit = participant.deficit_cents;
  
  // Find debts where I am the debtor in this room
  const myLoans = debts.filter(d => d.debtor_id === participant.user_id && d.room_id === participant.room_id);
  const totalLoaned = myLoans.reduce((sum, d) => sum + d.amount_cents, 0);
  const originalDeficit = deficit + totalLoaned;
  
  const progressPercent = originalDeficit === 0 ? 100 : (totalLoaned / originalDeficit) * 100;

  return (
    <div className="bg-[#F8F9FA] rounded-[24px] p-6 flex flex-col items-center border border-gray-100 shadow-sm mt-6">
      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-[32px] mb-4 shadow-sm animate-pulse">
        🙏
      </div>
      
      <h3 className="text-[18px] font-bold text-[#1a1a1a] mb-1">
        Esperando ayuda
      </h3>
      <p className="text-gray-500 text-[14px] mb-6">
        Aún te faltan <span className="font-bold text-[#1a1a1a]">{formatMoney(deficit)}</span>
      </p>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-3 mb-2 overflow-hidden">
        <div 
          className="bg-orange-400 h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <p className="text-gray-400 text-[12px] font-medium self-end mb-6">
        {Math.round(progressPercent)}% cubierto
      </p>

      {/* Loaners list */}
      {myLoans.length > 0 && (
        <div className="w-full text-left">
          <p className="text-[13px] font-semibold text-gray-500 mb-3 uppercase tracking-wider">Te prestaron:</p>
          <div className="space-y-3">
            {myLoans.map(loan => (
              <div key={loan.id} className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-gray-50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-[#4C1D80]/10 rounded-full flex items-center justify-center text-[#4C1D80] font-bold text-[12px]">
                    {loan.creditor_name.slice(0,2).toUpperCase()}
                  </div>
                  <span className="font-medium text-[#1a1a1a] text-[14px]">{loan.creditor_name}</span>
                </div>
                <span className="font-bold text-green-600">+{formatMoney(loan.amount_cents)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
