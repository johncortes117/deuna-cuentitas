import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../db/db.service';
import type {
  BestDayResult,
  ClientRankResult,
  DailyPoint,
  DailySummaryResult,
  GeneralSummaryResult,
  InactiveClientResult,
  PeakHourResult,
  VendorRankResult,
  WeekComparisonResult,
} from './analytics.types';

/**
 * Capa de acceso a datos analíticos sobre SQLite.
 *
 * Todas las funciones reciben `commerceId` como primer argumento y
 * lo aplican siempre al WHERE — el LLM nunca puede omitirlo ni sobreescribirlo.
 * Los queries son parametrizados; ninguna función acepta SQL arbitrario.
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly db: DbService) {}

  // ─── Resumen diario ─────────────────────────────────────────────

  getDailySummary(commerceId: string, date?: string): DailySummaryResult {
    // Sanitizar: solo aceptar formato YYYY-MM-DD; cualquier otro valor → hoy
    const d = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : this.today();
    const [row] = this.db.rawQuery(
      `SELECT
         COUNT(*) AS cobros,
         ROUND(COALESCE(SUM(amount), 0), 2) AS total,
         ROUND(COALESCE(AVG(amount), 0), 2) AS avgTicket
       FROM transactions
       WHERE business_id = ? AND date = ?`,
      [commerceId, d],
    );
    return {
      date: d,
      total: row?.total ?? 0,
      cobros: row?.cobros ?? 0,
      avgTicket: row?.avgTicket ?? 0,
    };
  }

  // ─── Tendencia diaria (últimos N días) ──────────────────────────

  getWeeklyTrend(commerceId: string, days = 7): DailyPoint[] {
    const safeDays = Math.min(Math.max(days, 1), 90);
    return this.db.rawQuery(
      `SELECT
         date,
         COUNT(*) AS cobros,
         ROUND(SUM(amount), 2) AS total
       FROM transactions
       WHERE business_id = ? AND date >= date('now', ?)
       GROUP BY date
       ORDER BY date ASC`,
      [commerceId, `-${safeDays} days`],
    );
  }

  // ─── Horas pico ─────────────────────────────────────────────────

  getPeakHours(
    commerceId: string,
    period: 'today' | 'week' | 'month' = 'month',
  ): PeakHourResult[] {
    const offsetMap = { today: '-1 days', week: '-7 days', month: '-30 days' };
    const offset = offsetMap[period];

    const rows = this.db.rawQuery(
      `SELECT
         hour,
         COUNT(*) AS txns
       FROM transactions
       WHERE business_id = ? AND date >= date('now', ?)
       GROUP BY hour
       ORDER BY txns DESC
       LIMIT 6`,
      [commerceId, offset],
    );

    return rows.map((r) => ({
      hour: r.hour as number,
      txns: r.txns as number,
      label: this.hourLabel(r.hour as number),
    }));
  }

  // ─── Rankings ───────────────────────────────────────────────────

  getTopClients(
    commerceId: string,
    period: 'today' | 'week' | 'month' | 'year' = 'month',
    limit = 3,
  ): ClientRankResult[] {
    const safeLimit = Math.min(Math.max(limit, 1), 10);
    const offset = this.periodToOffset(period);

    return this.db.rawQuery(
      `SELECT
         client_name AS clientName,
         COUNT(*) AS visits,
         ROUND(SUM(amount), 2) AS total
       FROM transactions
       WHERE business_id = ? AND date >= date('now', ?)
       GROUP BY client_id
       ORDER BY total DESC
       LIMIT ?`,
      [commerceId, offset, safeLimit],
    );
  }

  getTopVendors(
    commerceId: string,
    period: 'today' | 'week' | 'month' = 'month',
  ): VendorRankResult[] {
    const offset = this.periodToOffset(period);

    return this.db.rawQuery(
      `SELECT
         vendor_name AS vendorName,
         COUNT(*) AS txns,
         ROUND(SUM(amount), 2) AS total
       FROM transactions
       WHERE business_id = ? AND vendor_id != '' AND date >= date('now', ?)
       GROUP BY vendor_id
       ORDER BY total DESC
       LIMIT 5`,
      [commerceId, offset],
    );
  }

  // ─── Retención de clientes ──────────────────────────────────────

  getInactiveClients(
    commerceId: string,
    daysSince = 14,
  ): InactiveClientResult[] {
    const safe = Math.min(Math.max(daysSince, 1), 365);

    return this.db.rawQuery(
      `SELECT
         client_name AS clientName,
         MAX(date) AS lastVisit,
         CAST(julianday('now') - julianday(MAX(date)) AS INTEGER) AS daysSince
       FROM transactions
       WHERE business_id = ?
       GROUP BY client_id
       HAVING lastVisit < date('now', ?)
       ORDER BY lastVisit ASC
       LIMIT 10`,
      [commerceId, `-${safe} days`],
    );
  }

  // ─── Comparaciones ──────────────────────────────────────────────

  compareWeeks(commerceId: string): WeekComparisonResult {
    const [row] = this.db.rawQuery(
      `SELECT
         ROUND(SUM(CASE WHEN date >= date('now', '-7 days') THEN amount ELSE 0 END), 2) AS totalA,
         COUNT(CASE WHEN date >= date('now', '-7 days') THEN 1 END) AS cobrosA,
         ROUND(SUM(CASE WHEN date >= date('now', '-14 days') AND date < date('now', '-7 days') THEN amount ELSE 0 END), 2) AS totalB,
         COUNT(CASE WHEN date >= date('now', '-14 days') AND date < date('now', '-7 days') THEN 1 END) AS cobrosB
       FROM transactions
       WHERE business_id = ?`,
      [commerceId],
    );

    const totalA = (row?.totalA as number) ?? 0;
    const totalB = (row?.totalB as number) ?? 0;
    const diffTotal = totalA - totalB;
    const diffPercent = totalB > 0 ? Math.round((diffTotal / totalB) * 100) : 0;

    return {
      labelA: 'Esta semana',
      labelB: 'Semana pasada',
      totalA,
      cobrosA: (row?.cobrosA as number) ?? 0,
      totalB,
      cobrosB: (row?.cobrosB as number) ?? 0,
      diffTotal,
      diffPercent,
    };
  }

  // ─── Históricos ─────────────────────────────────────────────────

  getBestDay(commerceId: string): BestDayResult | null {
    const [row] = this.db.rawQuery(
      `SELECT
         date,
         COUNT(*) AS cobros,
         ROUND(SUM(amount), 2) AS total
       FROM transactions
       WHERE business_id = ?
       GROUP BY date
       ORDER BY total DESC
       LIMIT 1`,
      [commerceId],
    );
    return row
      ? { date: row.date as string, cobros: row.cobros as number, total: row.total as number }
      : null;
  }

  getGeneralSummary(commerceId: string): GeneralSummaryResult {
    const [row] = this.db.rawQuery(
      `SELECT
         COUNT(*) AS cobros,
         ROUND(COALESCE(SUM(amount), 0), 2) AS total,
         ROUND(COALESCE(AVG(amount), 0), 2) AS avgTicket,
         MIN(date) AS firstSale,
         MAX(date) AS lastSale
       FROM transactions
       WHERE business_id = ?`,
      [commerceId],
    );
    return {
      total: (row?.total as number) ?? 0,
      cobros: (row?.cobros as number) ?? 0,
      avgTicket: (row?.avgTicket as number) ?? 0,
      firstSale: (row?.firstSale as string) ?? null,
      lastSale: (row?.lastSale as string) ?? null,
    };
  }

  // ─── Privados ────────────────────────────────────────────────────

  private today(): string {
    return new Date().toISOString().split('T')[0];
  }

  private hourLabel(hour: number): string {
    if (hour === 0) return '12am';
    if (hour < 12) return `${hour}am`;
    if (hour === 12) return '12pm';
    return `${hour - 12}pm`;
  }

  private periodToOffset(period: string): string {
    const map: Record<string, string> = {
      today: '-1 days',
      week: '-7 days',
      month: '-30 days',
      year: '-365 days',
    };
    return map[period] ?? '-30 days';
  }
}
