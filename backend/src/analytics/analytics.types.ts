// ─── Tipos de retorno del AnalyticsService ──────────────────────

export interface DailySummaryResult {
  date: string;
  total: number;
  cobros: number;
  avgTicket: number;
}

export interface DailyPoint {
  date: string;
  total: number;
  cobros: number;
}

export interface PeakHourResult {
  hour: number;
  label: string;
  txns: number;
}

export interface ClientRankResult {
  clientName: string;
  visits: number;
  total: number;
}

export interface VendorRankResult {
  vendorName: string;
  txns: number;
  total: number;
}

export interface InactiveClientResult {
  clientName: string;
  lastVisit: string;
  daysSince: number;
}

export interface WeekComparisonResult {
  labelA: string;
  labelB: string;
  totalA: number;
  cobrosA: number;
  totalB: number;
  cobrosB: number;
  diffTotal: number;
  diffPercent: number;
}

export interface BestDayResult {
  date: string;
  cobros: number;
  total: number;
}

export interface GeneralSummaryResult {
  total: number;
  cobros: number;
  avgTicket: number;
  firstSale: string | null;
  lastSale: string | null;
}
