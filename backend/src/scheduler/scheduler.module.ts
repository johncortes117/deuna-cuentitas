import { Module } from '@nestjs/common';
import { InsightsModule } from '../insights/insights.module';
import { SchedulerController } from './scheduler.controller';

/**
 * Thin compatibility shim — kept to preserve the /scheduler/trigger-report endpoint.
 * All logic lives in InsightsModule.
 */
@Module({
  imports: [InsightsModule],
  controllers: [SchedulerController],
})
export class SchedulerModule {}
