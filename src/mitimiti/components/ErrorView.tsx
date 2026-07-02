// ─── ErrorView: Pantalla de error con acciones ───────────────

interface ErrorViewProps {
  message: string;
  isHost: boolean;
  onRetry?: () => void;
  onCancel?: () => void;
  onBack: () => void;
}

export default function ErrorView({
  message,
  isHost,
  onRetry,
  onCancel,
  onBack,
}: ErrorViewProps) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6">
      {/* Icono de error */}
      <div className="mitimiti-check mb-6">
        <div className="w-20 h-20 bg-[#FCEBEB] rounded-full flex items-center justify-center">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#A32D2D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
      </div>

      <h2 className="text-[20px] font-bold text-[#1a1a1a] mb-2 text-center">
        Error en el pago
      </h2>
      <p className="text-[14px] text-gray-400 text-center mb-8 leading-relaxed">
        {message}
      </p>

      {/* Acciones del Host */}
      {isHost ? (
        <div className="w-full space-y-3">
          {onRetry && (
            <button
              onClick={onRetry}
              className="w-full py-4 rounded-[14px] bg-[#4C1D80] text-white text-[16px] font-bold active:scale-[0.98] transition-transform"
            >
              Reintentar
            </button>
          )}
          {onCancel && (
            <button
              onClick={onCancel}
              className="w-full py-4 rounded-[14px] bg-gray-100 text-[#1a1a1a] text-[16px] font-bold active:scale-[0.98] transition-transform"
            >
              Cancelar todo
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={onBack}
          className="w-full py-4 rounded-[14px] bg-gray-100 text-[#1a1a1a] text-[16px] font-bold active:scale-[0.98] transition-transform"
        >
          Volver
        </button>
      )}
    </div>
  );
}
