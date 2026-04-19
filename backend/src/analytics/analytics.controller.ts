import { Controller, Get, Param, BadRequestException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

const VALID_COMMERCE_IDS = ['NEG001', 'NEG002', 'NEG003'];

const DAY_LABELS_ES = ['D', 'L', 'M', 'Mi', 'J', 'V', 'S'];

const WEEKDAYS_ES = [
  'domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado',
];

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('dashboard/:commerceId')
  getDashboard(@Param('commerceId') commerceId: string) {
    if (!VALID_COMMERCE_IDS.includes(commerceId)) {
      throw new BadRequestException('commerceId inválido');
    }

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];

    const todaySummary = this.analytics.getDailySummary(commerceId, today);
    const yesterdaySummary = this.analytics.getDailySummary(commerceId, yesterday);
    const weekTrend = this.analytics.getWeeklyTrend(commerceId, 7);
    const peakHoursRaw = this.analytics.getPeakHours(commerceId, 'month');
    const topClientsRaw = this.analytics.getTopClients(commerceId, 'month', 3);
    const vendorsRaw = this.analytics.getTopVendors(commerceId, 'month');
    const bestDay = this.analytics.getBestDay(commerceId);

    const last7 = this.buildLast7Days(weekTrend);
    const peakHours = this.buildPeakHours(peakHoursRaw);
    const alertMessage = this.buildAlertMessage(bestDay, peakHours.peakLabel);

    const topClients = topClientsRaw.map((c) => ({
      name: c.clientName,
      initials: this.initials(c.clientName),
      totalAmount: c.total,
      visits: c.visits,
    }));

    const vendors = vendorsRaw.map((v) => ({
      name: v.vendorName,
      initials: this.initials(v.vendorName),
      totalAmount: v.total,
      transactions: v.txns,
    }));

    return {
      alertMessage,
      summary: {
        totalToday: todaySummary.total,
        cobrosCount: todaySummary.cobros,
        vsYesterday: +(todaySummary.total - yesterdaySummary.total).toFixed(2),
        last7Days: last7.values,
        dayLabels: last7.labels,
      },
      peakHours,
      topClients,
      vendors,
    };
  }

  private buildLast7Days(trend: { date: string; total: number }[]) {
    const values: number[] = [];
    const labels: string[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000);
      const dateStr = d.toISOString().split('T')[0];
      const found = trend.find((t) => t.date === dateStr);
      values.push(found ? found.total : 0);
      labels.push(DAY_LABELS_ES[d.getDay()]);
    }

    return { values, labels };
  }

  private buildPeakHours(raw: { hour: number; label: string; txns: number }[]) {
    if (raw.length === 0) {
      return { peakLabel: 'N/D', peakCount: 0, slots: [] };
    }

    const sorted = [...raw].sort((a, b) => a.hour - b.hour);
    const maxTxns = Math.max(...sorted.map((r) => r.txns));
    const peakRow = sorted.find((r) => r.txns === maxTxns);

    const slots = sorted.map((r) => ({
      label: r.label,
      count: r.txns,
      isPeak: r.txns === maxTxns,
    }));

    const peakLabel = peakRow
      ? `${peakRow.label}–${this.nextHourLabel(peakRow.hour)}`
      : '';

    return { peakLabel, peakCount: maxTxns, slots };
  }

  private nextHourLabel(hour: number): string {
    const next = hour + 1;
    if (next === 0) return '12am';
    if (next < 12) return `${next}am`;
    if (next === 12) return '12pm';
    return `${next - 12}pm`;
  }

  private buildAlertMessage(bestDay: { date: string; total: number } | null, peakLabel: string): string {
    if (!bestDay) return 'Bienvenido a tus Cuentitas.';
    const d = new Date(bestDay.date + 'T12:00:00');
    const dayName = WEEKDAYS_ES[d.getDay()];
    return `Tu mejor día fue el ${dayName} con $${bestDay.total}${peakLabel && peakLabel !== 'N/D' ? ` — pico a las ${peakLabel}` : ''}.`;
  }

  private initials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('');
  }
}
