import { Body, Controller, Post } from '@nestjs/common';
import { ProactiveSchedulerService } from '../insights/proactive-scheduler.service';

/** Kept for backward compatibility. New endpoint: POST /insights/trigger */
@Controller('scheduler')
export class SchedulerController {
  constructor(private readonly scheduler: ProactiveSchedulerService) {}

  @Post('trigger-report')
  triggerReport(@Body() body: { commerceId?: string; date?: string }) {
    return this.scheduler.triggerManual(body.commerceId ?? 'NEG001', body.date);
  }
}
