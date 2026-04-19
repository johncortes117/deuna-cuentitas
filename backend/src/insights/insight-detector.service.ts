import { Injectable, Logger } from '@nestjs/common';
import { AnalyticsService } from '../analytics/analytics.service';
import { InsightEvent } from './types/insight-event.interface';
import { RuleContext } from './types/insight-rule.interface';
import { INSIGHT_RULES } from './rules';

@Injectable()
export class InsightDetectorService {
  private readonly logger = new Logger(InsightDetectorService.name);

  constructor(private readonly analytics: AnalyticsService) {}

  /**
   * Evaluates all enabled rules for a commerce.
   * Each rule runs independently — a failure in one does not block the others.
   *
   * @param overrideNow  Inject a specific date for testing with historical data.
   */
  async detectAll(
    commerceId: string,
    enabledRuleIds: string[],
    overrideNow?: Date,
  ): Promise<InsightEvent[]> {
    const rules = INSIGHT_RULES.filter((r) => enabledRuleIds.includes(r.id));
    const now = overrideNow ?? new Date();
    
    // Default to 'America/Guayaquil' for Ecuador
    const timezone = 'America/Guayaquil';
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
    const localDateStr = formatter.format(now);

    const ctx: RuleContext = { analytics: this.analytics, now, timezone, localDateStr };

    const settled = await Promise.allSettled(rules.map((r) => r.detect(commerceId, ctx)));

    const events: InsightEvent[] = [];
    for (const [i, result] of settled.entries()) {
      if (result.status === 'rejected') {
        this.logger.error(`Rule "${rules[i].id}" threw: ${result.reason}`);
      } else if (result.value !== null) {
        events.push(result.value);
      }
    }

    return events;
  }
}
