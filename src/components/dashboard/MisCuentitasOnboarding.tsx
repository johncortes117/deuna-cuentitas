import React, { useState } from 'react';

interface MisCuentitasOnboardingProps {
  onContinue: () => void;
  onBack: () => void;
}

const D = {
  primary: '#452757', // Morado Deuna
  accent: '#00D3A4', // Verde Deuna
  textMain: '#1A1A2E',
  textSub: '#8F96A3',
  screenBg: '#FFFFFF',
};

const IcoBack = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1A1A2E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const IcoChart = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={D.textMain} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
    </svg>
);

const IcoChat = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={D.textMain} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
);

const IcoSort = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={D.textMain} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="2" x2="12" y2="22"></line>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
    </svg>
);

const IcoEdu = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={D.textMain} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
        <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
    </svg>
);

const FeatureItem = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
    <div className="flex items-start gap-4 py-3">
        <div className="flex-shrink-0 mt-1">
            {icon}
        </div>
        <div className="flex-1">
            <h4 className="text-[14px] font-bold text-[#1A1A2E] leading-tight mb-1">{title}</h4>
            <p className="text-[12px] text-[#8F96A3] leading-snug">{description}</p>
        </div>
        <div className="flex-shrink-0 flex items-center h-[34px]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8F96A3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
            </svg>
        </div>
    </div>
);


export default function MisCuentitasOnboarding({ onContinue, onBack }: MisCuentitasOnboardingProps) {
  const [accepted, setAccepted] = useState(false);

  return (
    <div className="flex-1 flex flex-col bg-white overflow-y-auto">
        <div className="pt-12 px-4 flex items-center justify-between pb-3 shrink-0">
            <button onClick={onBack} aria-label="Volver">
                <IcoBack />
            </button>
            <h2 className="text-[16px] font-bold text-[#1A1A2E] m-0 flex-1 text-center pr-6">Mis cuentitas</h2>
        </div>

        <div className="bg-[#EFEDF9] px-6 py-6 flex flex-col items-center justify-center shrink-0">
            <h1 className="text-[42px] font-black tracking-[-1.5px] leading-none mb-0 flex items-end">
                <span className="text-[#452757]">deuna!</span>
                <span className="text-[#00D3A4] text-[20px] ml-2 leading-tight tracking-normal mb-1 w-[80px] text-left">mis cuentitas</span>
            </h1>
        </div>

        <div className="px-5 pt-6 pb-6 flex-1 flex flex-col">
            <h3 className="text-[17px] font-bold text-[#452757] mb-6">
                Ponte pilas con tu negocio 💰
            </h3>

            <div className="flex flex-col gap-1 mb-8">
                <FeatureItem 
                    icon={
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3 3V21H21" stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M19 9L14 14L10 10L5 15" stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M14 9H19V14" stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    }
                    title="Ve cómo te está yendo al toque" 
                    description="Consulta tus ganancias del día y de la semana de forma clara y rápida." 
                />
                <FeatureItem 
                    icon={
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M9 10H9.01" stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M12 10H12.01" stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M15 10H15.01" stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    }
                    title="Pregúntale nomás" 
                    description="Realiza preguntas sobre tus ingresos, gastos o movimientos y obtén respuestas directas." 
                />
                <FeatureItem 
                    icon={
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M14 2V8H20" stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M12 18V12" stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M10 13.5C10 13.5 11.5 12 12 12C12.5 12 14 13.5 14 13.5" stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M10 16.5C10 16.5 11.5 18 12 18C12.5 18 14 16.5 14 16.5" stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    }
                    title="Ordena tus ingresos y gastos" 
                    description="Visualiza de manera organizada todo lo que entra y sale de tu negocio." 
                />
            </div>

            <div className="mt-auto border-t border-gray-100 pt-5 pb-5">
                <label className="flex items-center gap-3 cursor-pointer">
                    <div className={`w-5 h-5 rounded-[4px] border ${accepted ? 'bg-[#452757] border-[#452757]' : 'border-gray-300'} flex items-center justify-center shrink-0`}>
                        {accepted && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        )}
                    </div>
                    <input type="checkbox" className="hidden" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
                    <span className="text-[13px] font-bold text-[#1A1A2E] flex-1">Aceptación de Términos y Condiciones</span>
                    <span className="text-[13px] font-bold text-[#452757]">Ver más</span>
                </label>
            </div>

            <button 
                onClick={onContinue}
                disabled={!accepted}
                className={`w-full py-4 rounded-[14px] text-[16px] font-bold transition-all shrink-0 ${accepted ? 'bg-[#452757] text-white active:scale-[0.98]' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
            >
                Continuar
            </button>
        </div>
    </div>
  );
}
