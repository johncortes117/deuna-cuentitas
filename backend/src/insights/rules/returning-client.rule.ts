import { InsightEvent } from '../types/insight-event.interface';
import { InsightRule, RuleContext } from '../types/insight-rule.interface';

const INACTIVITY_THRESHOLD_DAYS = 30;

export const returningClientRule: InsightRule = {
  id: 'returning_client',
  name: 'Returning Client',
  cooldownHours: 12,
  priority: 'medium',

  async detect(commerceId: string, ctx: RuleContext): Promise<InsightEvent | null> {
    const dateStr = ctx.localDateStr;
    const returning = ctx.analytics.getReturningClientsToday(
      commerceId,
      INACTIVITY_THRESHOLD_DAYS,
      dateStr,
    );

    if (returning.length === 0) return null;

    return {
      ruleId: 'returning_client',
      commerceId,
      priority: 'medium',
      data: {
        count: returning.length,
        clients: returning.map((c) => c.clientName).slice(0, 3),
        inactivityDays: INACTIVITY_THRESHOLD_DAYS,
      },
    };
  },
};
