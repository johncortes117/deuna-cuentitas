// ─── ProcessingView: Animación de procesamiento ──────────────
export default function ProcessingView() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6">
      {/* Logo animado */}
      <div className="mitimiti-pulse mb-8">
        <div className="w-20 h-20 bg-[#4C1D80] rounded-2xl flex items-center justify-center shadow-lg">
          <span className="text-white font-black text-3xl italic tracking-tighter">d!</span>
        </div>
      </div>

      {/* Texto */}
      <h2 className="text-[20px] font-bold text-[#1a1a1a] mb-2">
        Procesando pago...
      </h2>
      <p className="text-[14px] text-gray-400 text-center">
        No cierres la aplicación
      </p>

      {/* Barra de progreso indeterminada */}
      <div className="w-48 h-1 bg-gray-100 rounded-full mt-8 overflow-hidden">
        <div
          className="h-full bg-[#4C1D80] rounded-full"
          style={{
            width: '40%',
            animation: 'progressSlide 1.5s ease-in-out infinite',
          }}
        />
      </div>

      <style>{`
        @keyframes progressSlide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  );
}
