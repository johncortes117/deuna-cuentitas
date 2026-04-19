import { AnalyticsService } from '../../analytics/analytics.service';
import { InsightEvent } from './insight-event.interface';

export interface RuleContext {
  analytics: AnalyticsService;
  /** Overridable clock — allows deterministic testing with historical dates. */
  now: Date;
  /** Commerce timezone */
  timezone: string;
  /** Date string padded as YYYY-MM-DD in the local timezone */
  localDateStr: string;
}

export interface InsightRule {
  readonly id: string;
  readonly name: string;
  /** Hours before the same rule can fire again for the same commerce. */
  readonly cooldownHours: number;
  readonly priority: 'high' | 'medium' | 'low';
  detect(commerceId: string, ctx: RuleContext): Promise<InsightEvent | null>;
}
