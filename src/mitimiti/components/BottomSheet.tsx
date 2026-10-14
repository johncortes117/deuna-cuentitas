// ─── BottomSheet: hoja inferior común a todo MitiMiti ────────
// Una sola implementación para que todas las hojas se vean, entren y se
// cierren igual (antes cada modal tenía su propio fondo, borde y animación).
import type { ReactNode } from 'react';

interface BottomSheetProps {
  onClose: () => void;
  children: ReactNode;
  // false mientras se procesa algo con dinero: tocar afuera no debe cerrar.
  dismissible?: boolean;
  // Para apilar una hoja de confirmación encima de otra.
  level?: 0 | 1;
  label?: string;
}

export default function BottomSheet({ onClose, children, dismissible = true, level = 0, label }: BottomSheetProps) {
  return (
    <>
      <div
        className="absolute inset-0 bg-black/45 md:rounded-[43px] animate-fadeIn"
        style={{ zIndex: 40 + level * 20 }}
        onClick={() => dismissible && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[28px] md:rounded-b-[43px] flex flex-col max-h-[92%] animate-slideUp overflow-hidden"
        style={{ zIndex: 41 + level * 20 }}
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>
        {children}
      </div>
    </>
  );
}

export function SheetCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Cerrar"
      className="w-10 h-10 flex items-center justify-center bg-gray-100 text-gray-600 rounded-full active:scale-95 shrink-0"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  );
}
