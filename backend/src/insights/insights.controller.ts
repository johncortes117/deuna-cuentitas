import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { ProactiveSchedulerService } from './proactive-scheduler.service';
import { InsightThrottleService } from './insight-throttle.service';

@Controller('insights')
export class InsightsController {
  constructor(
    private readonly scheduler: ProactiveSchedulerService,
    private readonly throttle: InsightThrottleService,
  ) {}

  /**
   * Manually trigger the insight cycle for a commerce.
   *
   * - `date` (YYYY-MM-DD): test at noon on that day — bypasses throttling.
   * - `datetime` (ISO 8601): full control over the simulated clock.
   *   e.g. "2026-03-15T20:00:00" to test the day-closing rule.
   */
  @Post('trigger')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        commerceId: { type: 'string', example: 'NEG001' },
        date: { type: 'string', description: 'YYYY-MM-DD', example: '2026-04-19' },
        datetime: { type: 'string', description: 'ISO 8601', example: '2026-04-19T20:00:00-05:00' }
      }
    }
  })
  trigger(@Body() body?: { commerceId?: string; date?: string; datetime?: string }) {
    const override = body?.datetime ?? body?.date;
    return this.scheduler.triggerManual(body?.commerceId ?? 'NEG001', override);
  }

  /** Clear a specific throttle so a rule can fire again immediately. */
  @Post('throttle/clear')
  clearThrottle(@Body() body: { commerceId: string; ruleId: string }) {
    return this.throttle.clearThrottle(body.commerceId, body.ruleId);
  }
}
