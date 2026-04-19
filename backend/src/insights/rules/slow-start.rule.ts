import { InsightEvent } from '../types/insight-event.interface';
import { InsightRule, RuleContext } from '../types/insight-rule.interface';

const EVALUATION_WINDOW_START = 10;
const EVALUATION_WINDOW_END = 12;
const SLOW_START_THRESHOLD = 0.15;
const MIN_HISTORY_DAYS = 3;

export const slowStartRule: InsightRule = {
  id: 'slow_start',
  name: 'Slow Morning Start',
  cooldownHours: 24,
  priority: 'medium',

  async detect(commerceId: string, ctx: RuleContext): Promise<InsightEvent | null> {
    const hour = ctx.now.getHours();
    if (hour < EVALUATION_WINDOW_START || hour > EVALUATION_WINDOW_END) return null;

    const dateStr = ctx.localDateStr;
    const today = ctx.analytics.getDailySummary(commerceId, dateStr);

    const trend = ctx.analytics.getWeeklyTrend(commerceId, 14);
    const historicDays = trend.filter((d) => d.date !== dateStr && d.total > 0);
    if (historicDays.length < MIN_HISTORY_DAYS) return null;

    const avgDailyTotal =
      historicDays.reduce((sum, d) => sum + d.total, 0) / historicDays.length;

    // At 10-12am, if we haven't reached 15% of our daily average, the morning is slow
    if (today.total === 0 || today.total >= avgDailyTotal * SLOW_START_THRESHOLD) return null;

    return {
      ruleId: 'slow_start',
      commerceId,
      priority: 'medium',
      data: {
        todayTotal: today.total,
        avgDailyTotal: Math.round(avgDailyTotal * 100) / 100,
        currentHour: hour,
      },
    };
  },
};
