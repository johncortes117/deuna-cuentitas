import { InsightEvent } from '../types/insight-event.interface';
import { InsightRule, RuleContext } from '../types/insight-rule.interface';

export const dailyRecordRule: InsightRule = {
  id: 'daily_record',
  name: 'Daily Sales Record',
  cooldownHours: 24,
  priority: 'high',

  async detect(commerceId: string, ctx: RuleContext): Promise<InsightEvent | null> {
    const hour = ctx.now.getHours();
    // Only fire before closing time — there's still room to celebrate and keep going
    if (hour >= 19) return null;

    const dateStr = ctx.localDateStr;
    const today = ctx.analytics.getDailySummary(commerceId, dateStr);
    if (today.cobros === 0) return null;

    const bestDay = ctx.analytics.getBestDay(commerceId);
    if (!bestDay || today.total <= bestDay.total) return null;

    const topClients = ctx.analytics.getTopClients(commerceId, 'today', 1);

    return {
      ruleId: 'daily_record',
      commerceId,
      priority: 'high',
      data: {
        todayTotal: today.total,
        previousRecord: bestDay.total,
        previousRecordDate: bestDay.date,
        currentHour: hour,
        topClient: topClients[0]?.clientName ?? null,
      },
    };
  },
};
