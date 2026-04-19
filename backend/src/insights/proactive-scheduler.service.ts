import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InsightDetectorService } from './insight-detector.service';
import { InsightThrottleService } from './insight-throttle.service';
import { InsightFormatterService } from './insight-formatter.service';
import { DeliveryRouterService } from './delivery-router.service';
import { getCommerceConfig, getCommerceConfigs } from './commerce.configs';
import { INSIGHT_RULES } from './rules';
import { CommerceConfig } from './types/commerce-config.interface';

const POLLING_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export interface TriggerResult {
  commerceId: string;
  eventsDetected: number;
  messagesSent: number;
  throttled: number;
}

@Injectable()
export class ProactiveSchedulerService {
  private readonly logger = new Logger(ProactiveSchedulerService.name);

  constructor(
    private readonly detector: InsightDetectorService,
    private readonly throttle: InsightThrottleService,
    private readonly formatter: InsightFormatterService,
    private readonly delivery: DeliveryRouterService,
  ) {}

  @Interval(POLLING_INTERVAL_MS)
  async runInsightCycle(): Promise<void> {
    const enabled = getCommerceConfigs().filter(
      (c) => c.proactiveEnabled && c.whatsappPhone,
    );

    this.logger.log(`Insight cycle — evaluating ${enabled.length} commerce(s)`);

    await Promise.allSettled(enabled.map((c) => this.processCommerce(c)));
  }

  /**
   * Manually trigger the insight cycle for a specific commerce.
   * Accepts an optional date to test rules against historical data.
   */
  async triggerManual(
    commerceId: string,
    overrideDate?: string,
  ): Promise<TriggerResult> {
    const config = getCommerceConfig(commerceId);
    if (!config) {
      throw new NotFoundException(`Commerce "${commerceId}" is not configured`);
    }

    // ISO datetime → exact clock; date-only → simulate noon (all time-windowed rules can fire)
    const overrideNow = overrideDate
      ? new Date(overrideDate.includes('T') ? overrideDate : `${overrideDate}T12:00:00`)
      : undefined;
    return this.processCommerce(config, { overrideNow, bypassThrottle: Boolean(overrideDate) });
  }

  private async processCommerce(
    config: CommerceConfig,
    opts: { overrideNow?: Date; bypassThrottle?: boolean } = {},
  ): Promise<TriggerResult> {
    const result: TriggerResult = {
      commerceId: config.commerceId,
      eventsDetected: 0,
      messagesSent: 0,
      throttled: 0,
    };

    try {
      const events = await this.detector.detectAll(
        config.commerceId,
        config.enabledRules,
        opts.overrideNow,
      );

      result.eventsDetected = events.length;

      for (const event of events) {
        const rule = INSIGHT_RULES.find((r) => r.id === event.ruleId);
        if (!rule) continue;

        const throttled =
          !opts.bypassThrottle &&
          (await this.throttle.isThrottled(config.commerceId, event.ruleId));

        if (throttled) {
          result.throttled++;
          this.logger.debug(`Throttled: rule="${event.ruleId}" commerce="${config.commerceId}"`);
          continue;
        }

        const message = await this.formatter.format(event);
        const { delivered } = await this.delivery.send(config.whatsappPhone, message);

        if (delivered) {
          await this.throttle.setThrottle(config.commerceId, event.ruleId, rule.cooldownHours);
          result.messagesSent++;
          this.logger.log(
            `Sent: rule="${event.ruleId}" commerce="${config.commerceId}" phone="${config.whatsappPhone}"`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Cycle failed for commerce "${config.commerceId}"`, error);
    }

    return result;
  }
}
