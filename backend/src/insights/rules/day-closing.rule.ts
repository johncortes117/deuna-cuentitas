import { InsightEvent } from '../types/insight-event.interface';
import { InsightRule, RuleContext } from '../types/insight-rule.interface';

const CLOSING_WINDOW_START = 19;
const CLOSING_WINDOW_END = 21;

export const dayClosingRule: InsightRule = {
  id: 'day_closing',
  name: 'Daily Closing Summary',
  cooldownHours: 20,
  priority: 'low',

  async detect(commerceId: string, ctx: RuleContext): Promise<InsightEvent | null> {
    const hour = ctx.now.getHours();
    if (hour < CLOSING_WINDOW_START || hour > CLOSING_WINDOW_END) return null;

    const dateStr = ctx.localDateStr;
    const today = ctx.analytics.getDailySummary(commerceId, dateStr);
    if (today.cobros === 0) return null;

    const topClients = ctx.analytics.getTopClients(commerceId, 'today', 3);
    const bestDay = ctx.analytics.getBestDay(commerceId);
    const weekComparison = ctx.analytics.compareWeeks(commerceId);

    return {
      ruleId: 'day_closing',
      commerceId,
      priority: 'low',
      data: {
        total: today.total,
        cobros: today.cobros,
        avgTicket: today.avgTicket,
        topClients: topClients.map((c) => c.clientName),
        isRecord: bestDay ? today.total >= bestDay.total : false,
        vsLastWeek: weekComparison.diffTotal,
      },
    };
  },
};
