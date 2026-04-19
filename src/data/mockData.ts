// ─── Tipos ──────────────────────────────────────────────────────

export interface DailySummary {
  totalToday: number;
  cobrosCount: number;
  vsYesterday: number;    // positivo = subió, negativo = bajó
  last7Days: number[];    // 7 valores, último = hoy
  dayLabels: string[];    // ej. ['D','L','M','Mi','J','V','S']
}

export interface PeakSlot {
  label: string;   // '9am', '12pm'
  count: number;
  isPeak: boolean;
}

export interface PeakHours {
  peakLabel: string;  // '12–1pm'
  peakCount: number;
  slots: PeakSlot[];  // máx 6 franjas
}

export interface RankedClient {
  name: string;
  initials: string;
  totalAmount: number;
  visits: number;
}

export interface RankedVendor {
  name: string;
  initials: string;
  totalAmount: number;
  transactions: number;
}

export interface MisCuentitasData {
  alertMessage: string;
  summary: DailySummary;
  peakHours: PeakHours;
  topClients: RankedClient[];
  vendors: RankedVendor[];   // length < 2 → tarjeta no aparece
}

// ─── Mock data ──────────────────────────────────────────────────

export const mockMisCuentitas: MisCuentitasData = {
  alertMessage: 'Ayer fue tu mejor viernes del mes. Entraron $38 — pico a las 12pm',

  summary: {
    totalToday: 0.80,
    cobrosCount: 1,
    vsYesterday: -37.20,
    // Dom → Sáb (hoy)
    last7Days:  [12, 45, 28, 18, 62, 38, 0.80],
    dayLabels:  ['D', 'L', 'M', 'Mi', 'J', 'V', 'S'],
  },

  peakHours: {
    peakLabel: '12–1pm',
    peakCount: 15,
    slots: [
      { label: '9am',  count: 3,  isPeak: false },
      { label: '10am', count: 6,  isPeak: false },
      { label: '11am', count: 8,  isPeak: false },
      { label: '12pm', count: 15, isPeak: true  },
      { label: '1pm',  count: 11, isPeak: false },
      { label: '2pm',  count: 5,  isPeak: false },
    ],
  },

  topClients: [
    { name: 'María Andrade',  initials: 'MA', totalAmount: 127, visits: 3 },
    { name: 'Juan Pérez',     initials: 'JP', totalAmount: 89,  visits: 5 },
    { name: 'Carmen García',  initials: 'CG', totalAmount: 64,  visits: 2 },
  ],

  vendors: [
    { name: 'Lourdes Vera',  initials: 'LV', totalAmount: 215, transactions: 12 },
    { name: 'Carlos Méndez', initials: 'CM', totalAmount: 178, transactions: 9  },
    { name: 'Ana Torres',    initials: 'AT', totalAmount: 143, transactions: 8  },
  ],
};
